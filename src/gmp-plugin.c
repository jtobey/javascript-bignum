/* browser (NPAPI) plug-in for multiple precision arithmetic.

   TO DO: random number functions, mpf, mpfr.

   Copyright(C) 2012 John Tobey, see ../LICENCE
*/

#include <gmp.h>

/* Break the GMP abstraction just this once. */
typedef __gmp_randstate_struct* x_gmp_randstate_ptr;

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

/* Argument conversion. */

typedef unsigned long ulong;
typedef char const* stringz;

#define DEFINE_IN_NUMBER(type)                                          \
    static inline bool                                                  \
    in_ ## type (const NPVariant* var, type* arg)                       \
    {                                                                   \
        if (NPVARIANT_IS_INT32 (*var) &&                                \
            NPVARIANT_TO_INT32 (*var) == (type) NPVARIANT_TO_INT32 (*var)) \
            *arg = (type) NPVARIANT_TO_INT32 (*var);                    \
        else if (NPVARIANT_IS_DOUBLE (*var) &&                          \
            NPVARIANT_TO_DOUBLE (*var) == (type) NPVARIANT_TO_DOUBLE (*var)) \
            *arg = (type) NPVARIANT_TO_DOUBLE (*var);                   \
        else                                                            \
            return false;                                               \
        return true;                                                    \
    }

#define DEFINE_IN_UNSIGNED(type)                                        \
    static inline bool                                                  \
    in_ ## type (const NPVariant* var, type* arg)                       \
    {                                                                   \
        if (NPVARIANT_IS_INT32 (*var) && NPVARIANT_TO_INT32 (*var) >= 0 && \
            NPVARIANT_TO_INT32 (*var) == (type) NPVARIANT_TO_INT32 (*var)) \
            *arg = (type) NPVARIANT_TO_INT32 (*var);                    \
        else if (NPVARIANT_IS_DOUBLE (*var) &&                          \
            NPVARIANT_TO_DOUBLE (*var) == (type) NPVARIANT_TO_DOUBLE (*var)) \
            *arg = (type) NPVARIANT_TO_DOUBLE (*var);                   \
        else                                                            \
            return false;                                               \
        return true;                                                    \
    }

DEFINE_IN_NUMBER (int)
DEFINE_IN_NUMBER (long)
DEFINE_IN_UNSIGNED (ulong)

static inline bool
in_double (const NPVariant* var, double* arg)
{
    if (NPVARIANT_IS_DOUBLE (*var))
        *arg = NPVARIANT_TO_DOUBLE (*var);
    else if (NPVARIANT_IS_INT32 (*var))
        *arg = (double) NPVARIANT_TO_INT32 (*var);
    else
        return false;
    return true;
}

static inline bool
in_stringz (const NPVariant* var, stringz* arg)
{
    if (!NPVARIANT_IS_STRING (*var))
        return false;
    *arg = NPVARIANT_TO_STRING (*var).UTF8Characters;
    return true;
}

/* Return value conversion. */

static inline void
out_double (double value, NPVariant* result)
{
    DOUBLE_TO_NPVARIANT (value, *result);
}

#define DEFINE_OUT_NUMBER(type)                                 \
    static inline void                                          \
    out_ ## type (type value, NPVariant* result)                \
    {                                                           \
        if (value == (int32_t) value)                           \
            INT32_TO_NPVARIANT (value, *result);                \
        else                                                    \
            DOUBLE_TO_NPVARIANT ((double) value, *result);      \
    }
DEFINE_OUT_NUMBER(ulong)
DEFINE_OUT_NUMBER(long)
DEFINE_OUT_NUMBER(int)
DEFINE_OUT_NUMBER(size_t)

static inline void
out_bool (int value, NPVariant* result)
{
    BOOLEAN_TO_NPVARIANT (value, *result);
}

static inline void
out_stringz (stringz value, NPVariant* result)
{
    size_t len = strlen (value);
    NPUTF8* ret = (NPUTF8*) sBrowserFuncs->memalloc (len + 1);
    if (ret) {
        memcpy (ret, value, len + 1);
        STRINGN_TO_NPVARIANT (ret, len, *result);
    }
    else
        /* XXX Should make npobj an argument to converters so this can throw. */
        VOID_TO_NPVARIANT (*result);
}

static NPIdentifier ID_toString;

