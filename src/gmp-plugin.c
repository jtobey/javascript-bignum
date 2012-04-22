/* browser (NPAPI) plug-in for multiple precision arithmetic.

   TO DO:

   * Expose settable "prototype" objects to be used for getProperty on
     Integer, MpzRef, Rational, Float, and perhaps Rand.

   * Consider implementing setProperty and removeProperty on various
     objects, changing them from read-only to read-write.

   * Consider making *_init* functions perform *_clear before init,
     rather than create a new object.  And think again about how to
     create new objects.

   * See list in gmp-entries.h.

   * Document usage.

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

/*
 * Global constants.
 */

#define PLUGIN_NAME        "GMP Arithmetic Library"
#define PLUGIN_DESCRIPTION PLUGIN_NAME " (EXPERIMENTAL)"
#define PLUGIN_VERSION     "0.0.0.0"

static NPNetscapeFuncs* sBrowserFuncs = NULL;

static NPIdentifier ID_toString;

typedef struct _TopObject {
    NPObject npobjTop;
    NPP instance;
    NPObject npobjGmp;
    NPClass Entry_npclass;
} TopObject;

#define CONTAINING(outer, member, member_ptr)                           \
    ((outer*) (((char*) member_ptr) - offsetof (outer, member)))

#if __GNUC__
#define UNUSED __attribute__ ((unused))
#else
#define UNUSED
#endif

/*
 * Argument conversion.
 */

typedef unsigned long ulong;
typedef char const* stringz;

