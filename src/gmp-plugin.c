/* Incomplete, experimental browser (NPAPI) plug-in for multiple
   precision arithmetic.

   Copyright(C) 2012 John Tobey, see ../LICENCE
*/

#include <gmp.h>

#include <npapi.h>
#include <npfunctions.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stddef.h>
#include <math.h>

#define PLUGIN_NAME        "GMP Arithmetic Library"
#define PLUGIN_DESCRIPTION PLUGIN_NAME " (EXPERIMENTAL)"
#define PLUGIN_VERSION     "0.0.0.0"

static NPNetscapeFuncs* sBrowserFuncs = NULL;

#define ENTRY(x) static NPIdentifier ID_ ## x;
#include "gmp-entries.h"
#undef ENTRY

typedef struct _GmpInstance {
    NPObject npobj;
    NPP instance;
#define ENTRY(x) NPObject x ## _property;
#include "gmp-entries.h"
#undef ENTRY
} GmpInstance;

#define GET_NPP(prop, name)                                             \
    (((GmpInstance*) (((char*) prop) -                                  \
                      offsetof (GmpInstance, name ## _property)))->instance)

static void
obj_noop (NPObject *npobj)
{
}

static bool
obj_id_false(NPObject *npobj, NPIdentifier name)
{
    return false;
}

static bool
obj_id_var_void(NPObject *npobj, NPIdentifier name, NPVariant *result)
{
    VOID_TO_NPVARIANT (*result);
    return true;
}

static bool
setProperty_ro(NPObject *npobj, NPIdentifier name, const NPVariant *value)
{
    sBrowserFuncs->setexception (npobj, "read-only object");
    return true;
}

static bool
removeProperty_ro(NPObject *npobj, NPIdentifier name)
{
    sBrowserFuncs->setexception (npobj, "read-only object");
    return true;
}

static bool
enumerate_empty(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *value = 0;
    *count = 0;
    return true;
}

typedef struct _Integer {
    NPObject npobj;
    mpz_t mpz;
} Integer;

static NPObject*
Integer_allocate(NPP npp, NPClass *aClass)
{
    Integer* z = (Integer*) sBrowserFuncs->memalloc (sizeof (Integer));
    if (z)
        mpz_init (z->mpz);
    return &z->npobj;
}

static void
Integer_deallocate(NPObject *npobj)
{
    if (npobj)
        mpz_clear (((Integer*) npobj)->mpz);
    sBrowserFuncs->memfree (npobj);
}

NPClass Integer_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Integer_allocate,
    deallocate      : Integer_deallocate,
    invalidate      : obj_noop,
    hasMethod       : obj_id_false,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static bool
isInteger (const NPVariant* arg)
{
    return NPVARIANT_IS_OBJECT (*arg)
        && NPVARIANT_TO_OBJECT (*arg)->_class == &Integer_npclass;
}

static Integer*
toInteger (const NPVariant* arg)
{
    return (Integer*) NPVARIANT_TO_OBJECT (*arg);
}

static bool
isNative (const NPVariant* arg)
{
    return NPVARIANT_IS_INT32 (*arg) || NPVARIANT_IS_DOUBLE (*arg);
}

static double
toDouble (const NPVariant* arg)
{
    if (NPVARIANT_IS_INT32 (*arg))
        return (double) NPVARIANT_TO_INT32 (*arg);
    return NPVARIANT_TO_DOUBLE (*arg);
}

static int32_t
toInt (const NPVariant* arg)
{
    if (NPVARIANT_IS_INT32 (*arg))
        return NPVARIANT_TO_INT32 (*arg);
    return (int32_t) NPVARIANT_TO_DOUBLE (*arg);
}

static bool
isFiniteDouble (const NPVariant* arg)
{
    double x;
    if (!NPVARIANT_IS_DOUBLE (*arg))
        return false;
    x = NPVARIANT_TO_DOUBLE (*arg);
    return x == x && finite (x);
}

static bool
isFiniteNative (const NPVariant* arg)
{
    return NPVARIANT_IS_INT32 (*arg) || isFiniteDouble (arg);
}

static bool
Integer_set_str (Integer* z, const NPString* str, int base)
{
    // XXX nul-terminated?
    return (base == 0 || (base >= 2 && base <= 62)) &&
        0 == mpz_set_str (z->mpz, str->UTF8Characters, base);
}

static bool
call_mpz (NPObject *npobj,
          const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    NPP instance = GET_NPP (npobj, mpz);
    Integer* ret = (Integer*) sBrowserFuncs->createobject
        (instance, &Integer_npclass);

    if (ret) {
        bool type_ok = true;
        bool value_ok = true;
        // XXX mpz_set and friends will be separate entry points.
        if (argCount == 1 && NPVARIANT_IS_INT32 (args[0]))
            mpz_set_si (ret->mpz, NPVARIANT_TO_INT32 (args[0]));
        else if (argCount == 1 && isFiniteDouble (&args[0]))
            mpz_set_d (ret->mpz, NPVARIANT_TO_DOUBLE (args[0]));
        else if (argCount == 1 && isInteger (&args[0]))
            mpz_set (ret->mpz, toInteger (&args[0])->mpz);
        else if (argCount == 1 && NPVARIANT_IS_STRING (args[0]))
            value_ok = Integer_set_str (ret, &NPVARIANT_TO_STRING (args[0]), 0);
        else if (argCount == 2 && NPVARIANT_IS_STRING (args[0])
                 && isNative (&args[1]))
            value_ok = Integer_set_str (ret, &NPVARIANT_TO_STRING (args[0]),
                                        toInt (&args[1]));
        else if (argCount > 0)
            type_ok = false;
        if (type_ok) {
            if (value_ok)
                OBJECT_TO_NPVARIANT (&ret->npobj, *result);
            else
                sBrowserFuncs->setexception (npobj, "invalid argument");
        }
        else
            sBrowserFuncs->setexception (npobj, "wrong type arguments");
    }
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

// XXX should be the toString method of Integer.
static bool
call_mpz_get_str (NPObject *npobj,
                  const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    int base = 0;
    if (argCount > 0 && isInteger (&args[0])) {
        if (argCount == 1)
            base = 10;
        else if (argCount == 2 && isNative (&args[1]))
            base = toInt (&args[1]);
    }
    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        Integer* z = toInteger (&args[0]);
        size_t len = mpz_sizeinbase (z->mpz, base) + 2;
        NPUTF8* s = sBrowserFuncs->memalloc (len);
        if (s) {
            mpz_get_str (s, base, z->mpz);
            if (s[0] != '-')
                len--;
            STRINGN_TO_NPVARIANT (s, s[len-2] ? len-1 : len-2, *result);
        }
        else
            sBrowserFuncs->setexception (npobj, "out of memory");
    }
    else
        sBrowserFuncs->setexception (npobj, "invalid argument");
    return true;
}

// XXX should be the valueOf method of Integer.
static bool
call_mpz_get_d (NPObject *npobj,
                const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    if (argCount == 1 && isInteger (&args[0])) {
        Integer* z = toInteger (&args[0]);
        DOUBLE_TO_NPVARIANT (mpz_get_d (z->mpz), *result);
    }
    else
        sBrowserFuncs->setexception (npobj, "wrong type arguments");
    return true;
}

// XXX I'd like to do mpz_get_d_2exp, but creating an array to hold
// the two results will be a mild pain.

#define FUNC_VOID_MPZ_MPZ(name)                                         \
    static bool                                                         \
    call_ ## name (NPObject *npobj,                                     \
                   const NPVariant *args, uint32_t argCount,            \
                   NPVariant *result)                                   \
    {                                                                   \
        if (argCount == 2 && isInteger (&args[0]) &&                    \
            isInteger (&args[1])) {                                     \
            name (toInteger (&args[0])->mpz, toInteger (&args[1])->mpz); \
            VOID_TO_NPVARIANT (*result);                                \
        }                                                               \
        else                                                            \
            sBrowserFuncs->setexception (npobj, "wrong type arguments"); \
        return true;                                                    \
    }

#define FUNC_VOID_MPZ_MPZ_MPZ(name)                                     \
    static bool                                                         \
    call_ ## name (NPObject *npobj,                                     \
                   const NPVariant *args, uint32_t argCount,            \
                   NPVariant *result)                                   \
    {                                                                   \
        if (argCount == 3 && isInteger (&args[0]) &&                    \
            isInteger (&args[1]) && isInteger (&args[2])) {             \
            name (toInteger (&args[0])->mpz, toInteger (&args[1])->mpz, \
                  toInteger (&args[2])->mpz);                           \
            VOID_TO_NPVARIANT (*result);                                \
        }                                                               \
        else                                                            \
            sBrowserFuncs->setexception (npobj, "wrong type arguments"); \
        return true;                                                    \
    }

#define FUNC_VOID_MPZ_MPZ_MPZ_MPZ(name)                                 \
    static bool                                                         \
    call_ ## name (NPObject *npobj,                                     \
                   const NPVariant *args, uint32_t argCount,            \
                   NPVariant *result)                                   \
    {                                                                   \
        if (argCount == 4 && isInteger (&args[0]) &&                    \
            isInteger (&args[1]) && isInteger (&args[2]) &&             \
            isInteger (&args[3])) {                                     \
            name (toInteger (&args[0])->mpz, toInteger (&args[1])->mpz, \
                  toInteger (&args[2])->mpz, toInteger (&args[3])->mpz); \
            VOID_TO_NPVARIANT (*result);                                \
        }                                                               \
        else                                                            \
            sBrowserFuncs->setexception (npobj, "wrong type arguments"); \
        return true;                                                    \
    }

FUNC_VOID_MPZ_MPZ_MPZ (mpz_add)
// XXX mpz_add_ui
FUNC_VOID_MPZ_MPZ_MPZ (mpz_sub)
// XXX mpz_sub_ui
// XXX mpz_ui_sub
FUNC_VOID_MPZ_MPZ_MPZ (mpz_mul)
// XXX mpz_mul_si
// XXX mpz_mul_ui
FUNC_VOID_MPZ_MPZ_MPZ (mpz_addmul)
// XXX mpz_addmul_ui
FUNC_VOID_MPZ_MPZ_MPZ (mpz_submul)
// XXX mpz_submul_ui
// XXX mpz_mul_2exp
FUNC_VOID_MPZ_MPZ (mpz_neg)
FUNC_VOID_MPZ_MPZ (mpz_abs)
FUNC_VOID_MPZ_MPZ_MPZ (mpz_cdiv_q)
FUNC_VOID_MPZ_MPZ_MPZ (mpz_cdiv_r)
FUNC_VOID_MPZ_MPZ_MPZ_MPZ (mpz_cdiv_qr)
// XXX more functions
// XXX consider C++ for easy type checking and extraction.  Could
// gmp-entries.h produce these functions, given a few more ENTRY args?

#define ENTRY(x)                                        \
    static NPClass x ## _npclass = {                    \
        structVersion   : NP_CLASS_STRUCT_VERSION,      \
        deallocate      : obj_noop,                     \
        invalidate      : obj_noop,                     \
        hasMethod       : obj_id_false,                 \
        invokeDefault   : call_ ## x,                   \
        hasProperty     : obj_id_false,                 \
        getProperty     : obj_id_var_void,              \
        setProperty     : setProperty_ro,               \
        removeProperty  : removeProperty_ro,            \
        enumerate       : enumerate_empty               \
    };
