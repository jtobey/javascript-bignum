/* browser (NPAPI) plug-in for multiple precision arithmetic.

   TO DO:

   * Document usage.

   * Why does this return undefined:
        var rs = gmp.randstate();
        gmp.gmp_randinit_lc_2exp_size(rs, 64);
        return gmp.gmp_urandomb_ui(rs, 100);

   * Reliable crash on reload test.html on FF 11 OOPP.  Retest and try
     to run plugin_container under Valgrind.

   * See comments at top of gmp-entries.h.

   * Online help: function arg names and doc strings in gmp-entries.h.

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

#if __GNUC__
#define UNUSED __attribute__ ((unused))
#define THREAD_LOCAL1 __thread
#else
#define UNUSED
#define THREAD_LOCAL1
#endif

#ifndef THREAD_LOCAL
#define THREAD_LOCAL THREAD_LOCAL1
#endif

#define STRINGIFY(x) STRINGIFY1(x)
#define STRINGIFY1(x) # x

#define CONTAINING(outer, member, member_ptr)                           \
    ((outer*) (((char*) member_ptr) - offsetof (outer, member)))


/*
 * Global constants.
 */

#ifndef NPGMP_PORTING
# define NPGMP_PORTING 1  /* Include dummy functions for ease of porting.  */
#endif
#ifndef NPGMP_MPQ
# define NPGMP_MPQ 1  /* Support rationals (mpq_t).  */
#endif
#ifndef NPGMP_MPF
# define NPGMP_MPF 1  /* Support floating-point numbers (mpf_t).  */
#endif
#ifndef NPGMP_RAND
# define NPGMP_RAND 1  /* Support random number generation.  */
#endif
#ifndef NPGMP_RTTI
# define NPGMP_RTTI 1  /* Provide mpz.isInstance, Entry.length, etc.  */
#endif
#ifndef NPGMP_SCRIPT
# define NPGMP_SCRIPT 1  /* Provide script interpreter.  */
#endif

#define PLUGIN_NAME        "GMP Arithmetic Library"
#define PLUGIN_DESCRIPTION PLUGIN_NAME " (EXPERIMENTAL)"
#define PLUGIN_VERSION     "0.1.0.0"

static NPNetscapeFuncs* sBrowserFuncs;

#define NPN_SetException(npobj, msg)  sBrowserFuncs->setexception (npobj, msg)
#define NPN_CreateObject(npp, aClass) sBrowserFuncs->createobject (npp, aClass)
#define NPN_RetainObject(npobj)       sBrowserFuncs->retainobject (npobj)
#define NPN_ReleaseObject(npobj)      sBrowserFuncs->releaseobject (npobj)
#define NPN_MemAlloc(size)            sBrowserFuncs->memalloc (size)
#define NPN_MemFree(ptr)              sBrowserFuncs->memfree (ptr)
#define NPN_IdentifierIsString(id)    sBrowserFuncs->identifierisstring (id)
#define NPN_UTF8FromIdentifier(id)    sBrowserFuncs->utf8fromidentifier (id)
#define NPN_GetStringIdentifier(name) sBrowserFuncs->getstringidentifier (name)
#define NPN_IntFromIdentifier(id)     sBrowserFuncs->intfromidentifier (id)
#define NPN_GetIntIdentifier(intid)   sBrowserFuncs->getintidentifier (intid)
#define NPN_SetValue(npp, var, value) sBrowserFuncs->setvalue (npp, var, value)
#define NPN_ReleaseVariantValue(var)  sBrowserFuncs->releasevariantvalue (var)

#define NPN_GetProperty(npp, obj, propertyName, result) \
    sBrowserFuncs->getproperty (npp, obj, propertyName, result)

#define NPN_InvokeDefault(npp, obj, args, argCount, result) \
    sBrowserFuncs->invokeDefault (npp, obj, args, argCount, result)

static NPIdentifier ID_toString;
/* XXX Let's do valueOf, too. */


/*
 * Top-level per-instance structure.
 */