#define DEFINE_IN_NUMBER(type)                                          \
    static bool                                                         \
    in_ ## type (const NPVariant* var, int count, type* arg) UNUSED;    \
    static bool                                                         \
    in_ ## type (const NPVariant* var, int count, type* arg)            \
    {                                                                   \
        if (count < 1)                                                  \
            return false;                                               \
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
    static bool                                                         \
    in_ ## type (const NPVariant* var, int count, type* arg) UNUSED;    \
    static bool                                                         \
    in_ ## type (const NPVariant* var, int count, type* arg)            \
    {                                                                   \
        if (count < 1)                                                  \
            return false;                                               \
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
DEFINE_IN_UNSIGNED (size_t)

#define del_int(arg)
#define del_long(arg)
#define del_ulong(arg)
#define del_size_t(arg)

static bool
in_double (const NPVariant* var, int count, double* arg)
{
    if (count < 1)
        return false;
    if (NPVARIANT_IS_DOUBLE (*var))
        *arg = NPVARIANT_TO_DOUBLE (*var);
    else if (NPVARIANT_IS_INT32 (*var))
        *arg = (double) NPVARIANT_TO_INT32 (*var);
    else
        return false;
    return true;
}

#define del_double(arg)

/* Chrome does not terminate its NPString with NUL.  Cope.  */

static bool
in_stringz (const NPVariant* var, int count, stringz* arg)
{
    const NPString* npstr;
    NPUTF8* str;

    if (count < 1 || !NPVARIANT_IS_STRING (*var))
        return false;
    npstr = &NPVARIANT_TO_STRING (*var);
    str = sBrowserFuncs->memalloc (npstr->UTF8Length + 1);
    if (!str)
        return false;  // XXX Should throw.
    *arg = str;
    strncpy (str, npstr->UTF8Characters, npstr->UTF8Length);
    str[npstr->UTF8Length] = '\0';
    return true;
}

static void
del_stringz (stringz arg)
{
    sBrowserFuncs->memfree ((char*) arg);
}

/*
 * Return value conversion.
 */

#define out_void(value, result)                                 \
    do { value; VOID_TO_NPVARIANT (*result); } while (0)

#define out_noconv(value, result) value

static void
out_double (double value, NPVariant* result)
{
    DOUBLE_TO_NPVARIANT (value, *result);
}

#define DEFINE_OUT_NUMBER(type)                                         \
    static void                                                         \
    out_ ## type (type value, NPVariant* result) UNUSED;                \
    static void                                                         \
    out_ ## type (type value, NPVariant* result)                        \
    {                                                                   \
        if (value == (int32_t) value)                                   \
            INT32_TO_NPVARIANT (value, *result);                        \
        else if (value == (double) value)                               \
            DOUBLE_TO_NPVARIANT ((double) value, *result);              \
        else {                                                          \
            size_t len = 3 * sizeof (type) + 2;                         \
            NPUTF8* ret = (NPUTF8*) sBrowserFuncs->memalloc (len);      \
            if (ret) {                                                  \
                if (value >= 0)                                         \
                    len = sprintf (ret, "%lu", (ulong) value);          \
                else                                                    \
                    len = sprintf (ret, "%ld", (long) value);           \
                STRINGN_TO_NPVARIANT (ret, len, *result);               \
            }                                                           \
            else                                                        \
                /* XXX Should make this throw. */                       \
                VOID_TO_NPVARIANT (*result);                            \
        }                                                               \
    }

DEFINE_OUT_NUMBER(ulong)
DEFINE_OUT_NUMBER(long)
DEFINE_OUT_NUMBER(int)
DEFINE_OUT_NUMBER(size_t)

static void
out_bool (int value, NPVariant* result)
{
    BOOLEAN_TO_NPVARIANT (value, *result);
}

static void
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

#define OUT_NEW(value, result)                                          \
    do {                                                                \
        value;                                                          \
        sBrowserFuncs->retainobject (NPVARIANT_TO_OBJECT (*result));    \
    } while (0)

#define ENTRY_TO_TOP(entry) CONTAINING (TopObject, Entry_npclass, entry->_class)

#define DEFINE_OBJECT_TYPE(ctor, name, type, field)                     \
    static bool                                                         \
    ctor (NPObject* entry, NPVariant* result, type* arg)                \
    {                                                                   \
        TopObject* top = ENTRY_TO_TOP (entry);                          \
        name* ret = (name*) sBrowserFuncs->createobject                 \
            (top->instance, &name ## _npclass);                         \
                                                                        \
        if (!ret) {                                                     \
            sBrowserFuncs->setexception (entry, "out of memory");       \
            return false;                                               \
        }                                                               \
        OBJECT_TO_NPVARIANT (&ret->npobj, *result);                     \
        *arg = &ret->field;                                             \
        return true;                                                    \
    }                                                                   \
                                                                        \
    static void                                                         \
    del_ ## ctor (type arg)                                             \
    {                                                                   \
        sBrowserFuncs->releaseobject                                    \
            (&CONTAINING (name, field, arg)->npobj);                    \
    }

static void
out_npobj (NPObject* value, NPVariant* result)
{
    if (value)
        /* Caller retains. */
        OBJECT_TO_NPVARIANT (value, *result);
    else
        VOID_TO_NPVARIANT (*result);
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
    /*fprintf (stderr, "invalidate %p\n", npobj);*/
#endif  /* DEBUG_ALLOC */
}

/*
 * Pair: array-like class for returning two values.
 * Probably a better way is to get the real Array constructor from
 * NPN_GetValue, but this will do for starters.
 */

typedef struct _Pair {
    NPObject npobj;
    NPVariant array[2];
} Pair;

static NPObject*
Pair_allocate (NPP npp, NPClass *aClass)
{
    Pair* ret = (Pair*) sBrowserFuncs->memalloc (sizeof (Pair));
#if DEBUG_ALLOC
    fprintf (stderr, "Pair allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        VOID_TO_NPVARIANT (ret->array[0]);
        VOID_TO_NPVARIANT (ret->array[1]);
    }
    return &ret->npobj;
}

static void
free_npvariant (NPVariant* var)
{
    if (NPVARIANT_IS_STRING (*var))
        sBrowserFuncs->memfree
            ((NPUTF8*) NPVARIANT_TO_STRING (*var).UTF8Characters);
    else if (NPVARIANT_IS_OBJECT (*var))
        sBrowserFuncs->releaseobject (NPVARIANT_TO_OBJECT (*var));
}

static void
Pair_deallocate (NPObject *npobj)
{
    Pair* pair = (Pair*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "Pair deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    free_npvariant (&pair->array[0]);
    free_npvariant (&pair->array[1]);
    sBrowserFuncs->memfree (npobj);
}

static int32_t
pair_property_number (NPIdentifier key)
{
    int32_t n;

    if (sBrowserFuncs->identifierisstring (key)) {
        if (key == sBrowserFuncs->getstringidentifier ("length"))
            return 2;
        return -1;
    }
    n = sBrowserFuncs->intfromidentifier (key);
    if (n == 0 || n == 1)
        return n;
    return -1;
}

static bool
Pair_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return pair_property_number (key) != -1;
}

static bool
copy_npvariant (NPObject* npobj, NPVariant* dest, NPVariant* src)
{
    if (NPVARIANT_IS_STRING (*src)) {
        uint32_t len = NPVARIANT_TO_STRING (*src).UTF8Length;
        NPUTF8* s = sBrowserFuncs->memalloc (len);
        if (!s) {
            sBrowserFuncs->setexception (npobj, "out of memory");
            return false;
        }
        memcpy (s, NPVARIANT_TO_STRING (*src).UTF8Characters, len);
        STRINGN_TO_NPVARIANT (s, len, *dest);
    }
    else {
        if (NPVARIANT_IS_OBJECT (*src))
            sBrowserFuncs->retainobject (NPVARIANT_TO_OBJECT (*src));
        *dest = *src;
    }
    return true;
}

static bool
Pair_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    Pair* pair = (Pair*) npobj;
    int32_t number = pair_property_number (key);

    switch (number) {
    case -1:  /* no such property */
        VOID_TO_NPVARIANT (*result);
        return true;
    case 2:   /* length */
        INT32_TO_NPVARIANT (2, *result);
        return true;
    default:  /* 0 or 1 */
        return copy_npvariant (npobj, result, &pair->array[number]);
    }
}

static bool
Pair_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *value = sBrowserFuncs->memalloc (3 * sizeof (NPIdentifier*));
    *count = 3;
    (*value)[0] = sBrowserFuncs->getintidentifier (0);
    (*value)[1] = sBrowserFuncs->getintidentifier (1);
    (*value)[2] = sBrowserFuncs->getstringidentifier ("length");
    return true;
}

static NPClass Pair_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Pair_allocate,
    deallocate      : Pair_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : Pair_hasProperty,
    getProperty     : Pair_getProperty,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : Pair_enumerate
};