#include "gmp-entries.h"
#undef ENTRY

static NPObject*
gmp_allocate (NPP instance, NPClass *aClass)
{
    GmpInstance* ret = (GmpInstance*)
        sBrowserFuncs->memalloc (sizeof (GmpInstance));
    if (ret) {
        ret->instance = instance;
#define ENTRY(x)                                        \
        ret->x ## _property._class = &x ## _npclass;    \
        ret->x ## _property.referenceCount = 1;
#include "gmp-entries.h"
#undef ENTRY
    }
    return &ret->npobj;
}

static void
gmp_deallocate (NPObject *npobj)
{
    sBrowserFuncs->memfree (npobj);
}

static bool
gmp_invoke(NPObject *npobj, NPIdentifier name,
           const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    sBrowserFuncs->setexception (npobj,
                                 "oops, browser used invoke instead of getProperty");
    return true;
}

static bool
gmp_hasProperty(NPObject *npobj, NPIdentifier name)
{
    return false
#define ENTRY(x) || name == ID_ ## x
#include "gmp-entries.h"
#undef ENTRY
        ;
}

static bool
gmp_getProperty(NPObject *npobj, NPIdentifier name, NPVariant *result)
{
    GmpInstance* gmpinst = (GmpInstance*) npobj;
    NPObject* func = 0;
    if (0 == 1)
        func = func;
#define ENTRY(x) else if (name == ID_ ## x) func = &gmpinst->x ## _property;
#include "gmp-entries.h"
#undef ENTRY
    if (func)
        OBJECT_TO_NPVARIANT (sBrowserFuncs->retainobject (func), *result);
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

static bool
gmp_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    uint32_t cnt = 0
#define ENTRY(x) +1
#include "gmp-entries.h"
#undef ENTRY
        ;
    *value = sBrowserFuncs->memalloc (cnt * sizeof (NPIdentifier*));
    *count = cnt;
    cnt = 0;
#define ENTRY(x) (*value)[cnt++] = ID_ ## x;
#include "gmp-entries.h"
#undef ENTRY
    return true;
}