#define GET_TOP(__class, __object)                                      \
    CONTAINING (TopObject, npclass ## __class, (__object)->_class)

typedef struct _TopObject {
    NPObject    npobj;
    NPP         instance;
    bool        destroying;
    const char* errmsg;
    NPClass     npclassGmp;
    NPObject    npobjGmp;
#define Gmp_getTop(object) CONTAINING (TopObject, npobjGmp, object)
    NPClass     npclassEntry;
#define Entry_getTop(object) GET_TOP (Entry, object)
    NPClass     npclassTuple;
#define Tuple_getTop(object) GET_TOP (Tuple, object)
    NPClass     npclassInteger;
#define Integer_getTop(object) GET_TOP (Integer, object)

#if NPGMP_MPQ
    NPClass     npclassMpzRef;
#define MpzRef_getTop(object) GET_TOP (MpzRef, object)
    NPClass     npclassRational;
#define Rational_getTop(object) GET_TOP (Rational, object)
#endif

#if NPGMP_RAND
    NPClass     npclassRand;
#define Rand_getTop(object) GET_TOP (Rand, object)
#endif

#if NPGMP_MPF
    NPClass     npclassFloat;
#define Float_getTop(object) GET_TOP (Float, object)
    mp_bitcnt_t default_mpf_prec;  /* Emulate mpf_set_default_prec. */
#endif

#if NPGMP_SCRIPT
#if 0
    NPClass     npclassThread;
#define Thread_getTop(object) GET_TOP (Thread, object)
#endif
    NPClass     npclassRun;  // XXX will go away
    NPObject    npobjRun;    // XXX will go away
#define Run_getTop(object) CONTAINING (TopObject, npobjRun, object)
#endif

} TopObject;


/*
 * Argument conversion.
 */

typedef unsigned long ulong;
typedef char const* stringz;

#define PARSE_UNSIGNED(top, type, arg, start, end)                      \
    do {                                                                \
        TopObject* t = (top);                                           \
        type* a = (arg);                                                \
        const NPUTF8* s = (start);                                      \
        const NPUTF8* e = (end);                                        \
                                                                        \
        if (s == e) {                                                   \
            t->errmsg = "invalid " #type;                               \
            return false;                                               \
        }                                                               \
        *a = 0;                                                         \
        while (s < e) {                                                 \
            if (*s < '0' || *s > '9') {                                 \
                t->errmsg = "invalid " #type;                           \
                return false;                                           \
            }                                                           \
            /* XXX should check for overflow.  */                       \
            *a *= 10;                                                   \
            *a += *s++ - '0';                                           \
        }                                                               \
    } while (0)

#define DEFINE_IN_NUMBER(type)                                          \
    static bool UNUSED                                                  \
    in_ ## type (TopObject* top, const NPVariant* var, type* arg)       \
    {                                                                   \
        if (NPVARIANT_IS_INT32 (*var) &&                                \
            NPVARIANT_TO_INT32 (*var) == (type) NPVARIANT_TO_INT32 (*var)) \
            *arg = (type) NPVARIANT_TO_INT32 (*var);                    \
                                                                        \
        else if (NPVARIANT_IS_DOUBLE (*var) &&                          \
            NPVARIANT_TO_DOUBLE (*var) == (type) NPVARIANT_TO_DOUBLE (*var)) \
            *arg = (type) NPVARIANT_TO_DOUBLE (*var);                   \
                                                                        \
        else if (NPVARIANT_IS_STRING (*var)) {                          \
            int sign = 1;                                               \
            NPString str = NPVARIANT_TO_STRING (*var);                  \
            const char* start = str.UTF8Characters;                     \
            const char* end = start + str.UTF8Length;                   \
            if (start < end && *start == '-') {                         \
                sign = -1;                                              \
                start++;                                                \
            }                                                           \
            PARSE_UNSIGNED (top, type, arg, start, end);                \
            *arg *= sign;                                               \
        }                                                               \
        else {                                                          \
            top->errmsg = "invalid " #type;                             \
            return false;                                               \
        }                                                               \
        return true;                                                    \
    }

#define DEFINE_IN_UNSIGNED(type)                                        \
    static bool UNUSED                                                  \
    in_ ## type (TopObject* top, const NPVariant* var, type* arg)       \
    {                                                                   \
        if (NPVARIANT_IS_INT32 (*var) && NPVARIANT_TO_INT32 (*var) >= 0 && \
            NPVARIANT_TO_INT32 (*var) == (type) NPVARIANT_TO_INT32 (*var)) \
            *arg = (type) NPVARIANT_TO_INT32 (*var);                    \
                                                                        \
        else if (NPVARIANT_IS_DOUBLE (*var) &&                          \
            NPVARIANT_TO_DOUBLE (*var) == (type) NPVARIANT_TO_DOUBLE (*var)) \
            *arg = (type) NPVARIANT_TO_DOUBLE (*var);                   \
                                                                        \
        else if (NPVARIANT_IS_STRING (*var)) {                          \
            NPString str = NPVARIANT_TO_STRING (*var);                  \
            const char* start = str.UTF8Characters;                     \
            const char* end = start + str.UTF8Length;                   \
            PARSE_UNSIGNED (top, type, arg, start, end);                \
        }                                                               \
        else {                                                          \
            top->errmsg = "invalid " #type;                             \
            return false;                                               \
        }                                                               \
        return true;                                                    \
    }

DEFINE_IN_NUMBER (int)
DEFINE_IN_NUMBER (long)
DEFINE_IN_UNSIGNED (ulong)
DEFINE_IN_UNSIGNED (size_t)

#define del_int(arg)
#define del_long(arg)
#define del_ulong(arg)
#define del_size_t(arg)

static bool
in_double (TopObject* top, const NPVariant* var, double* arg)
{
    if (NPVARIANT_IS_DOUBLE (*var))
        *arg = NPVARIANT_TO_DOUBLE (*var);
    else if (NPVARIANT_IS_INT32 (*var))
        *arg = (double) NPVARIANT_TO_INT32 (*var);
    else {
        top->errmsg = "not a number";
        return false;
    }
    return true;
}

#define del_double(arg)

/* Chrome does not terminate its NPString with NUL.  Cope.  */

static bool
in_stringz (TopObject* top, const NPVariant* var, stringz* arg)
{
    const NPString* npstr;
    NPUTF8* str;

    if (!NPVARIANT_IS_STRING (*var)) {
        top->errmsg = "not a string";
        return false;
    }
    npstr = &NPVARIANT_TO_STRING (*var);
    str = (NPUTF8*) NPN_MemAlloc (npstr->UTF8Length + 1);
    if (!str) {
        top->errmsg = "out of memory";
        return false;
    }
    *arg = str;
    strncpy (str, npstr->UTF8Characters, npstr->UTF8Length);
    str[npstr->UTF8Length] = '\0';
    return true;
}

static void
del_stringz (stringz arg)
{
    NPN_MemFree ((char*) arg);
}

static void UNUSED
del_npstring (NPString arg)
{
    NPN_MemFree ((char*) arg.UTF8Characters);
}

/*
 * Return value conversion.
 */

static bool
out_double (TopObject* top, double value, NPVariant* result)
{
    DOUBLE_TO_NPVARIANT (value, *result);
    return true;
}

#define DEFINE_OUT_NUMBER(Type)                                         \
    static bool UNUSED                                                  \
    out_ ## Type (TopObject* top, Type value, NPVariant* result)        \
    {                                                                   \
        if (value == (int32_t) value)                                   \
            INT32_TO_NPVARIANT (value, *result);                        \
        else if (value == (double) value)                               \
            DOUBLE_TO_NPVARIANT ((double) value, *result);              \
        else {                                                          \
            size_t len = 3 * sizeof (Type) + 2;                         \
            NPUTF8* ret = (NPUTF8*) NPN_MemAlloc (len);                 \
            if (ret) {                                                  \
                if (value >= 0)                                         \
                    len = sprintf (ret, "%lu", (ulong) value);          \
                else                                                    \
                    len = sprintf (ret, "%ld", (long) value);           \
                STRINGN_TO_NPVARIANT (ret, len, *result);               \
            }                                                           \
            else {                                                      \
                top->errmsg = "out of memory";                          \
                VOID_TO_NPVARIANT (*result);                            \
                return false;                                           \
            }                                                           \
        }                                                               \
        return true;                                                    \
    }

DEFINE_OUT_NUMBER(ulong)
DEFINE_OUT_NUMBER(long)
DEFINE_OUT_NUMBER(int)
DEFINE_OUT_NUMBER(size_t)

static bool
out_Bool (TopObject* top, int value, NPVariant* result)
{
    BOOLEAN_TO_NPVARIANT (value, *result);
    return true;
}
 
static bool
out_stringz (TopObject* top, stringz value, NPVariant* result)
{
    size_t len = strlen (value);
    NPUTF8* ret = (NPUTF8*) NPN_MemAlloc (len + 1);
    if (!ret) {
        top->errmsg = "out of memory";
        return false;
    }
    memcpy (ret, value, len + 1);
    STRINGN_TO_NPVARIANT (ret, len, *result);
    return true;
}

static bool UNUSED
out_npstring (TopObject* top, NPString value, NPVariant* result)
{
    bool ret = (value.UTF8Characters != 0 || value.UTF8Length == 0);
    if (ret)
        STRINGN_TO_NPVARIANT (value.UTF8Characters, value.UTF8Length, *result);
    else {
        VOID_TO_NPVARIANT (*result);
        top->errmsg = "out of memory";
    }
    return ret;
}

static bool
out_npobj (TopObject* top, NPObject* value, NPVariant* result)
{
    if (value)
        /* Caller retains. */
        OBJECT_TO_NPVARIANT (value, *result);
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

/*
 * Generic NPClass methods.
 */

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
    NPN_SetException (npobj, "read-only object");
    return true;
}

static bool
removeProperty_ro(NPObject *npobj, NPIdentifier name)
{
    NPN_SetException (npobj, "read-only object");
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

static void
obj_invalidate (NPObject *npobj)
{
#if DEBUG_ALLOC
    /*fprintf (stderr, "invalidate %p\n", npobj);*/
#endif  /* DEBUG_ALLOC */
}


/*
 * Tuple: array-like class for returning multiple values to JavaScript.
 */

typedef struct _Tuple {
    NPObject npobj;
    size_t nelts;
    NPVariant* array;
} Tuple;

static NPObject*
Tuple_allocate (NPP npp, NPClass *aClass)
{
    Tuple* ret = (Tuple*) NPN_MemAlloc (sizeof (Tuple));
#if DEBUG_ALLOC
    fprintf (stderr, "Tuple allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        ret->nelts = 0;
        ret->array = 0;
    }
    return &ret->npobj;
}

static NPVariant*
tuple_alloc (uint32_t size)
{
    NPVariant* ret;
    ret = (NPVariant*) NPN_MemAlloc (size * sizeof ret[0]);
    return ret;
}

static void
tuple_free (Tuple* tuple)
{
    size_t i;
#if DEBUG_ALLOC
    fprintf (stderr, "Tuple deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    for (i = tuple->nelts; i > 0; )
        NPN_ReleaseVariantValue (&tuple->array[--i]);
    if (tuple->array)
        NPN_MemFree (tuple->array);
}

static void
retain_for_js (Tuple* tuple)
{
}

static void
Tuple_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Tuple deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    tuple_free ((Tuple*) npobj);
    NPN_MemFree (npobj);
}

static int32_t
tuple_property_number (NPIdentifier key)
{
    if (NPN_IdentifierIsString (key)) {
        if (key == NPN_GetStringIdentifier ("length"))
            return -1;
        return -2;
    }
    return NPN_IntFromIdentifier (key);
}

static bool
Tuple_hasProperty(NPObject *npobj, NPIdentifier key)
{
    int32_t n = tuple_property_number (key);
    return n == -1 || n < ((Tuple*) npobj)->nelts;
}

static bool
copy_npvariant (NPObject* npobj, NPVariant* dest, const NPVariant* src)
{
    if (NPVARIANT_IS_STRING (*src)) {
        uint32_t len = NPVARIANT_TO_STRING (*src).UTF8Length;
        NPUTF8* s = (NPUTF8*) NPN_MemAlloc (len);
        if (!s) {
            NPN_SetException (npobj, "out of memory");
            return false;
        }
        memcpy (s, NPVARIANT_TO_STRING (*src).UTF8Characters, len);
        STRINGN_TO_NPVARIANT (s, len, *dest);
    }
    else {
        if (NPVARIANT_IS_OBJECT (*src))
            NPN_RetainObject (NPVARIANT_TO_OBJECT (*src));
        *dest = *src;
    }
    return true;
}

static bool
Tuple_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    Tuple* tuple = (Tuple*) npobj;
    int32_t number = tuple_property_number (key);

    if (number == -1)  /* length */
        INT32_TO_NPVARIANT (tuple->nelts, *result);
    else if (number < 0 || number >= tuple->nelts)
        VOID_TO_NPVARIANT (*result);
    else
        copy_npvariant (npobj, result, &tuple->array[number]);
    return true;
}

static bool
Tuple_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    Tuple* tuple = (Tuple*) npobj;
    uint32_t i;

    *count = tuple->nelts;
    *value = (NPIdentifier*) NPN_MemAlloc (*count * sizeof (NPIdentifier*));
    for (i = 0; i < tuple->nelts; i++)
        (*value)[i] = NPN_GetIntIdentifier (i);
    return true;
}

static Tuple*
make_tuple (TopObject* top, uint32_t size)
{
    Tuple* ret = (Tuple*) NPN_CreateObject (top->instance, &top->npclassTuple);
    if (ret) {
        ret->array = tuple_alloc (size);
        if (ret->array)
            ret->nelts = size;
        else {
            NPN_MemFree (ret);
            ret = 0;
        }
    }
    return ret;
}


/*
 * GMP-specific types.
 */

typedef int int_0_or_2_to_62;
typedef int int_2_to_62;
typedef int int_abs_2_to_62;
typedef int output_base;

/* XXX Should these set top->errmsg? */
static bool
in_int_0_or_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    return in_int (top, var, arg) &&
        (*arg == 0 || (*arg >= 2 && *arg <= 62));
}
#define del_int_0_or_2_to_62(arg)

static bool
in_int_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    return in_int (top, var, arg) && *arg >= 2 && *arg <= 62;
}
#define del_int_2_to_62(arg)

static bool
in_output_base (TopObject* top, const NPVariant* var, int* arg)
{
    return in_int (top, var, arg) &&
        ((*arg >= -36 && *arg <= -2) ||
         (*arg >= 2 && *arg <= 62));
}
#define del_output_base(arg)

#if NPGMP_MPF

static bool
in_int_abs_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    if (!in_int (top, var, arg))
        return false;
    int i = (*arg > 0 ? *arg : -*arg);
    return i >= 2 && i <= 62;
}
#define del_int_abs_2_to_62(arg)

#endif  /* NPGMP_MPF */

DEFINE_IN_UNSIGNED (mp_bitcnt_t)
DEFINE_OUT_NUMBER (mp_bitcnt_t)
#define del_mp_bitcnt_t(arg)

DEFINE_IN_UNSIGNED (mp_size_t)
DEFINE_OUT_NUMBER (mp_size_t)
#define del_mp_size_t(arg)

DEFINE_IN_UNSIGNED (mp_exp_t)
DEFINE_OUT_NUMBER (mp_exp_t)
#define del_mp_exp_t(arg)

DEFINE_IN_NUMBER (mp_limb_t)
DEFINE_OUT_NUMBER (mp_limb_t)
#define del_mp_limb_t(arg)