typedef struct _TopObject {
    NPObject npobjTop;
    NPP instance;
    NPObject npobjGmp;
#define CTOR(string, id) NPObject id;
#include "gmp-entries.h"
} TopObject;

#define CONTAINING(outer, member, ptr)                          \
    ((outer*) (((char*) ptr) - offsetof (outer, member)))

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

static bool
hasMethod_only_toString(NPObject *npobj, NPIdentifier name)
{
    return name == ID_toString;
}

static bool
enumerate_only_toString(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *value = sBrowserFuncs->memalloc (1 * sizeof (NPIdentifier*));
    *count = 1;
    (*value)[0] = ID_toString;
    return true;
}

static void
obj_invalidate (NPObject *npobj)
{
#if DEBUG_ALLOC
    //fprintf (stderr, "invalidate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
}

typedef struct _Integer {
    NPObject npobj;
    mpz_t mp;
} Integer;

static NPObject*
Integer_allocate (NPP npp, NPClass *aClass)
{
    Integer* ret = (Integer*) sBrowserFuncs->memalloc (sizeof (Integer));
#if DEBUG_ALLOC
    fprintf (stderr, "Integer allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        mpz_init (ret->mp);
    return &ret->npobj;
}

static void
Integer_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Integer deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    if (npobj)
        mpz_clear (((Integer*) npobj)->mp);
    sBrowserFuncs->memfree (npobj);
}

static bool mpp_toString (NPObject *npobj, mpz_ptr mpp, const NPVariant *args,
                          uint32_t argCount, NPVariant *result);

static bool
Integer_invoke (NPObject *npobj, NPIdentifier name,
                const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Integer* z = (Integer*) npobj;
    if (name == ID_toString)
        return mpp_toString (npobj, z->mp, args, argCount, result);
    sBrowserFuncs->setexception (npobj, "no such method");
    return true;
}

static NPClass Integer_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Integer_allocate,
    deallocate      : Integer_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : hasMethod_only_toString,
    invoke          : Integer_invoke,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_only_toString
};

static void
Mpz_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjMpz, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Mpz deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */

    /* Decrement the top object's reference count.  In theory, this
       could be dangerous, and the top object should implement
       invalidate() and somehow inform objects referring to it not to
       bother.  Quoth npruntime.h: "The runtime will typically return
       immediately, with 0 or NULL, from an attempt to dispatch to [an
       invalidated] NPObject, but this behavior should not be depended
       upon."  I choose to depend on it anyway, because I consider
       browsers more likely to cope with calls on freed objects than
       to call my invalidate() at a useful time.  Browsers appear to
       call invalidate() immediately before deallocate(), which is
       useless.  Trying to keep a list of live objects or note when
       NPP_Destroy has been called on an object's instance would
       complicate and slow down the code too much.
     */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static bool
Mpz_invokeDefault (NPObject *npobj,
                   const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjMpz, npobj)->instance;
    Integer* ret;

    if (argCount != 0) {
        sBrowserFuncs->setexception (npobj, "wrong type arguments");
        return true;
    }

    ret = (Integer*) sBrowserFuncs->createobject (instance, &Integer_npclass);

    if (ret)
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

static NPClass Mpz_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Mpz_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Mpz_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

typedef int int_0_or_2_to_62;
typedef int int_2_to_62;

static inline bool
in_int_0_or_2_to_62 (const NPVariant* var, int* arg)
{
    return in_int (var, arg) && (*arg == 0 || (*arg >= 2 && *arg <= 62));
}

static inline bool
in_int_2_to_62 (const NPVariant* var, int* arg)
{
    return in_int (var, arg) && *arg >= 2 && *arg <= 62;
}

DEFINE_IN_UNSIGNED (mp_bitcnt_t)
DEFINE_OUT_NUMBER (mp_bitcnt_t)