static NPClass gmp_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : gmp_allocate,
    deallocate      : gmp_deallocate,
    invalidate      : obj_noop,
    hasMethod       : obj_id_false,
    invoke          : gmp_invoke,
    hasProperty     : gmp_hasProperty,
    getProperty     : gmp_getProperty,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : gmp_enumerate
};

static NPError
npp_New(NPMIMEType pluginType, NPP instance, uint16_t mode,
        int16_t argc, char* argn[], char* argv[], NPSavedData* saved)
{
  // Make this a windowless plug-in.  This makes Chrome happy.
    sBrowserFuncs->setvalue (instance, NPPVpluginWindowBool, (void*) false);
    instance->pdata = sBrowserFuncs->createobject (instance, &gmp_npclass);
    if (!instance->pdata)
        return NPERR_OUT_OF_MEMORY_ERROR;
    return NPERR_NO_ERROR;
}

static NPError
npp_Destroy(NPP instance, NPSavedData** save) {
    void* data = instance->pdata;
    instance->pdata = 0;
    if (data)
        sBrowserFuncs->releaseobject ((NPObject*) data);
    return NPERR_NO_ERROR;
}

static NPError
npp_GetValue(NPP instance, NPPVariable variable, void *value) {
    switch (variable) {
    case NPPVpluginScriptableNPObject:
        *((NPObject**)value) =
            sBrowserFuncs->retainobject ((NPObject*) instance->pdata);
        break;
    default:
        return NPERR_GENERIC_ERROR;
    }
    return NPERR_NO_ERROR;
}