typedef mpz_ptr uninit_mpz;
typedef mpq_ptr uninit_mpq;
typedef mpf_ptr uninit_mpf;
typedef mpf_ptr defprec_mpf;
typedef x_gmp_randstate_ptr uninit_rand;

typedef struct _Integer {
    NPObject npobj;
    mpz_t mp;
} Integer;

#if NPGMP_MPQ
typedef struct _MpzRef {
    NPObject npobj;
    mpz_ptr mpp;
    NPObject* owner;  /* This Rational (mpq_t) owns *mpp.  */
} MpzRef;

typedef struct _Rational {
    NPObject npobj;
    mpq_t mp;
} Rational;
#endif  /* NPGMP_MPQ */

#if NPGMP_MPF
typedef struct _Float {
    NPObject npobj;
    mp_bitcnt_t oprec;
    mpf_t mp;
} Float;
#endif  /* NPGMP_MPF */

#if NPGMP_RAND
typedef struct _Rand {
    NPObject npobj;
    gmp_randstate_t state;
} Rand;
#endif  /* NPGMP_RAND */


/*
 * Integer objects wrap mpz_t.
 */

static NPObject*
Integer_allocate (NPP npp, NPClass *aClass)
{
    Integer* ret = (Integer*) NPN_MemAlloc (sizeof (Integer));
#if DEBUG_ALLOC
    fprintf (stderr, "Integer allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
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
    NPN_MemFree (npobj);
}

static bool
integer_toString (TopObject *top, mpz_ptr mpp, const NPVariant *args,
                  uint32_t argCount, NPVariant *result)
{
    int base = 0;

    if (argCount < 1)
        base = 10;

    else if (in_output_base (top, &args[0], &base)) {
        size_t len = mpz_sizeinbase (mpp, base) + 2;
        NPUTF8* s = (NPUTF8*) NPN_MemAlloc (len);
        if (s) {
            mpz_get_str (s, base, mpp);
            if (s[0] != '-')
                len--;
            STRINGN_TO_NPVARIANT (s, s[len-2] ? len-1 : len-2, *result);
        }
        else
            NPN_SetException (&top->npobj, "out of memory");
    }
    else
        NPN_SetException (&top->npobj, "invalid argument");
    return true;
}

static bool
Integer_invoke (NPObject *npobj, NPIdentifier name,
                const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Integer* z = (Integer*) npobj;
    if (name == ID_toString)
        return integer_toString (Integer_getTop (npobj),
                                 z->mp, args, argCount, result);
    return false;
}

static NPObject*
x_x_mpz (TopObject* top)
{
    NPObject* ret = NPN_CreateObject (top->instance, &top->npclassInteger);
    if (ret)
        mpz_init (&((Integer*) ret)->mp[0]);
    else
        NPN_SetException (&top->npobj, "out of memory");
    return ret;
}

#define x_mpz() x_x_mpz (vTop)

/*
 * Class of objects "returned" by the mpq_numref and mpq_denref macros.
 */

#if NPGMP_MPQ

static NPObject*
MpzRef_allocate (NPP npp, NPClass *aClass)
{
    MpzRef* ret = (MpzRef*) NPN_MemAlloc (sizeof (MpzRef));
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
        NPN_ReleaseObject (ref->owner);
    NPN_MemFree (npobj);
}

static bool
MpzRef_invoke (NPObject *npobj, NPIdentifier name,
               const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    MpzRef* ref = (MpzRef*) npobj;
    if (name == ID_toString)
        return integer_toString (MpzRef_getTop (npobj),
                                 ref->mpp, args, argCount, result);
    return false;
}

static void
init_mpzref (MpzRef* ref, mpz_ptr z, mpq_ptr q)
{
    ref->mpp = z;
    ref->owner = NPN_RetainObject (&CONTAINING (Rational, mp[0], q)->npobj);
}

static NPObject*
x_x_mpq_ref (TopObject* top, mpz_ptr z, mpq_ptr q) {
    NPObject* ret = NPN_CreateObject (top->instance, &top->npclassMpzRef);

    if (ret)
        init_mpzref ((MpzRef*) ret, z, q);
    else
        NPN_SetException (&top->npobj, "out of memory");
    return ret;
}

#define x_mpq_numref(q) x_x_mpq_ref (vTop, mpq_numref (q), q)
#define x_mpq_denref(q) x_x_mpq_ref (vTop, mpq_denref (q), q)

#endif  /* NPGMP_MPQ */

/*
 * Integer argument conversion.
 */

static bool
in_mpz_ptr (TopObject* top, const NPVariant* var, mpz_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var))
        return false;
    if (NPVARIANT_TO_OBJECT (*var)->_class == &top->npclassInteger)
        *arg = &((Integer*) NPVARIANT_TO_OBJECT (*var))->mp[0];
#if NPGMP_MPQ
    else if (NPVARIANT_TO_OBJECT (*var)->_class == &top->npclassMpzRef)
        *arg = ((MpzRef*) NPVARIANT_TO_OBJECT (*var))->mpp;
#endif
    else
        return false;
    return true;
}

static bool
in_uninit_mpz (TopObject* top, const NPVariant* var, mpz_ptr* arg)
{
    bool ret = in_mpz_ptr (top, var, arg);
    if (ret)
        mpz_clear (*arg);
    return ret;
}

#define del_mpz_ptr(arg)
#define del_uninit_mpz(arg)

/*
 * Rational objects wrap mpq_t.
 */

#if NPGMP_MPQ

static NPObject*
Rational_allocate (NPP npp, NPClass *aClass)
{
    Rational* ret = (Rational*) NPN_MemAlloc (sizeof (Rational));
#if DEBUG_ALLOC
    fprintf (stderr, "Rational allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
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
    NPN_MemFree (npobj);
}

static bool
rational_toString (TopObject* top, mpq_ptr mpp, const NPVariant *args,
                   uint32_t argCount, NPVariant *result)
{
    int base = 0;

    if (argCount < 1 || !in_int (top, &args[0], &base))
        base = 10;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        size_t len = mpz_sizeinbase (mpq_numref (mpp), base)
            + mpz_sizeinbase (mpq_denref (mpp), base) + 3;
        NPUTF8* s = (NPUTF8*) NPN_MemAlloc (len);
        if (s) {
            mpq_get_str (s, base, mpp);
            STRINGN_TO_NPVARIANT (s, len-5 + strlen (s + len-5), *result);
        }
        else
            NPN_SetException (&top->npobj, "out of memory");
    }
    else
        NPN_SetException (&top->npobj, "invalid argument");
    return true;
}

static bool
Rational_invoke (NPObject *npobj, NPIdentifier name,
                 const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Rational* z = (Rational*) npobj;
    if (name == ID_toString)
        return rational_toString (Rational_getTop (npobj),
                                  z->mp, args, argCount, result);
    return false;
}