typedef struct _Integer {
    NPObject npobj;
    mpz_t mp;
} Integer;

typedef struct _MpzRef {
    NPObject npobj;
    mpz_ptr mpp;
    NPObject* owner;  /* This Rational (mpq_t) owns *mpp.  */
} MpzRef;

typedef struct _Rational {
    NPObject npobj;
    mpq_t mp;
} Rational;

typedef struct _Float {
    NPObject npobj;
    mpf_t mp;
} Float;

typedef struct _Rand {
    NPObject npobj;
    gmp_randstate_t state;
} Rand;

/*
 * Integer objects wrap mpz_t.
 */

static NPObject*
Integer_allocate (NPP npp, NPClass *aClass)
{
    Integer* ret = (Integer*) sBrowserFuncs->memalloc (sizeof (Integer));
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
    sBrowserFuncs->memfree (npobj);
}

static bool
integer_toString (NPObject *npobj, mpz_ptr mpp, const NPVariant *args,
                  uint32_t argCount, NPVariant *result)
{
    int base = 0;

    if (!in_int (&args[0], argCount, &base))
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

static bool
Integer_invoke (NPObject *npobj, NPIdentifier name,
                const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Integer* z = (Integer*) npobj;
    if (name == ID_toString)
        return integer_toString (npobj, z->mp, args, argCount, result);
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

DEFINE_OBJECT_TYPE (new_mpz, Integer, mpz_ptr, mp[0])
#define in_new_mpz(var, count, arg) IN_NEW (new_mpz, arg)
#define out_new_mpz OUT_NEW

/*
 * GMP-specific scalar types.
 */

typedef int int_0_or_2_to_62;
typedef int int_2_to_62;
typedef int int_abs_2_to_62;

static bool
in_int_0_or_2_to_62 (const NPVariant* var, int count, int* arg)
{
    return in_int (var, count, arg) && (*arg == 0 || (*arg >= 2 && *arg <= 62));
}
#define del_int_0_or_2_to_62(arg)

static bool
in_int_2_to_62 (const NPVariant* var, int count, int* arg)
{
    return in_int (var, count, arg) && *arg >= 2 && *arg <= 62;
}
#define del_int_2_to_62(arg)

static bool
in_int_abs_2_to_62 (const NPVariant* var, int count, int* arg)
{
    int i = (*arg > 0 ? *arg : -*arg);
    return in_int (var, count, arg) && i >= 2 && i <= 62;
}
#define del_int_abs_2_to_62(arg)

DEFINE_IN_UNSIGNED (mp_bitcnt_t)
DEFINE_OUT_NUMBER (mp_bitcnt_t)
#define del_mp_bitcnt_t(arg)

DEFINE_IN_UNSIGNED (mp_size_t)
DEFINE_OUT_NUMBER (mp_size_t)
#define del_mp_size_t(arg)

DEFINE_IN_UNSIGNED (mp_exp_t)
DEFINE_OUT_NUMBER (mp_exp_t)
#define del_mp_exp_t(arg)

DEFINE_OUT_NUMBER (mp_limb_t)

/*
 * Class of objects "returned" by the mpq_numref and mpq_denref macros.
 */

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
        return integer_toString (npobj, ref->mpp, args, argCount, result);
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

DEFINE_OBJECT_TYPE (new_mpzref, MpzRef, mpz_ptr*, mpp)
#define in_new_mpzref(var, count, arg) IN_NEW (new_mpzref, arg)
#define out_new_mpzref OUT_NEW

static void x_mpq_numref (mpz_ptr* zp, mpq_ptr q) {
    MpzRef* ref = CONTAINING (MpzRef, mpp, zp);
    Rational* rat = CONTAINING (Rational, mp[0], q);
    *zp = &mpq_numref (q)[0];
    ref->owner = sBrowserFuncs->retainobject (&rat->npobj);
}
static void x_mpq_denref (mpz_ptr* zp, mpq_ptr q) {
    MpzRef* ref = CONTAINING (MpzRef, mpp, zp);
    Rational* rat = CONTAINING (Rational, mp[0], q);
    *zp = &mpq_denref (q)[0];
    ref->owner = sBrowserFuncs->retainobject (&rat->npobj);
}

/*
 * Integer argument conversion.
 */

static bool
in_mpz_ptr (const NPVariant* var, int count, mpz_ptr* arg)
{
    if (count < 1 || !NPVARIANT_IS_OBJECT (*var))
        return false;
    if (NPVARIANT_TO_OBJECT (*var)->_class == &Integer_npclass)
        *arg = &((Integer*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    else if (NPVARIANT_TO_OBJECT (*var)->_class == &MpzRef_npclass)
        *arg = ((MpzRef*) NPVARIANT_TO_OBJECT (*var))->mpp;
    else
        return false;
    return true;
}

#define del_mpz_ptr(arg)

static NPObject*
z_get_d_2exp (NPObject* entry, mpz_ptr z)
{
    TopObject* top = ENTRY_TO_TOP (entry);
    Pair* ret = (Pair*)
        sBrowserFuncs->createobject (top->instance, &Pair_npclass);
    long exp;

    if (!ret) {
        sBrowserFuncs->setexception (entry, "out of memory");
        return entry;  /* any object that is handy */
    }
    DOUBLE_TO_NPVARIANT (mpz_get_d_2exp (&exp, z), ret->array[0]);
    out_long (exp, &ret->array[1]);
    return &ret->npobj;
}

#define x_mpz_get_d_2exp(z) z_get_d_2exp (vEntry, z)

/*
 * Rational objects wrap mpq_t.
 */

static NPObject*
Rational_allocate (NPP npp, NPClass *aClass)
{
    Rational* ret = (Rational*) sBrowserFuncs->memalloc (sizeof (Rational));
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
    sBrowserFuncs->memfree (npobj);
}

static bool
rational_toString (NPObject *npobj, mpq_ptr mpp, const NPVariant *args,
                   uint32_t argCount, NPVariant *result)
{
    int base = 0;

    if (!in_int (&args[0], argCount, &base))
        base = 10;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        size_t len = mpz_sizeinbase (mpq_numref (mpp), base)
            + mpz_sizeinbase (mpq_denref (mpp), base) + 3;
        NPUTF8* s = sBrowserFuncs->memalloc (len);
        if (s) {
            mpq_get_str (s, base, mpp);
            STRINGN_TO_NPVARIANT (s, len-5 + strlen (s + len-5), *result);
        }
        else
            sBrowserFuncs->setexception (npobj, "out of memory");
    }
    else
        sBrowserFuncs->setexception (npobj, "invalid argument");
    return true;
}

static bool
Rational_invoke (NPObject *npobj, NPIdentifier name,
                 const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Rational* z = (Rational*) npobj;
    if (name == ID_toString)
        return rational_toString (npobj, z->mp, args, argCount, result);
    sBrowserFuncs->setexception (npobj, "no such method");
    return true;
}

static NPClass Rational_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Rational_allocate,
    deallocate      : Rational_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : hasMethod_only_toString,
    invoke          : Rational_invoke,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_only_toString
};

static bool
in_mpq_ptr (const NPVariant* var, int count, mpq_ptr* arg)
{
    if (count < 1 || !NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &Rational_npclass)
        return false;
    *arg = &((Rational*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

#define del_mpq_ptr(arg)

DEFINE_OBJECT_TYPE (new_mpq, Rational, mpq_ptr, mp[0])
#define in_new_mpq(var, count, arg) IN_NEW (new_mpq, arg)
#define out_new_mpq OUT_NEW

/*
 * Float objects wrap mpf_t.
 */

static NPObject*
Float_allocate (NPP npp, NPClass *aClass)
{
    Float* ret = (Float*) sBrowserFuncs->memalloc (sizeof (Float));
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
    sBrowserFuncs->memfree (npobj);
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
float_toString (NPObject *npobj, mpf_ptr mpp, const NPVariant *args,
                uint32_t argCount, NPVariant *result)
{
    int base;
    size_t n_digits;
    mp_exp_t expt;
    char* str;
    size_t allocated;

    if (in_int (args, argCount, &base)) {
        args++;
        argCount--;
    }
    else
        base = 10;

    if (!in_size_t (args, argCount, &n_digits))
        n_digits = 0;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        NPUTF8* s;

        /* XXX could preallocate for n_digits != 0. */
        str = mpf_get_str (NULL, &expt, base, n_digits, mpp);
        if (!str) {
            sBrowserFuncs->setexception (npobj, "out of memory");
            return true;
        }
        allocated = strlen (str) + 1;
        if (allocated == 1) {
            s = sBrowserFuncs->memalloc (sizeof "0");
            if (s) {
                strcpy (s, "0");
                STRINGZ_TO_NPVARIANT (s, *result);
            }
            else
                sBrowserFuncs->setexception (npobj, "out of memory");
        }
        else {
            size_t len = allocated + 4 + 3 * sizeof expt;
            size_t pos = 0;

            s = sBrowserFuncs->memalloc (len);
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
                sBrowserFuncs->setexception (npobj, "out of memory");
        }

        x_gmp_free (str, allocated);
    }
    else
        sBrowserFuncs->setexception (npobj, "invalid base");
    return true;
}

static bool
Float_invoke (NPObject *npobj, NPIdentifier name,
              const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Float* z = (Float*) npobj;
    if (name == ID_toString)
        return float_toString (npobj, z->mp, args, argCount, result);
    sBrowserFuncs->setexception (npobj, "no such method");
    return true;
}

static NPClass Float_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Float_allocate,
    deallocate      : Float_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : hasMethod_only_toString,
    invoke          : Float_invoke,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_only_toString
};

static bool
in_mpf_ptr (const NPVariant* var, int count, mpf_ptr* arg)
{
    if (count < 1 || !NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &Float_npclass)
        return false;
    *arg = &((Float*) NPVARIANT_TO_OBJECT (*var))->mp[0];
    return true;
}

#define del_mpf_ptr(arg)

DEFINE_OBJECT_TYPE (new_mpf, Float, mpf_ptr, mp[0])
#define in_new_mpf(var, count, arg) IN_NEW (new_mpf, arg)
#define out_new_mpf OUT_NEW

static NPObject*
f_get_d_2exp (NPObject* entry, mpf_ptr f)
{
    TopObject* top = ENTRY_TO_TOP (entry);
    Pair* ret = (Pair*)
        sBrowserFuncs->createobject (top->instance, &Pair_npclass);
    long exp;

    if (!ret) {
        sBrowserFuncs->setexception (entry, "out of memory");
        return entry;  /* any object that is handy */
    }
    DOUBLE_TO_NPVARIANT (mpf_get_d_2exp (&exp, f), ret->array[0]);
    out_long (exp, &ret->array[1]);
    return &ret->npobj;
}

#define x_mpf_get_d_2exp(f) f_get_d_2exp (vEntry, f)

static NPObject*
f_get_str (NPObject* entry, int base, size_t n_digits, mpf_ptr f)
{
    TopObject* top = ENTRY_TO_TOP (entry);
    Pair* ret = (Pair*)
        sBrowserFuncs->createobject (top->instance, &Pair_npclass);
    mp_exp_t exp;
    char* str;
    size_t len;
    NPUTF8* s;

    if (!ret) {
        sBrowserFuncs->setexception (entry, "out of memory");
        goto error_out;
    }

    if (base < -36 || base > 62 || (base >= -1 && base <= 1)) {
        sBrowserFuncs->setexception (entry, "invalid base");
        goto error_release;
    }


    /* XXX could preallocate for n_digits != 0. */
    str = mpf_get_str (NULL, &exp, base, n_digits, f);
    if (!str) {
        sBrowserFuncs->setexception (entry, "out of memory");
        goto error_release;
    }

    len = strlen (str);
    s = sBrowserFuncs->memalloc (len);
    if (s || !len) {
        memcpy (s, str, len);
        x_gmp_free (str, len + 1);
        STRINGN_TO_NPVARIANT (s, len, ret->array[0]);
    }
    else {
        sBrowserFuncs->setexception (entry, "out of memory");
        goto error_free;
    }

    out_mp_exp_t (exp, &ret->array[1]);
    return &ret->npobj;

    error_free:
    x_gmp_free (str, len + 1);
    error_release:
    sBrowserFuncs->releaseobject (&ret->npobj);
    error_out:
    return sBrowserFuncs->retainobject (entry);  /* any object handy */
}

#define x_mpf_get_str(base, n_digits, f) f_get_str(vEntry, base, n_digits, f) 

/*
 * Rand objects wrap gmp_randstate_t.
 */

static NPObject*
Rand_allocate (NPP npp, NPClass *aClass)
{
    Rand* ret = (Rand*) sBrowserFuncs->memalloc (sizeof (Rand));
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
    sBrowserFuncs->memfree (npobj);
}

static NPClass Rand_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    allocate        : Rand_allocate,
    deallocate      : Rand_deallocate,
    invalidate      : obj_invalidate,
    hasMethod       : obj_id_false,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

static bool
in_x_gmp_randstate_ptr (const NPVariant* var, int count,
                        x_gmp_randstate_ptr* arg)
{
    if (count < 1 || !NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != &Rand_npclass)
        return false;
    *arg = &((Rand*) NPVARIANT_TO_OBJECT (*var))->state[0];
    return true;
}

#define del_x_gmp_randstate_ptr(arg)

DEFINE_OBJECT_TYPE (new_rand, Rand, x_gmp_randstate_ptr, state[0])
#define in_new_rand(var, count, arg) IN_NEW (new_rand, arg)
#define out_new_rand OUT_NEW

static void
randinit_lc_2exp_size (NPObject* entry, NPVariant* result, mp_bitcnt_t size)
{
    x_gmp_randstate_ptr rs;

    if (!new_rand (entry, result, &rs))
        return;
    if (gmp_randinit_lc_2exp_size (rs, size) == 0) {
        /* Rand_deallocate calls gmp_randclear, so must init. */
        gmp_randinit_default (rs);
        sBrowserFuncs->releaseobject (NPVARIANT_TO_OBJECT (*result));
        VOID_TO_NPVARIANT (*result);
    }
}

#define x_gmp_randinit_lc_2exp_size(size) \
    randinit_lc_2exp_size (vEntry, vResult, size)

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
    TopObject* top = CONTAINING (TopObject, Entry_npclass, npobj->_class);
    sBrowserFuncs->releaseobject (&top->npobjTop);
    sBrowserFuncs->memfree (npobj);
}

#define STRINGIFY(x) STRINGIFY1(x)
#define STRINGIFY1(x) # x

static const char GmpProperties[] =
#define ENTRY(string, id)                 "\0" STRINGIFY(__LINE__) "|" string
#include "gmp-entries.h"
#define CONSTANT(constval, string, type)  "\0" STRINGIFY(__LINE__) "|" string
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
    return 0;
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

    while (*n) {
        if (!strncmp (n, buf, len))
            return n + len;
        n += strlen (n) + 1;
    }
    return 0;
}

/* Calls to most functions go through Entry_invokeDefault. */

static bool
Entry_invokeDefault (NPObject *vEntry,
                     const NPVariant *vArgs, uint32_t vArgCount,
                     NPVariant *vResult)
{
    bool ok = false;
    int vArgNumber = 0;

#define ARGN(aN) \
    int aN ## int UNUSED; \
    long aN ## long UNUSED; \
    ulong aN ## ulong UNUSED; \
    double aN ## double UNUSED; \
    stringz aN ## stringz UNUSED; \
    mpz_ptr aN ## mpz_ptr UNUSED; \
    mpq_ptr aN ## mpq_ptr UNUSED; \
    mpf_ptr aN ## mpf_ptr UNUSED; \
    x_gmp_randstate_ptr aN ## x_gmp_randstate_ptr UNUSED; \
    mp_bitcnt_t aN ## mp_bitcnt_t UNUSED; \
    int_0_or_2_to_62 aN ## int_0_or_2_to_62 UNUSED; \
    int_2_to_62 aN ## int_2_to_62 UNUSED; \
    int_abs_2_to_62 aN ## int_abs_2_to_62 UNUSED; \
    mp_size_t aN ## mp_size_t UNUSED; \
    mp_exp_t aN ## mp_exp_t UNUSED; \
    size_t aN ## size_t UNUSED;

    ARGN(a0);
    ARGN(a1);
    ARGN(a2);
    ARGN(a3);
    ARGN(a4);

#define IN(a, t)                                                        \
    (vArgNumber++,                                                      \
     in_ ## t (&vArgs[vArgNumber-1], vArgCount + 1 - vArgNumber, &a ## t))

#define IN_NEW(func, arg) (vArgNumber--, func (vEntry, vResult, arg))

    mpz_ptr a0new_mpz;
    mpz_ptr* a0new_mpzref;
    mpq_ptr a0new_mpq;
    mpf_ptr a0new_mpf;
    x_gmp_randstate_ptr a0new_rand;

    int number = CONTAINING (Entry, npobj, vEntry)->number;

    switch (number) {

#define ENTRY0(name, string, id, rett)                          \
        case __LINE__:                                          \
            if (vArgNumber != vArgCount) break;                 \
            out_ ## rett (name (), vResult);                    \
            ok = true;                                          \
            break;

#define ENTRY1(name, string, id, rett, t0)                      \
        case __LINE__:                                          \
            if (!IN (a0, t0)) break;                            \
            if (vArgNumber != vArgCount) goto del0_ ## id;      \
            out_ ## rett (name (a0 ## t0), vResult);            \
            ok = true;                                          \
            del0_ ## id: del_ ## t0 (a0 ## t0);                 \
            break;

#define ENTRY2(name, string, id, rett, t0, t1)                  \
        case __LINE__:                                          \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto del0_ ## id;                 \
            if (vArgNumber != vArgCount) goto del1_ ## id;      \
            out_ ## rett (name (a0 ## t0, a1 ## t1), vResult);  \
            ok = true;                                          \
            del1_ ## id: del_ ## t1 (a1 ## t1);                 \
            del0_ ## id: del_ ## t0 (a0 ## t0);                 \
            break;

#define ENTRY3(name, string, id, rett, t0, t1, t2)              \
        case __LINE__:                                          \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto del0_ ## id;                 \
            if (!IN (a2, t2)) goto del1_ ## id;                 \
            if (vArgNumber != vArgCount) goto del2_ ## id;      \
            out_ ## rett (name (a0 ## t0, a1 ## t1, a2 ## t2),  \
                          vResult);                             \
            ok = true;                                          \
            del2_ ## id: del_ ## t2 (a2 ## t2);                 \
            del1_ ## id: del_ ## t1 (a1 ## t1);                 \
            del0_ ## id: del_ ## t0 (a0 ## t0);                 \
            break;

#define ENTRY4(name, string, id, rett, t0, t1, t2, t3)          \
        case __LINE__:                                          \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto del0_ ## id;                 \
            if (!IN (a2, t2)) goto del1_ ## id;                 \
            if (!IN (a3, t3)) goto del2_ ## id;                 \
            if (vArgNumber != vArgCount) goto del3_ ## id;      \
            out_ ## rett (name (a0 ## t0, a1 ## t1, a2 ## t2,   \
                                a3 ## t3), vResult);            \
            ok = true;                                          \
            del3_ ## id: del_ ## t3 (a3 ## t3);                 \
            del2_ ## id: del_ ## t2 (a2 ## t2);                 \
            del1_ ## id: del_ ## t1 (a1 ## t1);                 \
            del0_ ## id: del_ ## t0 (a0 ## t0);                 \
            break;

#define ENTRY5(name, string, id, rett, t0, t1, t2, t3, t4)      \
        case __LINE__:                                          \
            if (!IN (a0, t0)) break;                            \
            if (!IN (a1, t1)) goto del0_ ## id;                 \
            if (!IN (a2, t2)) goto del1_ ## id;                 \
            if (!IN (a3, t3)) goto del2_ ## id;                 \
            if (!IN (a4, t4)) goto del3_ ## id;                 \
            if (vArgNumber != vArgCount) goto del4_ ## id;      \
            out_ ## rett (name (a0 ## t0, a1 ## t1, a2 ## t2,   \
                                a3 ## t3, a4 ## t4), vResult);  \
            ok = true;                                          \
            del4_ ## id: del_ ## t4 (a4 ## t4);                 \
            del3_ ## id: del_ ## t3 (a3 ## t3);                 \
            del2_ ## id: del_ ## t2 (a2 ## t2);                 \
            del1_ ## id: del_ ## t1 (a1 ## t1);                 \
            del0_ ## id: del_ ## t0 (a0 ## t0);                 \
            break;

#include "gmp-entries.h"

    default:
        sBrowserFuncs->setexception (vEntry,
                                     "internal error, bad entry number");
        ok = true;
    break;
    }

    if (!ok) {
        static const char fmt[] = "%s: wrong type arguments";
        char message[200];
        const char* name = number_to_name (number);
        if (sizeof fmt - 2 + strlen (name) > sizeof message)
            name = "GMP function";
        sprintf (message, fmt, name);
        sBrowserFuncs->setexception (vEntry, message);
    }
    return true;
}

/*
 * Class of the "gmp" object.
 */

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
    ret = name_to_number (name) != 0;
    sBrowserFuncs->memfree (name);
    return ret;
}

static void
get_entry (NPObject *npobj, int number, NPVariant *result)
{
    TopObject* top = CONTAINING (TopObject, npobjGmp, npobj);

    Entry* entry = (Entry*) sBrowserFuncs->createobject
        (top->instance, &top->Entry_npclass);

    if (entry) {
        sBrowserFuncs->retainobject (&top->npobjTop);
        entry->number = number;
        OBJECT_TO_NPVARIANT (&entry->npobj, *result);
    }
    else
        sBrowserFuncs->setexception (npobj, "out of memory");
}

static bool
Gmp_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    NPUTF8* name;
    int line = 0;

    if (!sBrowserFuncs->identifierisstring (key))
        return false;

    name = sBrowserFuncs->utf8fromidentifier (key);
    line = name_to_number (name);

    if (line)
        get_entry (npobj, line, result);

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
    const char* p;
    uint32_t cnt = 0
#define ENTRY(string, id) +1
#include "gmp-entries.h"
#define CONSTANT(value, string, type) +1
#include "gmp-constants.h"
        ;
    *value = sBrowserFuncs->memalloc (cnt * sizeof (NPIdentifier*));
    *count = cnt;
    cnt = 0;
    for (p = &GmpProperties[1]; *p; p += strlen (p) + 1)
        (*value)[cnt++] = sBrowserFuncs->getstringidentifier
            (strchr (p, '|') + 1);
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

/*
 * Class of the top-level <embed> object exposed to scripts through the DOM.
 */

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
        ret->instance                      = instance;
        ret->npobjGmp._class               = &Gmp_npclass;
        ret->Entry_npclass.structVersion   = NP_CLASS_STRUCT_VERSION;
        ret->Entry_npclass.allocate        = Entry_allocate;
        ret->Entry_npclass.deallocate      = Entry_deallocate;
        ret->Entry_npclass.invalidate      = obj_invalidate;
        ret->Entry_npclass.hasMethod       = obj_id_false;
        ret->Entry_npclass.invokeDefault   = Entry_invokeDefault;
        ret->Entry_npclass.hasProperty     = obj_id_false;
        ret->Entry_npclass.getProperty     = obj_id_var_void;
        ret->Entry_npclass.setProperty     = setProperty_ro;
        ret->Entry_npclass.removeProperty  = removeProperty_ro;
        ret->Entry_npclass.enumerate       = enumerate_empty;
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

/*
 * NPAPI plug-in entry points.
 */

static NPError
npp_New(NPMIMEType pluginType, NPP instance, uint16_t mode,
        int16_t argc, char* argn[], char* argv[], NPSavedData* saved)
{
    /* Make this a windowless plug-in.  This makes Chrome happy.  */
    sBrowserFuncs->setvalue (instance, NPPVpluginWindowBool, (void*) false);

    /* Create the instance's top-level scriptable <embed> object.  */
    instance->pdata = sBrowserFuncs->createobject (instance,
                                                   &TopObject_npclass);
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
        sBrowserFuncs->releaseobject (&top->npobjTop);
    }
    return NPERR_NO_ERROR;
}

static NPError
npp_GetValue(NPP instance, NPPVariable variable, void *value) {
    TopObject* top = (TopObject*) instance->pdata;
    switch (variable) {
    case NPPVpluginScriptableNPObject:
        if (top) {
            *((NPObject**)value) =
                sBrowserFuncs->retainobject (&top->npobjTop);
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