NP_EXPORT(NPError)
NP_Initialize(NPNetscapeFuncs* bFuncs, NPPluginFuncs* pFuncs)
{
    sBrowserFuncs = bFuncs;

    // Check the size of the provided structure based on the offset of the
    // last member we need.
    if (pFuncs->size < (offsetof(NPPluginFuncs, getvalue) + sizeof(void*)))
        return NPERR_INVALID_FUNCTABLE_ERROR;

    pFuncs->newp = npp_New;
    pFuncs->destroy = npp_Destroy;
    pFuncs->getvalue = npp_GetValue;

#define ENTRY(x) ID_ ## x = sBrowserFuncs->getstringidentifier (# x);
#include "gmp-entries.h"
#undef ENTRY

    return NPERR_NO_ERROR;
}

NP_EXPORT(char*)
NP_GetPluginVersion()
{
    return PLUGIN_VERSION;
}

NP_EXPORT(const char*)
NP_GetMIMEDescription()
{
    return "application/x-gmplib:gmp:GNU Multiple Precision Arithmetic Library";
}

NP_EXPORT(NPError)
NP_GetValue(void* future, NPPVariable aVariable, void* aValue) {
    switch (aVariable) {
    case NPPVpluginNameString:
        *((char**)aValue) = PLUGIN_NAME;
        break;
    case NPPVpluginDescriptionString:
        *((char**)aValue) = PLUGIN_DESCRIPTION;
        break;
    default:
        return NPERR_INVALID_PARAM;
        break;
    }
    return NPERR_NO_ERROR;
}

NP_EXPORT(NPError)
NP_Shutdown()
{
    return NPERR_NO_ERROR;
}