static bool
in_mpq_ptr (TopObject* top, const NPVariant* var, mpq_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &top->npclassRational)
        return false;
    *arg = &((Rational*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

static bool
in_uninit_mpq (TopObject* top, const NPVariant* var, mpq_ptr* arg)
{
    bool ret = in_mpq_ptr (top, var, arg);
    if (ret)
        mpq_clear (*arg);
    return ret;
}

#define del_mpq_ptr(arg)
#define del_uninit_mpq(arg)

static NPObject*
x_x_mpq (TopObject* top)
{
    NPObject* ret = NPN_CreateObject (top->instance, &top->npclassRational);
    if (ret)
        mpq_init (&((Rational*) ret)->mp[0]);
    else
        NPN_SetException (&top->npobj, "out of memory");
    return ret;
}

#define x_mpq() x_x_mpq (vTop)

#endif  /* NPGMP_MPQ */

/*
 * Float objects wrap mpf_t.
 */

#if NPGMP_MPF

static NPObject*
Float_allocate (NPP npp, NPClass *aClass)
{
    Float* ret = (Float*) NPN_MemAlloc (sizeof (Float));
#if DEBUG_ALLOC
    fprintf (stderr, "Float allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
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
    NPN_MemFree (npobj);
}

static void
x_gmp_free (void *ptr, size_t size)
{
    void *(*alloc_func_ptr) (size_t);
    void *(*realloc_func_ptr) (void *, size_t, size_t);
    void (*free_func_ptr) (void *, size_t);

    mp_get_memory_functions (&alloc_func_ptr, &realloc_func_ptr,
                             &free_func_ptr);
    (*free_func_ptr) (ptr, size);
}

/* XXX toString should behave a little differently.  toExponential would
   be closer, but not exactly this.  */
static bool
float_toString (TopObject *top, mpf_ptr mpp, const NPVariant *args,
                uint32_t argCount, NPVariant *result)
{
    int base;
    size_t n_digits;
    mp_exp_t expt;
    char* str;
    size_t allocated;

    if (argCount < 1 || !in_int (top, args, &base))
        base = 10;

    if (argCount < 2 || !in_size_t (top, args + 1, &n_digits))
        n_digits = 0;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        NPUTF8* s;

        /* XXX could preallocate for n_digits != 0. */
        str = mpf_get_str (NULL, &expt, base, n_digits, mpp);
        if (!str) {
            NPN_SetException (&top->npobj, "out of memory");
            return true;
        }
        allocated = strlen (str) + 1;
        if (allocated == 1) {
            s = (NPUTF8*) NPN_MemAlloc (sizeof "0");
            if (s) {
                strcpy (s, "0");
                STRINGZ_TO_NPVARIANT (s, *result);
            }
            else
                NPN_SetException (&top->npobj, "out of memory");
        }
        else {
            size_t len = allocated + 4 + 3 * sizeof expt;
            size_t pos = 0;

            s = (NPUTF8*) NPN_MemAlloc (len);
            if (s) {
                if (str[pos] == '-') {
                    s[pos] = str[pos];
                    pos++;
                }
                sprintf (&s[pos], "%c.%se%ld", str[pos], str + pos + 1,
                         (long) expt - 1);
                STRINGZ_TO_NPVARIANT (s, *result);
            }
            else
                NPN_SetException (&top->npobj, "out of memory");
        }

        x_gmp_free (str, allocated);
    }
    else
        NPN_SetException (&top->npobj, "invalid base");
    return true;
}

static bool
Float_invoke (NPObject *npobj, NPIdentifier name,
              const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Float* z = (Float*) npobj;
    if (name == ID_toString)
        return float_toString (Float_getTop (npobj),
                               z->mp, args, argCount, result);
    return false;
}

static bool
in_mpf_ptr (TopObject* top, const NPVariant* var, mpf_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &top->npclassFloat)
        return false;
    *arg = &((Float*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

static void
restore_prec (mpf_ptr mpp)
{
    Float* f = CONTAINING (Float, mp[0], mpp);

    if (f->oprec) {
        mpf_set_prec_raw (mpp, f->oprec);
        f->oprec = 0;
    }
}

static bool
in_uninit_mpf (TopObject* top, const NPVariant* var, mpf_ptr* arg)
{
    bool ret = in_mpf_ptr (top, var, arg);

    if (ret) {
        restore_prec (*arg);
        mpf_clear (*arg);
    }
    return ret;
}

static mp_bitcnt_t
x_x_mpf_get_default_prec (TopObject* top)
{
    return top->default_mpf_prec ?: mpf_get_default_prec ();
}

#define x_mpf_get_default_prec() x_x_mpf_get_default_prec (vTop)

static void
x_x_mpf_set_default_prec (TopObject* top, mp_bitcnt_t prec)
{
    top->default_mpf_prec = (prec ?: 1);
}

#define x_mpf_set_default_prec(prec) x_x_mpf_set_default_prec (vTop, prec)

static void
x_x_mpf_init (TopObject* top, mpf_ptr f)
{
    if (top->default_mpf_prec)
        mpf_init2 (f, top->default_mpf_prec);
    else
        mpf_init (f);
}

static bool
x_in_defprec_mpf (TopObject* top, const NPVariant* var, mpf_ptr* arg)
{
    bool ret = in_uninit_mpf (top, var, arg);
    if (ret)
        x_x_mpf_init (top, *arg);
    return ret;
}

#define in_defprec_mpf(top, var, arg)     \
    x_in_defprec_mpf (top, var, arg)

#define del_mpf_ptr(arg)
#define del_uninit_mpf(arg)
#define del_defprec_mpf(arg)

static NPObject*
x_x_mpf (TopObject* top)
{
    NPObject* ret = NPN_CreateObject (top->instance, &top->npclassFloat);
    if (ret)
        x_x_mpf_init (top, &((Float*) ret)->mp[0]);
    else
        NPN_SetException (&top->npobj, "out of memory");
    return ret;
}

#define x_mpf() x_x_mpf (vTop)

#define x_mpf_init(f) x_x_mpf_init (vTop, f)

static void
x_mpf_clear (mpf_ptr f)
{
    mpf_init2 (f, 1);
}

static void
x_mpf_set_prec (mpf_ptr f, mp_bitcnt_t prec)
{
    restore_prec (f);
    mpf_set_prec (f, prec);
}

static void
x_mpf_set_prec_raw (mpf_ptr mpp, mp_bitcnt_t prec)
{
    Float* f = CONTAINING (Float, mp[0], mpp);

    if (!f->oprec)
        f->oprec = mpf_get_prec (mpp);
    if (prec <= f->oprec)
        mpf_set_prec_raw (mpp, prec);
}

static NPString
x_mpf_get_str (mp_exp_t* exp, int base, size_t n_digits, mpf_ptr f)
{
    char* str;
    size_t len;
    NPUTF8* s;
    NPString ret;

    /* XXX could preallocate the buffer for n_digits != 0. */
    str = mpf_get_str (NULL, exp, base, n_digits, f);
    if (str) {
        len = strlen (str);
        s = (NPUTF8*) NPN_MemAlloc (len);
        if (s || !len)
            memcpy (s, str, len);
    }
    else {
        /* Tell out_npstring to raise out-of-memory.  */
        len = 1;
        s = 0;
    }

    x_gmp_free (str, len + 1);
    ret.UTF8Length = len;
    ret.UTF8Characters = s;
    return ret;
}

#endif  /* NPGMP_MPF */

/*
 * Rand objects wrap gmp_randstate_t.
 */

#if NPGMP_RAND

static NPObject*
Rand_allocate (NPP npp, NPClass *aClass)
{
    Rand* ret = (Rand*) NPN_MemAlloc (sizeof (Rand));
#if DEBUG_ALLOC
    fprintf (stderr, "Rand allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    return &ret->npobj;
}

static void
Rand_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Rand deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    if (npobj)
        gmp_randclear (((Rand*) npobj)->state);
    NPN_MemFree (npobj);
}

static bool
in_x_gmp_randstate_ptr (TopObject* top, const NPVariant* var,
                        x_gmp_randstate_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &top->npclassRand)
        return false;
    *arg = &((Rand*) NPVARIANT_TO_OBJECT (*var))->state[0];
    return true;
}

static bool
in_uninit_rand (TopObject* top, const NPVariant* var, x_gmp_randstate_ptr* arg)
{
    bool ret = in_x_gmp_randstate_ptr (top, var, arg);
    if (ret)
        gmp_randclear (*arg);
    return ret;
}

#define del_x_gmp_randstate_ptr(arg)
#define del_uninit_rand(arg)

static NPObject*
x_x_randstate (TopObject* top)
{
    NPObject* ret = NPN_CreateObject (top->instance, &top->npclassRand);
    if (ret)
        gmp_randinit_default (&((Rand*) ret)->state[0]);
    else
        NPN_SetException (&top->npobj, "out of memory");
    return ret;
}

#define x_randstate() x_x_randstate (vTop)

static int
x_randinit_lc_2exp_size (uninit_rand state, mp_bitcnt_t size)
{
    int ret = gmp_randinit_lc_2exp_size (state, size);
    if (!ret)
        /* Rand_deallocate calls gmp_randclear, so must init.  */
        gmp_randinit_default (state);
    return ret;
}

#endif  /* NPGMP_RAND */

/*
 * Class of ordinary functions like mpz_init and mpz_add.
 */

typedef struct _Entry {
    NPObject npobj;
    int number;  /* unique ID; currently, a line number in gmp-entries.h */
} Entry;

static NPObject*
Entry_allocate (NPP npp, NPClass *aClass)
{
    Entry* ret = (Entry*) NPN_MemAlloc (sizeof (Entry));
#if DEBUG_ALLOC
    fprintf (stderr, "Entry allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        NPN_RetainObject (&CONTAINING (TopObject, npclassEntry, aClass)->npobj);
    return &ret->npobj;
}

static void
Entry_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Entry deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    TopObject* top = Entry_getTop (npobj);
    NPN_ReleaseObject (&top->npobj);
    NPN_MemFree (npobj);
}

static const char GmpProperties[] =

#define ENTRY(nargs, nret, string, id)    "\0" STRINGIFY(__LINE__) "|" string
#include "gmp-entries.h"

#define CONSTANT(constval, string, type)  "\0|" string
#include "gmp-constants.h"

    "\0";

static int
name_to_number (NPUTF8* name)
{
    const char* n;
    const char* p;

    n = &GmpProperties[1];
    while (*n) {
        p = strchr (n, '|') + 1;
        if (!strcmp (p, name))
            return atoi (n);
        n = p + strlen (p) + 1;
    }
    return -1;
}

static const char*
number_to_name (int number)
{
    const char* n;
    char buf[8];
    size_t len;

    if (number < 0 || number > 999999)
        return "GMP function";  /* should not happen */

    len = (size_t) sprintf (buf, "%d|", number);
    n = &GmpProperties[1];

    while (*n != '|') {
        if (!strncmp (n, buf, len))
            return n + len;
        n += strlen (n) + 1;
    }
    return 0;
}

enum Entry_number {

    FIRST_ENTRY =
#define ENTRY_GET_FIRST
#include "gmp-entries.h"

#define ENTRY(nargs, nret, string, id) , id = __LINE__
#include "gmp-entries.h"
};

static const unsigned char EntryNargs[] = {
#define ENTRY(nargs, nret, string, id) [__LINE__ - FIRST_ENTRY] = nargs,
#include "gmp-entries.h"
    0
};
static const unsigned char EntryNret[] = {
#define ENTRY(nargs, nret, string, id) [__LINE__ - FIRST_ENTRY] = nret,
#include "gmp-entries.h"
    0
};

static inline size_t
Entry_length (NPObject *npobj) {
    return EntryNargs[((Entry*) npobj)->number - FIRST_ENTRY];
}

static inline size_t
Entry_outLength (NPObject *npobj) {
    return EntryNret[((Entry*) npobj)->number - FIRST_ENTRY];
}

/* Calls to most functions go through wrap. */

static bool
wrap (TopObject *vTop, int vEntryNumber,
      const NPVariant *vArgs, uint32_t vArgCount, NPVariant *vResults)
{
    bool __ok = false, __ret = true;
    int vArgNumber = -1;
    int vRetNumber = -1;

    union {
        bool ABool;
        int Aint;
        long Along;
        ulong Aulong;
        double Adouble;
        stringz Astringz;
        mpz_ptr Ampz_ptr;
        mpq_ptr Ampq_ptr;
        mpf_ptr Ampf_ptr;
        x_gmp_randstate_ptr Ax_gmp_randstate_ptr;
        uninit_mpz Auninit_mpz;
        uninit_mpq Auninit_mpq;
        uninit_mpf Auninit_mpf;
        defprec_mpf Adefprec_mpf;
        uninit_rand Auninit_rand;
        mp_bitcnt_t Amp_bitcnt_t;
        int Aint_0_or_2_to_62;
        int Aint_2_to_62;
        int Aint_abs_2_to_62;
        int Aoutput_base;
        mp_size_t Amp_size_t;
        mp_exp_t Amp_exp_t;
        mp_limb_t Amp_limb_t;
        size_t Asize_t;
        NPObject* Anpobj;
        NPString Anpstring;
    } a0, a1, a2, a3, a4, o0, o1;

#define ARGC(argc)                                      \
    if ((argc) != vArgCount) {                          \
        vTop->errmsg = "wrong number of arguments";     \
        break;                                          \
    }

#define IN(a, t)                                                        \
    (vArgNumber++, in_ ## t (vTop, vArgs + vArgNumber, &a.A ## t))

#define OUT(o, t)                                                       \
    (vRetNumber++, out_ ## t (vTop, o.A ## t, vResults + vRetNumber))

#define DEL(a, t) del_ ## t (a.A ## t)

    switch (vEntryNumber) {

#define ENTRY0R1(fun, string, id, r0)                           \
        case __LINE__:                                          \
            ARGC(0);                                            \
            o0.A ## r0 = fun ();                                \
            if (!OUT (o0, r0)) break;                           \
            __ok = true;                                        \
            break;

#define ENTRY1R0(fun, string, id, t0)                           \
        case __LINE__:                                          \
            ARGC(1);                                            \
            if (!IN (a0, t0)) break;                            \
            fun (a0.A ## t0);                                   \
            __ok = true;                                        \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY1R1(fun, string, id, r0, t0)                       \
        case __LINE__:                                          \
            ARGC(1);                                            \
            if (!IN (a0, t0)) break;                            \
            o0.A ## r0 = fun (a0.A ## t0);                      \
            if (!OUT (o0, r0)) goto dela0_ ## id;               \
            __ok = true;                                        \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY1R2(fun, string, id, r0, r1, t0)                   \
        case __LINE__:                                          \
            ARGC(1);                                            \
            if (!IN (a0, t0)) break;                            \
            o0.A ## r0 = fun (&o1.A ## r1, a0.A ## t0);         \
            if (!OUT (o0, r0)) goto dela0_ ## id;               \
            if (!OUT (o1, r1)) goto delo0_ ## id;               \
            __ok = true;                                        \
            dela0_ ## id: DEL (a0, t0);                         \
            break;                                              \
            delo0_ ## id: DEL (o0, r0);                         \
            goto dela0_ ## id;

#define ENTRY2R0(fun, string, id, t0, t1)                       \
        case __LINE__:                                          \
            ARGC(2);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            fun (a0.A ## t0, a1.A ## t1);                       \
            __ok = true;                                        \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY2R1(fun, string, id, r0, t0, t1)                   \
        case __LINE__:                                          \
            ARGC(2);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            o0.A ## r0 = fun (a0.A ## t0, a1.A ## t1);          \
            if (!OUT (o0, r0)) goto dela1_ ## id;               \
            __ok = true;                                        \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY3R0(fun, string, id, t0, t1, t2)                   \
        case __LINE__:                                          \
            ARGC(3);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            fun (a0.A ## t0, a1.A ## t1, a2.A ## t2);           \
            __ok = true;                                        \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY3R1(fun, string, id, r0, t0, t1, t2)               \
        case __LINE__:                                          \
            ARGC(3);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            o0.A ## r0 = fun                                    \
                (a0.A ## t0, a1.A ## t1, a2.A ## t2);           \
            if (!OUT (o0, r0)) goto dela2_ ## id;               \
            __ok = true;                                        \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY3R2(fun, string, id, r0, r1, t0, t1, t2)           \
        case __LINE__:                                          \
            ARGC(3);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            o0.A ## r0 = fun                                    \
                (&o1.A ## r1,                                   \
                 a0.A ## t0, a1.A ## t1, a2.A ## t2);           \
            if (!OUT (o0, r0)) goto dela2_ ## id;               \
            if (!OUT (o1, r1)) goto delo0_ ## id;               \
            __ok = true;                                        \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;                                              \
            delo0_ ## id: DEL (o0, r0);                         \
            goto dela2_ ## id;

#define ENTRY4R0(fun, string, id, t0, t1, t2, t3)               \
        case __LINE__:                                          \
            ARGC(4);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            if (!IN (a3, t3)) goto dela2_ ## id;                \
            fun (a0.A ## t0, a1.A ## t1, a2.A ## t2,            \
                 a3.A ## t3);                                   \
            __ok = true;                                        \
            dela3_ ## id: DEL (a3, t3);                         \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY4R1(fun, string, id, r0, t0, t1, t2, t3)           \
        case __LINE__:                                          \
            ARGC(4);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            if (!IN (a3, t3)) goto dela2_ ## id;                \
            o0.A ## r0 = fun                                    \
                (a0.A ## t0, a1.A ## t1, a2.A ## t2,            \
                 a3.A ## t3);                                   \
            if (!OUT (o0, r0)) goto dela3_ ## id;               \
            __ok = true;                                        \
            dela3_ ## id: DEL (a3, t3);                         \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#define ENTRY5R0(fun, string, id, t0, t1, t2, t3, t4)           \
        case __LINE__:                                          \
            ARGC(5);                                            \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto dela0_ ## id;                \
            if (!IN (a2, t2)) goto dela1_ ## id;                \
            if (!IN (a3, t3)) goto dela2_ ## id;                \
            if (!IN (a4, t4)) goto dela3_ ## id;                \
            fun (a0.A ## t0, a1.A ## t1, a2.A ## t2,            \
                 a3.A ## t3, a4.A ## t4);                       \
            __ok = true;                                        \
            dela4_ ## id: DEL (a4, t4);                         \
            dela3_ ## id: DEL (a3, t3);                         \
            dela2_ ## id: DEL (a2, t2);                         \
            dela1_ ## id: DEL (a1, t1);                         \
            dela0_ ## id: DEL (a0, t0);                         \
            break;

#include "gmp-entries.h"

    default:
        NPN_SetException (&vTop->npobj, "internal error, bad entry number");
        __ret = false;
    break;
    }

    if (!__ok) {
        static const char fmt[] = "%s: %s";
        char message[200];
        const char* name = number_to_name (vEntryNumber);
        const char* msg = vTop->errmsg ?: "unknown error";
        vTop->errmsg = 0;
        if (sizeof fmt - 4 + strlen (name) + strlen (msg) > sizeof message) {
            msg = "wrong type arguments";
            if (sizeof fmt - 4 + strlen (name) + strlen (msg) > sizeof message)
                name = "GMP function";
        }
        sprintf (message, fmt, name, msg);
        NPN_SetException (&vTop->npobj, message);
        __ret = false;
    }
    return __ret;
}

static bool
Entry_invokeDefault (NPObject *npobj,
                     const NPVariant *args, uint32_t argCount,
                     NPVariant *result)
{
    TopObject* top = Entry_getTop (npobj);
    size_t nret = Entry_outLength (npobj);
    Tuple* tuple = 0;  /* avoid a warning */
    NPVariant* out;

    if (nret <= 1)
        out = result;
    else {
        tuple = make_tuple (top, nret);
        if (!tuple) {
            NPN_SetException (&top->npobj, "out of memory");
            return true;
        }
        out = tuple->array;
    }

    if (!wrap (top, ((Entry*) npobj)->number, args, argCount, out))
        nret = 0;

    if (nret == 0)
        VOID_TO_NPVARIANT (*result);

    else if (nret > 1) {
        OBJECT_TO_NPVARIANT (&tuple->npobj, *result);
        retain_for_js (tuple);
    }

    return true;
}

#if NPGMP_RTTI

static NPClass*
ctor_to_class (NPObject *npobj)
{
    TopObject* top = Entry_getTop (npobj);
    int number = ((Entry*) npobj)->number;
    switch (number) {
    case np_mpz: return &top->npclassInteger;
    case np_mpq: return &top->npclassRational;
    case np_mpf: return &top->npclassFloat;
    case np_randstate: return &top->npclassRand;
    default: return 0;
    }
}

static bool
Entry_hasMethod(NPObject *npobj, NPIdentifier name)
{
    return ctor_to_class (npobj) != 0;
}

static bool
Entry_invoke (NPObject *npobj, NPIdentifier name,
              const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    TopObject* top = Entry_getTop (npobj);

    // XXX should implement isInstance as a property, not a method,
    // so it can be detached and used stand-alone.
    if (name == NPN_GetStringIdentifier ("isInstance")) {
        NPClass* c = ctor_to_class (npobj);

        if (c) {
            bool ret;

            if (argCount != 1) {
                NPN_SetException (npobj, "Usage: isInstance(OBJECT)");
                return true;
            }
            ret = NPVARIANT_IS_OBJECT (args[0]) &&
                (NPVARIANT_TO_OBJECT (args[0])->_class == c
#if NPGMP_MPQ
                 || (c == &top->npclassInteger &&
                     NPVARIANT_TO_OBJECT (args[0])->_class ==
                     &top->npclassMpzRef)
#endif
                 );
            BOOLEAN_TO_NPVARIANT (ret, *result);
            return true;
        }
    }
    else if (name == ID_toString) {
        const char* name = number_to_name (((Entry*) npobj)->number);
        const char format[] = "function %s() { [native code] }";
        size_t len = sizeof format + strlen (name) - 2;
        char* ret = (char*) NPN_MemAlloc (len);

        if (!ret) {
            NPN_SetException (npobj, "out of memory");
            return true;
        }
        sprintf (ret, format, name);
        STRINGN_TO_NPVARIANT (ret, len, *result);
        return true;
    }
    return false;
}

static bool
Entry_hasProperty(NPObject *npobj, NPIdentifier name)
{
    return name == NPN_GetStringIdentifier ("length")
        || name == NPN_GetStringIdentifier ("outLength");
}

static bool
Entry_getProperty(NPObject *npobj, NPIdentifier name, NPVariant* result)
{
    if (name == NPN_GetStringIdentifier ("length"))
        INT32_TO_NPVARIANT (Entry_length (npobj), *result);
    else if (name == NPN_GetStringIdentifier ("outLength"))
        INT32_TO_NPVARIANT (Entry_outLength (npobj), *result);
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

#endif  /* NPGMP_RTTI */

/*
 * Class of the "gmp" object.
 */

static void
Gmp_deallocate (NPObject *npobj)
{
    TopObject* top = Gmp_getTop (npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Gmp deallocate %p; %u\n", npobj, (unsigned int) top->npobj.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    NPN_ReleaseObject (&top->npobj);
}

static bool
Gmp_hasProperty (NPObject *npobj, NPIdentifier key)
{
    NPUTF8* name;
    int ret;

    if (!NPN_IdentifierIsString (key))
        return false;

    name = NPN_UTF8FromIdentifier (key);
    if (!name) {
        NPN_SetException (npobj, "out of memory");
        return false;
    }
    ret = name_to_number (name);
    NPN_MemFree (name);
    return ret >= 0;
}

static void
get_entry (NPObject *npobj, int number, NPVariant *result)
{
    TopObject* top = Gmp_getTop (npobj);

    Entry* entry = (Entry*) NPN_CreateObject
        (top->instance, &top->npclassEntry);

    if (entry) {
        entry->number = number;
        OBJECT_TO_NPVARIANT (&entry->npobj, *result);
    }
    else
        NPN_SetException (npobj, "out of memory");
}

static bool
Gmp_getProperty (NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    TopObject* top = Gmp_getTop (npobj);
    NPUTF8* name;
    int number;

    if (!NPN_IdentifierIsString (key)) {
        VOID_TO_NPVARIANT (*result);
        return true;
    }

    name = NPN_UTF8FromIdentifier (key);
    if (!name) {
        NPN_SetException (npobj, "out of memory");
        return true;
    }
    number = name_to_number (name);

    if (number < 0)
        VOID_TO_NPVARIANT (*result);
    else if (number > 0)
        get_entry (npobj, number, result);

#define CONSTANT(value, string, type)           \
    else if (!strcmp (string, name))            \
        out_ ## type (top, value, result);
#include "gmp-constants.h"

    NPN_MemFree (name);
    return true;
}

static bool
Gmp_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    const char* p;
    uint32_t cnt = 0
#define ENTRY(nargs, nret, string, id) +1
#include "gmp-entries.h"
#define CONSTANT(value, string, type) +1
#include "gmp-constants.h"
        ;
    *value = (NPIdentifier*) NPN_MemAlloc (cnt * sizeof (NPIdentifier*));
    *count = cnt;
    cnt = 0;
    for (p = &GmpProperties[1]; *p; p += strlen (p) + 1)
        (*value)[cnt++] = NPN_GetStringIdentifier (strchr (p, '|') + 1);
    return true;
}

#if NPGMP_SCRIPT

/*
 * Stack-based script support.
 */

#if 0
/* Optimize for optimizability only.  */

typedef struct _Heap {
    struct _Heap* newer;
    struct _Heap* older;
    size_t height;
    size_t size;         /* size in NPVariant structures */
    size_t largest;/* size of largest available block in this and older heaps */
    size_t avail;        /* total available in this and older heaps */
    size_t alloc_since_gc;
    NPVariant* end;      /* array end (start is end - size) */
    NPVariant* pointer;  /* point of allocation */
    unsigned char markbits[];
} Heap;

typedef struct _Thread {
    NPObject npobj;
    Heap* heap;
    size_t new_heap_size;  /* size in NPVariant structures */
    NPVariant* pc;
    NPVariant* pc_end;
    NPVariant* stack;
    NPVariant* stack_sp;
    NPVariant* stack_end;
    void* tls;             /* to be used with tsearch() */
} Thread;

static THREAD_LOCAL Thread* thread;

static NPVariant*
vector_alloc (uint32_t size)
{
    Heap* heap = thread->heap;
    NPVariant* ret;
    size_t avail, largest, alloc, max;

    for (Heap* heap = thread->heap; heap; heap = heap->older) {
        if (heap->largest < size)
            break;

        avail = heap->end - heap->pointer;

        if (avail >= size) {

            /* Success.  */
            ret = heap->pointer;
            heap->pointer += size;

            largest = heap->largest;
            if (largest < avail - size) {
                largest = avail - size;
                if (heap->older && heap->older->largest > largest)
                    largest = heap->older->largest;
            }

            for (; heap; heap = heap->newer) {
                if (heap->largest <= largest) {
                    if (heap->end - heap->pointer > largest)
                        largest = heap->end - heap->pointer;
                    heap->largest = largest;
                }
                heap->avail -= size;
            }

            thread->alloc_since_gc += size;
            return ret;
        }
    }

    /* XXX Must garbage-collect if appropriate.  */

    min = 1024;
    max = 1024*1024;
    alloc = thread->new_heap_size;

    if (alloc < min)
        alloc = thread->new_heap_size = min;
    if (alloc < size)
        alloc = size;

    heap = (Heap*) NPN_MemAlloc (sizeof *heap + ((alloc + 7) / 8));
    if (!heap)
        return 0;

    ret = (NPVariant*) NPN_MemAlloc (alloc * sizeof ret[0]);

    if (!ret) {
        NPN_MemFree (heap);
        return 0;
    }
    memset (ret, '\0', alloc * sizeof ret[0]);

    avail = alloc - size;
    largest = avail;
    if (thread->heap && thread->heap->largest > largest)
        largest = thread->heap->largest;

    heap->newer   = 0;
    heap->older   = thread->heap;
    if (heap->older)
        heap->older->newer = heap;
    heap->height  = (heap->older ? heap->older->height + 1 : 0);
    heap->size    = alloc;
    heap->largest = largest;
    heap->avail   = avail;
    heap->end     = ret + alloc;
    heap->pointer = ret + size;

    size = thread->new_heap_size * 4;
    if (size > max)
        size = max;
    thread->new_heap_size = size;

    return ret;
}

static NPObject*
Thread_allocate (NPP npp, NPClass *aClass)
{
    Thread* ret = (Thread*) NPN_MemAlloc (sizeof (Thread));
#if DEBUG_ALLOC
    fprintf (stderr, "Thread allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        memset (ret, '\0', sizeof *ret);
        NPN_RetainObject (&CONTAINING (TopObject, npclassThread, aClass)
                          ->npobj);
    }
    return &ret->npobj;
}

static void
Thread_deallocate (NPObject *npobj)
{
    Heap* heap;
#if DEBUG_ALLOC
    fprintf (stderr, "Thread deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */

    for (heap = ((Thread*) npobj)->heap; heap;) {
        for (NPVariant* v = heap->end - heap->size; v < heap->pointer; v++)
            NPN_ReleaseVariantValue (v);

        if (!heap->older) {
            NPN_MemFree (heap);
            break;
        }
        heap = heap->older;
        NPN_MemFree (heap->newer);
    }
    TopObject* top = Thread_getTop (npobj);
    NPN_ReleaseObject (&top->npobj);
    NPN_MemFree (npobj);
}

static int
compare_npstrings (const void* a1, const void* a2)
{
    const NPString* s1 = (const NPString*) a1;
    const NPString* s2 = (const NPString*) a2;
    uint32_t size = s1->UTF8Length;
    int ret;

    if (size > s2->UTF8Length)
        size = s2->UTF8Length;
    ret = memcmp (s1->UTF8Characters, s2->UTF8Characters, size);
    if (ret != 0)
        return ret;
    if (size < s1->UTF8Length)
        return 1;
    if (size < s2->UTF8Length)
        return -1;
    return 0;
}

static bool
Thread_hasProperty(NPObject *npobj, NPIdentifier name)
{
}

static bool
Thread_getProperty(NPObject *npobj, NPIdentifier name, NPVariant* result)
{
}
#endif

static void
obj_noop (NPObject *npobj)
{
}

enum Opcode {
#define OP(op) OP_ ## op = __LINE__,
#include "gmp-ops.h"
    OP_DATA
};

#define NUM_OPS OP_DATA

static NPObject Ops[NUM_OPS];

static enum Opcode
op_to_opcode (const NPObject* npobj)
{
    int ret = npobj - &Ops[0];
    if (ret >= 0 && ret < NUM_OPS)
        return ret;
    return OP_DATA;
}

static enum Opcode
var_to_opcode (const NPVariant *value)
{
    if (NPVARIANT_IS_OBJECT (*value))
        return op_to_opcode (NPVARIANT_TO_OBJECT (*value));
    return OP_DATA;
}

static const char OpNames[] = "|"
#define OP(op) # op "," STRINGIFY (__LINE__) "|"
#include "gmp-ops.h"
    ;

static int
id_to_opnum (NPObject *npobj, NPIdentifier key)
{
    char buf[16];
    NPUTF8* name;
    size_t len;
    const char* p = 0;
    int ret;

    if (!NPN_IdentifierIsString (key))
        return -1;

    name = NPN_UTF8FromIdentifier (key);
    if (!name) {
        NPN_SetException (npobj, "out of memory");
        return -2;
    }

    len = strlen (name);
    if (len + 3 <= sizeof buf) {
        buf[0] = '|';
        strncpy (&buf[1], name, len);
        buf[len+1] = ',';
        buf[len+2] = '\0';
        p = strstr (OpNames, buf);
    }

    if (p)
        ret = atoi (strchr (p, ',') + 1);
    else
        ret = -1;

    NPN_MemFree (name);
    return ret;
}

#if NPGMP_RTTI

static const char*
opcode_to_string (enum Opcode opcode, size_t* len)
{
    char buf[16];
    const char* p;
    size_t l;

    if (opcode < 0 || opcode >= NUM_OPS)
        return 0;
    sprintf (buf, ",%d|", (int) opcode);
    p = strstr (OpNames, buf);
    if (!p)
        return 0;  /* should not happen */
    for (l = 0; p[-1] != '|'; p--, l++)
        continue;
    *len = l;
    return p;
}

/* Give ops a toString method.  */
static bool
Op_invoke (NPObject *npobj, NPIdentifier name,
           const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    const char* s;
    char* ret;
    size_t len;

    if (name != ID_toString)
        return false;
    s = opcode_to_string (op_to_opcode (npobj), &len);
    if (!s)
        return false;  /* should not happen */
    ret = (char*) NPN_MemAlloc (len);
    memcpy (ret, s, len);
    STRINGN_TO_NPVARIANT (ret, len, *result);
    return true;
}

#endif  /* NPGMP_RTTI */

static NPClass Op_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : obj_noop,
    invalidate      : obj_invalidate,
#if NPGMP_RTTI
    hasMethod       : hasMethod_only_toString,
    invoke          : Op_invoke,
#else
    hasMethod       : obj_id_false,
#endif
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

/*
 * Class of the "run" object.
 */

static void
Run_deallocate (NPObject *npobj)
{
    TopObject* top = Run_getTop (npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Run deallocate %p; %u\n", npobj, (unsigned int) top->npobj.referenceCount);
#endif  /* DEBUG_ALLOC */
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    NPN_ReleaseObject (&top->npobj);
}

static bool
Run_hasMethod(NPObject *npobj, NPIdentifier name)
{
    return id_to_opnum (npobj, name) >= 0;
}

static bool
Run_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *count = 0;
    return true;  // XXX
    //*count = NUM_OPS;
}

static bool
Run_invoke (NPObject *npobj, NPIdentifier name,
            const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    int number;

    number = id_to_opnum (npobj, name);
    if (number < 0)
        return number < -1;
    /* if (argCount > 0) ...  should forbid arguments? */
    OBJECT_TO_NPVARIANT (&Ops[number], *result);
    return true;
}

static void
free_stack (NPVariant* stack, size_t size)
{
    for (size_t i = 0; i < size; i++)
        NPN_ReleaseVariantValue (&stack[i]);
    NPN_MemFree (stack);
}

static bool
extend (NPVariant** pstack, size_t* palloc, size_t init, size_t count)
{
    NPVariant* newStack;
    size_t want = init + count;

    if (want < init)
        return false;

    if (want > *palloc) {
        while (init >= *palloc) {
            if (*palloc * 2 < *palloc)
                return false;
            *palloc *= 2;
        }
        newStack = (NPVariant*) NPN_MemAlloc (*palloc * sizeof newStack[0]);
        if (!newStack)
            return false;
        memcpy (newStack, *pstack, init * sizeof newStack[0]);
        NPN_MemFree (*pstack);
        *pstack = newStack;
    }
    return true;
}

/* Run a script represented as function arguments.  */

static bool
Run_invokeDefault (NPObject* npobj,
                   const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    TopObject* top = Run_getTop (npobj);
    size_t alloc = 8;
    size_t init = 0;
    enum Opcode opcode;
    NPObject* fun;
    bool isEntry;
    size_t nargs;
    NPVariant* stack;
    NPVariant temp;
    size_t temp_size;
    size_t index;
    Tuple* temp_tuple;
    bool ok;

    stack = (NPVariant*) NPN_MemAlloc (alloc * sizeof stack[0]);
    if (!stack) {
        NPN_SetException (npobj, "out of memory");
        return true;
    }

    for (;; argCount--, args++) {
        if (!argCount) {
            if (init == 0)
                VOID_TO_NPVARIANT (*result);
            else if (init == 1)
                *result = stack[--init];
            else
                NPN_SetException (npobj, "tuple return unsupported");
            break;
        }

        opcode = var_to_opcode (&args[0]);
        switch (opcode) {

        case OP_pick:
            if (init < 1 || !in_size_t (top, &stack[init-1], &temp_size) ||
                temp_size >= init - 1) {
                /* XXX should report a few script+stack elts. */
                NPN_SetException (npobj, "script error");
                goto done;
            }
            NPN_ReleaseVariantValue (&stack[--init]);
            if (!copy_npvariant (npobj, &stack[init],
                                 &stack[init - temp_size - 1]))
                goto done;
            init++;
            continue;

        case OP_roll:
            if (init < 1 || !in_size_t (top, &stack[init-1], &temp_size) ||
                temp_size >= init - 1) {
                /* XXX should report a few script+stack elts. */
                NPN_SetException (npobj, "script error");
                goto done;
            }
            NPN_ReleaseVariantValue (&stack[--init]);
            index = init - 1 - temp_size;
            temp = stack[index];
            memmove (&stack[index], &stack[index + 1],
                     temp_size * sizeof stack[0]);
            stack[init - 1] = temp;
            continue;

        case OP_drop:
            if (init < 1) {
                /* XXX should report a few script+stack elts. */
                NPN_SetException (npobj, "stack underflow");
                goto done;
            }
            NPN_ReleaseVariantValue (&stack[--init]);
            continue;

        case OP_dump:
            temp_tuple = make_tuple (top, init);
            if (!temp_tuple) {
                NPN_SetException (npobj, "out of memory");
                goto done;
            }
            memcpy (temp_tuple->array, stack, init * sizeof stack[0]);
            OBJECT_TO_NPVARIANT (&temp_tuple->npobj, stack[0]);
            init = 1;
            continue;

        case OP_DATA:
            // Push data.
            if (!extend (&stack, &alloc, init, 1)) {
                NPN_SetException (npobj, "out of memory");
                break;
            }
            if (!copy_npvariant (npobj, &stack[init], &args[0]))
                break;
            init++;
            continue;

        case OP_call:
            break;
        }

        if (init < 1) {
            /* XXX should report a few script+stack elts. */
            NPN_SetException (npobj, "stack underflow");
            goto done;
        }

        if (!NPVARIANT_IS_OBJECT (stack[init-1])) {
            /* XXX should report a few script+stack elts. */
            NPN_SetException (npobj, "not a function");
            break;
        }

        fun = NPVARIANT_TO_OBJECT (stack[init-1]);
        NPN_ReleaseVariantValue (&stack[--init]);
        isEntry = (fun->_class == &top->npclassEntry);
        ok = false;

        if (isEntry) {
            nargs = Entry_length (fun);
            ok = true;
        }
        else if (NPN_GetProperty (top->instance, fun,
                                  NPN_GetStringIdentifier ("length"), &temp)) {
            ok = in_size_t (top, &temp, &nargs);
            NPN_ReleaseVariantValue (&temp);
        }

        if (!ok) {
            /* XXX should report a few script+stack elts. */
            NPN_SetException (npobj, "can not find function arity");
            break;
        }

        if (nargs > init) {
            /* XXX should report a few script+stack elts. */
            NPN_SetException (npobj, "stack underflow");
            break;
        }

        VOID_TO_NPVARIANT (temp);

        if (isEntry)
            Entry_invokeDefault (fun, &stack[init - nargs], nargs, &temp);
        else if (!NPN_InvokeDefault (top->instance, fun, &stack[init - nargs],
                                     nargs, &temp)) {
            /* XXX should report a few script+stack elts. */
            NPN_SetException (npobj, "call failed");
            break;
        }

        /* XXX How can I know whether setexception was used?  Modify
           it in sBrowserFuncs?  */

        while (nargs--)
            NPN_ReleaseVariantValue (&stack[--init]);

        if (isEntry)
            nargs = Entry_outLength (fun);
        else
            nargs = 1;

        if (nargs == 0)
            continue;

        if (!extend (&stack, &alloc, init, nargs)) {
            NPN_SetException (npobj, "out of memory");
            break;
        }
        if (nargs == 1)
            stack[init++] = temp;
        else {
            temp_tuple = (Tuple*) NPVARIANT_TO_OBJECT (temp);
            memcpy (&stack[init], temp_tuple->array, nargs * sizeof stack[0]);
            init += nargs;
            memset (temp_tuple->array, '\0', nargs * sizeof stack[0]);
            NPN_ReleaseObject (&temp_tuple->npobj);
        }
    }
    done:
    free_stack (stack, init);
    return true;
}

static void
init_script ()
{
    for (size_t i = 0; i < NUM_OPS; i++) {
        Ops[i]._class = &Op_npclass;
        Ops[i].referenceCount = 0x7fffffff;
    }
}

#endif  /* NPGMP_SCRIPT */

/*
 * Class of the top-level <embed> object exposed to scripts through the DOM.
 */

static NPObject*
TopObject_allocate (NPP instance, NPClass *aClass)
{
    TopObject* ret = (TopObject*) NPN_MemAlloc (sizeof (TopObject));
#if DEBUG_ALLOC
    fprintf (stderr, "TopObject allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */

    if (ret) {
        memset (ret, '\0', sizeof *ret);

        ret->instance                        = instance;

        ret->npclassGmp.structVersion       = NP_CLASS_STRUCT_VERSION;
        ret->npclassGmp.deallocate          = Gmp_deallocate;
        ret->npclassGmp.invalidate          = obj_invalidate;
        ret->npclassGmp.hasMethod           = obj_id_false;
        ret->npclassGmp.hasProperty         = Gmp_hasProperty;
        ret->npclassGmp.getProperty         = Gmp_getProperty;
        ret->npclassGmp.setProperty         = setProperty_ro;
        ret->npclassGmp.removeProperty      = removeProperty_ro;
        ret->npclassGmp.enumerate           = Gmp_enumerate;

        ret->npobjGmp._class                 = &ret->npclassGmp;

#if NPGMP_SCRIPT
        ret->npclassRun.structVersion       = NP_CLASS_STRUCT_VERSION;
        ret->npclassRun.deallocate          = Run_deallocate;
        ret->npclassRun.invalidate          = obj_invalidate;
        ret->npclassRun.hasMethod           = Run_hasMethod;
        ret->npclassRun.invoke              = Run_invoke;
        ret->npclassRun.invokeDefault       = Run_invokeDefault;
        ret->npclassRun.hasProperty         = obj_id_false;
        ret->npclassRun.getProperty         = obj_id_var_void;
        ret->npclassRun.setProperty         = setProperty_ro;
        ret->npclassRun.removeProperty      = removeProperty_ro;
        ret->npclassRun.enumerate           = Run_enumerate;

        ret->npobjRun._class                 = &ret->npclassRun;
#endif

        ret->npclassEntry.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->npclassEntry.allocate          = Entry_allocate;
        ret->npclassEntry.deallocate        = Entry_deallocate;
        ret->npclassEntry.invalidate        = obj_invalidate;
        ret->npclassEntry.invokeDefault     = Entry_invokeDefault;
#if NPGMP_RTTI
        ret->npclassEntry.hasMethod         = Entry_hasMethod;
        ret->npclassEntry.invoke            = Entry_invoke;
        ret->npclassEntry.hasProperty       = Entry_hasProperty;
        ret->npclassEntry.getProperty       = Entry_getProperty;
#else
        ret->npclassEntry.hasMethod         = obj_id_false;
        ret->npclassEntry.hasProperty       = obj_id_false;
        ret->npclassEntry.getProperty       = obj_id_var_void;
#endif
        ret->npclassEntry.setProperty       = setProperty_ro;
        ret->npclassEntry.removeProperty    = removeProperty_ro;
        ret->npclassEntry.enumerate         = enumerate_empty;

        ret->npclassTuple.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->npclassTuple.allocate          = Tuple_allocate;
        ret->npclassTuple.deallocate        = Tuple_deallocate;
        ret->npclassTuple.invalidate        = obj_invalidate;
        ret->npclassTuple.hasMethod         = obj_id_false;
        ret->npclassTuple.hasProperty       = Tuple_hasProperty;
        ret->npclassTuple.getProperty       = Tuple_getProperty;
        ret->npclassTuple.setProperty       = setProperty_ro;
        ret->npclassTuple.removeProperty    = removeProperty_ro;
        ret->npclassTuple.enumerate         = Tuple_enumerate;

        ret->npclassInteger.structVersion   = NP_CLASS_STRUCT_VERSION;
        ret->npclassInteger.allocate        = Integer_allocate;
        ret->npclassInteger.deallocate      = Integer_deallocate;
        ret->npclassInteger.invalidate      = obj_invalidate;
        ret->npclassInteger.hasMethod       = hasMethod_only_toString;
        ret->npclassInteger.invoke          = Integer_invoke;
        ret->npclassInteger.hasProperty     = obj_id_false;
        ret->npclassInteger.getProperty     = obj_id_var_void;
        ret->npclassInteger.setProperty     = setProperty_ro;
        ret->npclassInteger.removeProperty  = removeProperty_ro;
        ret->npclassInteger.enumerate       = enumerate_empty;

#if NPGMP_MPQ
        ret->npclassMpzRef.structVersion    = NP_CLASS_STRUCT_VERSION;
        ret->npclassMpzRef.allocate         = MpzRef_allocate;
        ret->npclassMpzRef.deallocate       = MpzRef_deallocate;
        ret->npclassMpzRef.invalidate       = obj_invalidate;
        ret->npclassMpzRef.hasMethod        = hasMethod_only_toString;
        ret->npclassMpzRef.invoke           = MpzRef_invoke;
        ret->npclassMpzRef.hasProperty      = obj_id_false;
        ret->npclassMpzRef.getProperty      = obj_id_var_void;
        ret->npclassMpzRef.setProperty      = setProperty_ro;
        ret->npclassMpzRef.removeProperty   = removeProperty_ro;
        ret->npclassMpzRef.enumerate        = enumerate_empty;

        ret->npclassRational.structVersion  = NP_CLASS_STRUCT_VERSION;
        ret->npclassRational.allocate       = Rational_allocate;
        ret->npclassRational.deallocate     = Rational_deallocate;
        ret->npclassRational.invalidate     = obj_invalidate;
        ret->npclassRational.hasMethod      = hasMethod_only_toString;
        ret->npclassRational.invoke         = Rational_invoke;
        ret->npclassRational.hasProperty    = obj_id_false;
        ret->npclassRational.getProperty    = obj_id_var_void;
        ret->npclassRational.setProperty    = setProperty_ro;
        ret->npclassRational.removeProperty = removeProperty_ro;
        ret->npclassRational.enumerate      = enumerate_empty;
#endif  /* NPGMP_MPQ */

#if NPGMP_RAND
        ret->npclassRand.structVersion      = NP_CLASS_STRUCT_VERSION;
        ret->npclassRand.allocate           = Rand_allocate;
        ret->npclassRand.deallocate         = Rand_deallocate;
        ret->npclassRand.invalidate         = obj_invalidate;
        ret->npclassRand.hasMethod          = obj_id_false;
        ret->npclassRand.hasProperty        = obj_id_false;
        ret->npclassRand.getProperty        = obj_id_var_void;
        ret->npclassRand.setProperty        = setProperty_ro;
        ret->npclassRand.removeProperty     = removeProperty_ro;
        ret->npclassRand.enumerate          = enumerate_empty;
#endif  /* NPGMP_RAND */

#if NPGMP_MPF
        ret->npclassFloat.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->npclassFloat.allocate          = Float_allocate;
        ret->npclassFloat.deallocate        = Float_deallocate;
        ret->npclassFloat.invalidate        = obj_invalidate;
        ret->npclassFloat.hasMethod         = hasMethod_only_toString;
        ret->npclassFloat.invoke            = Float_invoke;
        ret->npclassFloat.hasProperty       = obj_id_false;
        ret->npclassFloat.getProperty       = obj_id_var_void;
        ret->npclassFloat.setProperty       = setProperty_ro;
        ret->npclassFloat.removeProperty    = removeProperty_ro;
        ret->npclassFloat.enumerate         = enumerate_empty;

        ret->default_mpf_prec                = 0;
#endif
    }
    return &ret->npobj;
}

static void
TopObject_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "TopObject deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */

#if 0
    if (((TopObject*) npobj)->destroying) {
#if DEBUG_ALLOC
        fprintf (stderr, "TopObject deallocate %p: skipping free\n", npobj);
#endif  /* DEBUG_ALLOC */
        return;
    }
#endif

    NPN_MemFree (npobj);
}

static bool
TopObject_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return key == NPN_GetStringIdentifier ("gmp")
#if NPGMP_SCRIPT
        || key == NPN_GetStringIdentifier ("run")
#endif
        ;
}

static bool
TopObject_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    TopObject* top = (TopObject*) npobj;
    NPObject* ret = 0;

    if (key == NPN_GetStringIdentifier ("gmp"))
        ret = &top->npobjGmp;

#if NPGMP_SCRIPT
    else if (key == NPN_GetStringIdentifier ("run"))
        ret = &top->npobjRun;
#endif

    if (ret) {
        if (!ret->referenceCount)
            NPN_RetainObject (npobj);
        OBJECT_TO_NPVARIANT (NPN_RetainObject (ret), *result);
    }
    else
        VOID_TO_NPVARIANT (*result);

    return true;
}

static bool
TopObject_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    uint32_t cnt = 1
#if NPGMP_SCRIPT
        + 1
#endif
        ;
    *count = cnt;
    *value = (NPIdentifier*) NPN_MemAlloc (cnt * sizeof (NPIdentifier*));
    if (!*value)
        return false;
    (*value)[0] = NPN_GetStringIdentifier ("gmp");
#if NPGMP_SCRIPT
    (*value)[1] = NPN_GetStringIdentifier ("run");
#endif
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

/*
 * NPAPI plug-in entry points.
 */

static NPError
npp_New(NPMIMEType pluginType, NPP instance, uint16_t mode,
        int16_t argc, char* argn[], char* argv[], NPSavedData* saved)
{
    /* Make this a windowless plug-in.  This makes Chrome happy.  */
    NPN_SetValue (instance, NPPVpluginWindowBool, (void*) false);

    /* Create the instance's top-level scriptable <embed> object.  */
    instance->pdata = NPN_CreateObject (instance, &TopObject_npclass);
    if (!instance->pdata)
        return NPERR_OUT_OF_MEMORY_ERROR;
    return NPERR_NO_ERROR;
}

static NPError
npp_Destroy(NPP instance, NPSavedData** save) {
    TopObject* top = (TopObject*) instance->pdata;
#if DEBUG_ALLOC
    fprintf (stderr, "npp_Destroy: pdata=%p\n", top);
#endif  /* DEBUG_ALLOC */
    instance->pdata = 0;
    if (top) {
        NPN_ReleaseObject (&top->npobj);
        top->destroying = true;
    }
    return NPERR_NO_ERROR;
}

static NPError
npp_GetValue(NPP instance, NPPVariable variable, void *value) {
    TopObject* top = (TopObject*) instance->pdata;
    switch (variable) {
    case NPPVpluginScriptableNPObject:
        if (top) {
            *((NPObject**)value) = NPN_RetainObject (&top->npobj);
            break;
        }
        // FALL THROUGH
    default:
        return NPERR_GENERIC_ERROR;
    }
    return NPERR_NO_ERROR;
}

NP_EXPORT(NPError)
NP_Initialize(NPNetscapeFuncs* bFuncs, NPPluginFuncs* pFuncs)
{
    sBrowserFuncs = bFuncs;

    /* Check the size of the provided structure based on the offset of the
       last member we need.  */
    if (pFuncs->size < (offsetof(NPPluginFuncs, getvalue) + sizeof(void*)))
        return NPERR_INVALID_FUNCTABLE_ERROR;

    pFuncs->newp = npp_New;
    pFuncs->destroy = npp_Destroy;
    pFuncs->getvalue = npp_GetValue;

    ID_toString = NPN_GetStringIdentifier ("toString");

#if NPGMP_SCRIPT
    init_script ();
#endif

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