static bool
mpp_toString (NPObject *npobj, mpz_ptr mpp, const NPVariant *args,
              uint32_t argCount, NPVariant *result)
{
    int base = 0;

    if (argCount == 0 || !in_int (&args[0], &base))
        base = 10;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        size_t len = mpz_sizeinbase (mpp, base) + 2;
        NPUTF8* s = sBrowserFuncs->memalloc (len);
        if (s) {
            mpz_get_str (s, base, mpp);
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

typedef struct _MpzRef {
    NPObject npobj;
    mpz_ptr mpp;
    NPObject* owner;
} MpzRef;

static NPObject*
MpzRef_allocate (NPP npp, NPClass *aClass)
{
    MpzRef* ret = (MpzRef*) sBrowserFuncs->memalloc (sizeof (MpzRef));
#if DEBUG_ALLOC
    fprintf (stderr, "MpzRef allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        ret->owner = 0;
    return &ret->npobj;
}

static void
MpzRef_deallocate (NPObject *npobj)
{
    MpzRef* ref = (MpzRef*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "MpzRef deallocate %p; %p\n", npobj, ref->owner);
#endif  /* DEBUG_ALLOC */
    if (ref->owner)
        /* Decrement the Rational's reference count.  See comments in
           Mpz_deallocate.  */
        sBrowserFuncs->releaseobject (ref->owner);
    sBrowserFuncs->memfree (npobj);
}

static bool
MpzRef_invoke (NPObject *npobj, NPIdentifier name,
               const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    MpzRef* ref = (MpzRef*) npobj;
    if (name == ID_toString)
        return mpp_toString (npobj, ref->mpp, args, argCount, result);
    sBrowserFuncs->setexception (npobj, "no such method");
    return true;
}

static NPClass MpzRef_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : MpzRef_allocate,
    deallocate      : MpzRef_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : hasMethod_only_toString,
    invoke          : MpzRef_invoke,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_only_toString
};

static inline bool
in_mpz_ptr (const NPVariant* var, mpz_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var))
        return false;
    if (NPVARIANT_TO_OBJECT (*var)->_class == &Integer_npclass)
        *arg = &((Integer*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    else if (NPVARIANT_TO_OBJECT (*var)->_class == &MpzRef_npclass)
        *arg = ((MpzRef*) NPVARIANT_TO_OBJECT (*var))->mpp;
    else
        return false;
    return true;
}

typedef struct _Rational {
    NPObject npobj;
    mpq_t mp;
} Rational;

static NPObject*
Rational_allocate (NPP npp, NPClass *aClass)
{
    Rational* ret = (Rational*) sBrowserFuncs->memalloc (sizeof (Rational));
#if DEBUG_ALLOC
    fprintf (stderr, "Rational allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        mpq_init (ret->mp);
    return &ret->npobj;
}

static void
Rational_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Rational deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    if (npobj)
        mpq_clear (((Rational*) npobj)->mp);
    sBrowserFuncs->memfree (npobj);
}

static NPClass Rational_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Rational_allocate,
    deallocate      : Rational_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static void
Mpq_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjMpq, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Mpq deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static bool
Mpq_invokeDefault (NPObject *npobj,
                   const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjMpq, npobj)->instance;
    Rational* ret;

    if (argCount != 0) {
        sBrowserFuncs->setexception (npobj, "invalid argument");
        return true;
    }

    ret = (Rational*) sBrowserFuncs->createobject (instance, &Rational_npclass);

    if (ret)
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

static NPClass Mpq_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Mpq_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Mpq_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static inline bool
in_mpq_ptr (const NPVariant* var, mpq_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &Rational_npclass)
        return false;
    *arg = &((Rational*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

static void
Mpq_numref_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjMpq_numref, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Mpq_numref deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static bool
Mpq_numref_invokeDefault (NPObject *npobj,
                          const NPVariant *args, uint32_t argCount,
                          NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjMpq_numref, npobj)->instance;
    mpq_ptr q;
    MpzRef* ret;

    if (argCount != 1 || !in_mpq_ptr (&args[0], &q)) {
        sBrowserFuncs->setexception (npobj, "wrong type arguments");
        return true;
    }

    ret = (MpzRef*) sBrowserFuncs->createobject (instance, &MpzRef_npclass);

    if (ret) {
        ret->owner = sBrowserFuncs->retainobject
            (NPVARIANT_TO_OBJECT (args[0]));
        ret->mpp = &(mpq_numref (q))[0];
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);
    }
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

static NPClass Mpq_numref_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Mpq_numref_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Mpq_numref_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static bool
Mpq_denref_invokeDefault (NPObject *npobj,
                          const NPVariant *args, uint32_t argCount,
                          NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjMpq_denref, npobj)->instance;
    mpq_ptr q;
    MpzRef* ret;

    if (argCount != 1 || !in_mpq_ptr (&args[0], &q)) {
        sBrowserFuncs->setexception (npobj, "wrong type arguments");
        return true;
    }

    ret = (MpzRef*) sBrowserFuncs->createobject (instance, &MpzRef_npclass);

    if (ret) {
        ret->owner = sBrowserFuncs->retainobject
            (NPVARIANT_TO_OBJECT (args[0]));
        ret->mpp = &(mpq_denref (q))[0];
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);
    }
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

static void
Mpq_denref_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjMpq_denref, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Mpq_denref deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static NPClass Mpq_denref_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Mpq_denref_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Mpq_denref_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

typedef struct _Float {
    NPObject npobj;
    mpf_t mp;
} Float;

static NPObject*
Float_allocate (NPP npp, NPClass *aClass)
{
    Float* ret = (Float*) sBrowserFuncs->memalloc (sizeof (Float));
#if DEBUG_ALLOC
    fprintf (stderr, "Float allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        mpf_init (ret->mp);
    return &ret->npobj;
}

static void
Float_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Float deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    if (npobj)
        mpf_clear (((Float*) npobj)->mp);
    sBrowserFuncs->memfree (npobj);
}

static NPClass Float_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Float_allocate,
    deallocate      : Float_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static void
Mpf_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjMpf, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Mpf deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static bool
Mpf_invokeDefault (NPObject *npobj,
                   const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjMpf, npobj)->instance;
    Float* ret;

    if (argCount != 0) {
        sBrowserFuncs->setexception (npobj, "invalid argument");
        return true;
    }

    ret = (Float*) sBrowserFuncs->createobject (instance, &Float_npclass);

    if (ret)
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
    return true;
}

static NPClass Mpf_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Mpf_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Mpf_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static inline bool
in_mpf_ptr (const NPVariant* var, mpf_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &Float_npclass)
        return false;
    *arg = &((Float*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

typedef struct _Entry {
    NPObject npobj;
    int number;
} Entry;

static NPObject*
Entry_allocate (NPP npp, NPClass *aClass)
{
    Entry* ret = (Entry*) sBrowserFuncs->memalloc (sizeof (Entry));
#if DEBUG_ALLOC
    fprintf (stderr, "Entry allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    return &ret->npobj;
}

static void
Entry_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Entry deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    sBrowserFuncs->memfree (npobj);
}

static bool
Entry_invokeDefault (NPObject *npobj,
                     const NPVariant *args, uint32_t argCount,
                     NPVariant *result)
{
#if __GNUC__
#define UNUSED __attribute__ ((unused))
#else
#define UNUSED
#endif
#define ARGN(aN) \
    int aN ## int UNUSED; \
    long aN ## long UNUSED; \
    ulong aN ## ulong UNUSED; \
    double aN ## double UNUSED; \
    stringz aN ## stringz UNUSED; \
    mpz_ptr aN ## mpz_ptr UNUSED; \
    mpq_ptr aN ## mpq_ptr UNUSED; \
    mpf_ptr aN ## mpf_ptr UNUSED; \
    mp_bitcnt_t aN ## mp_bitcnt_t UNUSED; \
    int_0_or_2_to_62 aN ## int_0_or_2_to_62 UNUSED; \
    int_2_to_62 aN ## int_2_to_62 UNUSED; \
    x_gmp_randstate_ptr aN ## x_gmp_randstate_ptr UNUSED

    ARGN(a0);
    ARGN(a1);
    ARGN(a2);
    ARGN(a3);
    ARGN(a4);

    switch (CONTAINING (Entry, npobj, npobj)->number) {

#define ENTRY1v(name, string, id, t0)                                   \
    case __LINE__:                                                      \
    if (argCount != 1                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        ) break;                                                        \
    name (a0 ## t0);                                                    \
    VOID_TO_NPVARIANT (*result);                                        \
    return true;

#define ENTRY1(name, string, id, rett, t0)                              \
    case __LINE__:                                                      \
    if (argCount != 1                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        ) break;                                                        \
    out_ ## rett (name (a0 ## t0), result);                             \
    return true;

#define ENTRY2v(name, string, id, t0, t1)                               \
    case __LINE__:                                                      \
    if (argCount != 2                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        ) break;                                                        \
    name (a0 ## t0, a1 ## t1);                                          \
    VOID_TO_NPVARIANT (*result);                                        \
    return true;

#define ENTRY2(name, string, id, rett, t0, t1)                          \
    case __LINE__:                                                      \
    if (argCount != 2                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        ) break;                                                        \
    out_ ## rett (name (a0 ## t0, a1 ## t1), result);                   \
    return true;

#define ENTRY3v(name, string, id, t0, t1, t2)                           \
    case __LINE__:                                                      \
    if (argCount != 3                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        || !in_ ## t2 (&args[2], &a2 ## t2)                             \
        ) break;                                                        \
    name (a0 ## t0, a1 ## t1, a2 ## t2);                                \
    VOID_TO_NPVARIANT (*result);                                        \
    return true;

#define ENTRY3(name, string, id, rett, t0, t1, t2)                      \
    case __LINE__:                                                      \
    if (argCount != 3                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        || !in_ ## t2 (&args[2], &a2 ## t2)                             \
        ) break;                                                        \
    out_ ## rett (name (a0 ## t0, a1 ## t1, a2 ## t2), result);         \
    return true;

#define ENTRY4v(name, string, id, t0, t1, t2, t3)                       \
    case __LINE__:                                                      \
    if (argCount != 4                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        || !in_ ## t2 (&args[2], &a2 ## t2)                             \
        || !in_ ## t3 (&args[3], &a3 ## t3)                             \
        ) break;                                                        \
    name (a0 ## t0, a1 ## t1, a2 ## t2, a3 ## t3);                      \
    VOID_TO_NPVARIANT (*result);                                        \
    return true;

#define ENTRY4(name, string, id, rett, t0, t1, t2, t3)                  \
    case __LINE__:                                                      \
    if (argCount != 4                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        || !in_ ## t2 (&args[2], &a2 ## t2)                             \
        || !in_ ## t3 (&args[3], &a3 ## t3)                             \
        ) break;                                                        \
    out_ ## rett (name (a0 ## t0, a1 ## t1, a2 ## t2, a3 ## t3), result); \
    return true;

#define ENTRY5v(name, string, id, t0, t1, t2, t3, t4)                   \
    case __LINE__:                                                      \
    if (argCount != 5                                                   \
        || !in_ ## t0 (&args[0], &a0 ## t0)                             \
        || !in_ ## t1 (&args[1], &a1 ## t1)                             \
        || !in_ ## t2 (&args[2], &a2 ## t2)                             \
        || !in_ ## t3 (&args[3], &a3 ## t3)                             \
        || !in_ ## t4 (&args[4], &a4 ## t4)                             \
        ) break;                                                        \
    name (a0 ## t0, a1 ## t1, a2 ## t2, a3 ## t3, a4 ## t4);            \
    VOID_TO_NPVARIANT (*result);                                        \
    return true;

#include "gmp-entries.h"

    default:
        sBrowserFuncs->setexception (npobj, "internal error, bad entry number");
        return true;
    }

    sBrowserFuncs->setexception (npobj, "wrong type arguments");
    return true;
}

static NPClass Entry_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Entry_allocate,
    deallocate      : Entry_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    invokeDefault   : Entry_invokeDefault,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static void
Gmp_deallocate (NPObject *npobj)
{
    TopObject* top = CONTAINING (TopObject, npobjGmp, npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Gmp deallocate %p; %u\n", npobj, (unsigned int) top->npobjTop.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    sBrowserFuncs->releaseobject (&top->npobjTop);
}

static bool
Gmp_hasProperty(NPObject *npobj, NPIdentifier key)
{
    NPUTF8* name;
    bool ret;

    if (!sBrowserFuncs->identifierisstring (key))
        return false;

    name = sBrowserFuncs->utf8fromidentifier (key);
    ret = false
#define ENTRY(string, id) || !strcmp (string, name)
#include "gmp-entries.h"
#define CONSTANT(value, string, type) || !strcmp (string, name)
#include "gmp-constants.h"
        ;
    sBrowserFuncs->memfree (name);
    return ret;
}

static void
get_entry (NPObject *npobj, int number, NPVariant *result)
{
    NPP instance = CONTAINING (TopObject, npobjGmp, npobj)->instance;
    Entry* entry = (Entry*) sBrowserFuncs->createobject
        (instance, &Entry_npclass);

    if (entry) {
        entry->number = number;
        OBJECT_TO_NPVARIANT (&entry->npobj, *result);
    }
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
}

static void
get_constructor (TopObject* top, NPObject* ctor, NPVariant *result)
{
    if (ctor->referenceCount == 0)
        sBrowserFuncs->retainobject (&top->npobjTop);
    OBJECT_TO_NPVARIANT (sBrowserFuncs->retainobject (ctor), *result);
}

static bool
Gmp_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    NPUTF8* name;
    TopObject* top = CONTAINING (TopObject, npobjGmp, npobj);

    if (!sBrowserFuncs->identifierisstring (key))
        return false;

    name = sBrowserFuncs->utf8fromidentifier (key);

    if (false)
        name = name;  // Dummy branch to set up else-if sequence.

#define CTOR(string, id)                                \
    else if (!strcmp (string, name))                    \
        get_constructor (top, &top->id, result);
#define ENTRY(string, id)                       \
    else if (!strcmp (string, name))            \
        get_entry (npobj, __LINE__, result);
#include "gmp-entries.h"

#define CONSTANT(value, string, type)           \
    else if (!strcmp (string, name))            \
        out_ ## type (value, result);
#include "gmp-constants.h"

    else
        VOID_TO_NPVARIANT (*result);

    sBrowserFuncs->memfree (name);
    return true;
}

static bool
Gmp_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    uint32_t cnt = 0
#define ENTRY(string, id) +1
#include "gmp-entries.h"
#define CONSTANT(value, string, type) +1
#include "gmp-constants.h"
        ;
    *value = sBrowserFuncs->memalloc (cnt * sizeof (NPIdentifier*));
    *count = cnt;
    cnt = 0;
#define ENTRY(string, id)                                               \
    (*value)[cnt++] = sBrowserFuncs->getstringidentifier (string);
#include "gmp-entries.h"
#define CONSTANT(constval, string, type)                                \
    (*value)[cnt++] = sBrowserFuncs->getstringidentifier (string);
#include "gmp-constants.h"
    return true;
}

static NPClass Gmp_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : Gmp_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : Gmp_hasProperty,
    getProperty     : Gmp_getProperty,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : Gmp_enumerate
};

static NPObject*
TopObject_allocate (NPP instance, NPClass *aClass)
{
    TopObject* ret = (TopObject*)
        sBrowserFuncs->memalloc (sizeof (TopObject));
#if DEBUG_ALLOC
    fprintf (stderr, "TopObject allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        memset (ret, '\0', sizeof *ret);
        ret->instance = instance;
        ret->npobjGmp._class = &Gmp_npclass;
        ret->npobjMpz._class = &Mpz_npclass;
        ret->npobjMpq._class = &Mpq_npclass;
        ret->npobjMpq_numref._class = &Mpq_numref_npclass;
        ret->npobjMpq_denref._class = &Mpq_denref_npclass;
        ret->npobjMpf._class = &Mpf_npclass;
    }
    return &ret->npobjTop;
}

static void
TopObject_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "TopObject deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    sBrowserFuncs->memfree (npobj);
}

static bool
TopObject_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return key == sBrowserFuncs->getstringidentifier ("gmp");
}

static bool
TopObject_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    TopObject* top = (TopObject*) npobj;
    if (key == sBrowserFuncs->getstringidentifier ("gmp"))
        OBJECT_TO_NPVARIANT (sBrowserFuncs->retainobject (&top->npobjGmp),
                             *result);
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

static bool
TopObject_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *count = 1;
    *value = sBrowserFuncs->memalloc (sizeof (NPIdentifier*));
    (*value)[0] = sBrowserFuncs->getstringidentifier ("gmp");
    return true;
}

static NPClass TopObject_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : TopObject_allocate,
    deallocate      : TopObject_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : TopObject_hasProperty,
    getProperty     : TopObject_getProperty,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : TopObject_enumerate
};

static NPError
npp_New(NPMIMEType pluginType, NPP instance, uint16_t mode,
        int16_t argc, char* argn[], char* argv[], NPSavedData* saved)
{
    // Make this a windowless plug-in.  This makes Chrome happy.
    sBrowserFuncs->setvalue (instance, NPPVpluginWindowBool, (void*) false);
    instance->pdata = sBrowserFuncs->createobject (instance,
                                                   &TopObject_npclass);
    if (!instance->pdata)
        return NPERR_OUT_OF_MEMORY_ERROR;
    return NPERR_NO_ERROR;
}

static NPError
npp_Destroy(NPP instance, NPSavedData** save) {
    void* data = instance->pdata;
#if DEBUG_ALLOC
    fprintf (stderr, "npp_Destroy: pdata=%p\n", data);
#endif  /* DEBUG_ALLOC */
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

    ID_toString = sBrowserFuncs->getstringidentifier ("toString");

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
