/* browser (NPAPI) plug-in for multiple precision arithmetic.

   TO DO:

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
#include <assert.h>
#include <stdarg.h>

#if __GNUC__
#define UNUSED __attribute__ ((unused))
#define THREAD_LOCAL1 __thread
#define UNLIKELY(x) __builtin_expect ((x) != 0, 0)
#define LIKELY(x)   __builtin_expect ((x) != 0, 1)
#define ALWAYS_INLINE __attribute__ ((__always_inline__))
#else
#define UNUSED
#define THREAD_LOCAL1
#define UNLIKELY(x) (x)
#define LIKELY(x)   (x)
#define ALWAYS_INLINE
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

#ifndef NPGMP_MPZ
# define NPGMP_MPZ 1  /* Support integers (mpz_t).  */
#endif
#ifndef NPGMP_MPQ
# define NPGMP_MPQ NPGMP_MPZ  /* Support rationals (mpq_t).  */
#endif
#ifndef NPGMP_MPF
# define NPGMP_MPF 1  /* Support floating-point numbers (mpf_t).  */
#endif
#ifndef NPGMP_RAND
# define NPGMP_RAND 1  /* Support random number generation.  */
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

#define NPN_HasMethod(npp, obj, name) \
    sBrowserFuncs->hasmethod (npp, obj, name)
#define NPN_Invoke(npp, obj, name, args, argCount, result) \
    sBrowserFuncs->invoke (npp, obj, name, args, argCount, result)
#define NPN_InvokeDefault(npp, obj, args, argCount, result) \
    sBrowserFuncs->invokeDefault (npp, obj, args, argCount, result)
#define NPN_HasProperty(npp, obj, name) \
    sBrowserFuncs->hasproperty (npp, obj, name)
#define NPN_GetProperty(npp, obj, propertyName, result) \
    sBrowserFuncs->getproperty (npp, obj, propertyName, result)
#define NPN_SetProperty(npp, obj, propertyName, value) \
    sBrowserFuncs->setproperty (npp, obj, propertyName, value)
#define NPN_RemoveProperty(npp, obj, propertyName) \
    sBrowserFuncs->removeproperty (npp, obj, propertyName)
#define NPN_Enumerate(npp, obj, identifier, count) \
    sBrowserFuncs->enumerate (npp, obj, identifier, count)
#define NPN_Construct(npp, obj, args, argCount, result) \
    sBrowserFuncs->construct (npp, obj, args, argCount, result)

static NPIdentifier ID_toString, ID_length;
/* XXX Let's do valueOf, too. */


/*
 * Top-level per-instance structure.
 */

#define GET_TOP(__class, __object)                      \
    CONTAINING (TopObject, __class, (__object)->_class)

#define GET_TYPE(__top, __object)                               \
    ((const char*) (__object)->_class - (const char*) (__top))

#define IS_INSTANCE_OBJECT(__top, __object)             \
    (GET_TYPE (__top, __object) >= 0 &&                 \
     GET_TYPE (__top, __object) < sizeof (TopObject))

typedef struct _Class {
    NPClass     npclass;
    struct _TopObject* top;
} Class;

typedef struct _TopObject {
    NPObject    npobj;
    NPP         instance;
    bool        destroying;
    const char* errmsg;
    NPObject*   npobjGmp;

    Class       Entry;
#define Entry_getTop(object) GET_TOP (Entry, object)
#define TYPE_Entry (offsetof (TopObject, Entry))

    Class       Tuple;
#define Tuple_getTop(object) GET_TOP (Tuple, object)
#define TYPE_Tuple (offsetof (TopObject, Tuple))

#if NPGMP_MPZ
    Class       Integer;
#define Integer_getTop(object) GET_TOP (Integer, object)
#define TYPE_Integer (offsetof (TopObject, Integer))
#endif

#if NPGMP_MPQ
    Class       MpzRef;
#define MpzRef_getTop(object) GET_TOP (MpzRef, object)
#define TYPE_MpzRef (offsetof (TopObject, MpzRef))
    Class       Rational;
#define Rational_getTop(object) GET_TOP (Rational, object)
#define TYPE_Rational (offsetof (TopObject, Rational))
#endif

#if NPGMP_RAND
    Class       Rand;
#define Rand_getTop(object) GET_TOP (Rand, object)
#define TYPE_Rand (offsetof (TopObject, Rand))
#endif

#if NPGMP_MPF
    Class       Float;
#define Float_getTop(object) GET_TOP (Float, object)
#define TYPE_Float (offsetof (TopObject, Float))
    mp_bitcnt_t default_mpf_prec;  /* Emulate mpf_set_default_prec. */
#endif

#if NPGMP_SCRIPT
    Class       Thread;
#define Thread_getTop(object) GET_TOP (Thread, object)
#define TYPE_Thread (offsetof (TopObject, Thread))
    Class       Stack;
#define Stack_getTop(object) GET_TOP (Stack, object)
#define TYPE_Stack (offsetof (TopObject, Stack))
    Class       Root;
#define Root_getTop(object) GET_TOP (Root, object)
#define TYPE_Root (offsetof (TopObject, Root))
#endif

} TopObject;

static TopObject* get_top (NPObject* npobj);


/*
 * Semantics of NPN_SetException are not well defined.  Wrap it.
 */

static bool
set_exception (NPObject* npobj, const NPUTF8* message, NPVariant* result,
               bool ret)
{
    if (result)
        VOID_TO_NPVARIANT (*result);
    if (npobj)
        NPN_SetException (npobj, message);
    return ret;
}
#undef NPN_SetException  /* Prevent further use. */

static const char OOM[] = "out of memory";

static void
free_errmsg (const char* errmsg)
{
    if (errmsg && errmsg != OOM)
        NPN_MemFree ((char*) errmsg);
}

static void
vraisef (NPObject* npobj, const char* format, va_list ap)
{
    TopObject* top = get_top (npobj);
    if (top) {
        free_errmsg (top->errmsg);
        int needed = vsnprintf (0, 0, format, ap) + 1;
        char* buffer = (char*) NPN_MemAlloc (needed);
        if (buffer) {
            vsnprintf (buffer, needed, format, ap);
            top->errmsg = buffer;
        }
        else
            top->errmsg = OOM;
    }
    else {
        fprintf (stderr, "Uncaught: ");
        vfprintf (stderr, format, ap);
    }
}

static void
raisef (NPObject* npobj, const char* format, ...)
{
    va_list ap;

    va_start (ap, format);
    vraisef (npobj, format, ap);
    va_end (ap);
}

static void
raise_oom (NPObject* npobj)
{
    TopObject* top = get_top (npobj);
    if (top && !top->errmsg)
        top->errmsg = OOM;
    else
        fputs (OOM, stderr);
}

static bool
consume_ex (TopObject* top, NPObject* npobj, NPVariant* result, bool ret)
{
    ret = set_exception (npobj ?: (NPObject*) top, top->errmsg, result, ret);
    free_errmsg (top->errmsg);
    top->errmsg = 0;
    return ret;
}

/* check_ex: Throw an exception to JavaScript if top->errmsg has been
   set (by raisef or raise_oom) since the last call to check_ex().
   Return a boolean value to be returned from the current NPClass
   function.  NPOBJ defaults to TOP.  RESULT should be the current
   function's result argument, or null if not applicable.  RET should
   be true, except in cases where the current NPClass function would
   normally return false, such as hasMethod where the method does not
   exist.  */
static inline bool
check_ex (TopObject* top, NPObject* npobj, NPVariant* result, bool ret)
{
    if (top->errmsg)
        return consume_ex (top, npobj, result, ret);
    return ret;
}

static bool
vthrowf (NPObject* npobj, NPVariant* result, bool ret,
         const char* format, va_list ap)
{
    vraisef (npobj, format, ap);
    return consume_ex (get_top (npobj), npobj, result, ret);
}

static bool
throwf (NPObject* npobj, NPVariant* result, bool ret, const char* format, ...)
{
    va_list ap;

    va_start (ap, format);
    ret = vthrowf (npobj, result, ret, format, ap);
    va_end (ap);
    return ret;
}

static bool
oom (NPObject* npobj, NPVariant* result, bool ret)
{
    raise_oom (npobj);
    return consume_ex (get_top (npobj), npobj, result, ret);
}


/*
 * Argument conversion.
 *
 * bool in_TYPE (TopObject* TOP, const NPVariant* VAR, TYPE* ARG)
 * Converts *VAR to TYPE storing the result in *ARG.  Assumes *VAR
 * will outlive ARG, so avoids copying and reference counting if
 * possible.  Returns true on success, else sets error and returns
 * false.
 *
 * void del_TYPE (TYPE ARG)
 * Frees any resources allocated by a previous call to in_TYPE.
 *
 * bool out_TYPE (TopObject* TOP, TYPE VALUE, NPVariant* RESULT)
 * Converts VALUE to NPVariant storing the result in *RESULT.  Returns
 * true on success, else sets error and returns false.
 *
 * bool outdel_TYPE (TopObject* TOP, TYPE VALUE, NPVariant* RESULT)
 * Equivalent to (out_TYPE (TOP, VALUE, RESULT) ? (del_TYPE (VALUE),
 * true) : false) but outdel_stringz avoids copying.
 */

/* Single-token aliases required for preprocessor magic.  */
typedef unsigned long ulong;
typedef char const* stringz;
typedef bool Bool;  /* `bool' may be a macro. */
typedef NPObject* npobj;
typedef NPString npstring;  /* just a convention. XXX */

/* Raw argument type.  */
typedef struct _Variant {
    TopObject* top;
    const NPVariant* arg;
} Variant;

static bool UNUSED
in_Variant (TopObject* top, const NPVariant* var, Variant* arg)
{
    arg->top = top;
    arg->arg = var;
    return true;
}
static inline void UNUSED del_Variant (Variant arg) {}

/* double <=> NPVariantType_{Double|Int32} */

static bool UNUSED
in_double (TopObject* top, const NPVariant* var, double* arg)
{
    if (NPVARIANT_IS_DOUBLE (*var))
        *arg = NPVARIANT_TO_DOUBLE (*var);
    else if (NPVARIANT_IS_INT32 (*var))
        *arg = (double) NPVARIANT_TO_INT32 (*var);
    else {
        raisef ((NPObject*) top, "not a number");
        return false;
    }
    return true;
}

static inline void UNUSED del_double (double arg) {}

static bool UNUSED
out_double (TopObject* top, double value, NPVariant* result)
{
    DOUBLE_TO_NPVARIANT (value, *result);
    return true;
}

static inline bool UNUSED
outdel_double (TopObject* top, double value, NPVariant* result)
{
    return out_double (top, value, result);
}

/* C integer types <=> NPVariantType_{Double|Int32|String} */

#define PARSE_UNSIGNED(top, type, arg, start, end)                      \
    do {                                                                \
        TopObject* t = (top);                                           \
        type* a = (arg);                                                \
        const NPUTF8* s = (start);                                      \
        const NPUTF8* e = (end);                                        \
                                                                        \
        if (s == e) {                                                   \
            raisef ((NPObject*) t, "invalid %s", #type);                \
            return false;                                               \
        }                                                               \
        *a = 0;                                                         \
        while (s < e) {                                                 \
            if (*s < '0' || *s > '9' ||                                 \
                *a * 2 < *a || *a * 4 < *a * 2 || *a * 8 < *a * 4 ||    \
                *a * 10 + (*s - '0') < *a * 8) {                        \
                raisef ((NPObject*) t, "invalid %s", #type);            \
                return false;                                           \
            }                                                           \
            *a = *a * 10 + (*s - '0');                                  \
        }                                                               \
    } while (0)

#define DEFINE_IN_SIGNED(type)                                          \
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
            raisef ((NPObject*) top, "invalid %s", #type);              \
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
            raisef ((NPObject*) top, "invalid %s", #type);              \
            return false;                                               \
        }                                                               \
        return true;                                                    \
    }

#define DEFINE_OUT_NUMBER(Type)                                         \
    static inline void UNUSED                                           \
    del_ ## Type (Type arg)                                             \
    {                                                                   \
    }                                                                   \
                                                                        \
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
                raise_oom ((NPObject*) top);                            \
                VOID_TO_NPVARIANT (*result);                            \
                return false;                                           \
            }                                                           \
        }                                                               \
        return true;                                                    \
    }                                                                   \
    static inline bool UNUSED                                           \
    outdel_ ## Type (TopObject* top, Type value, NPVariant* result)     \
    {                                                                   \
        return out_ ## Type (top, value, result);                       \
    }

#define DEFINE_SIGNED(Type)   DEFINE_IN_SIGNED (Type)   DEFINE_OUT_NUMBER (Type)
#define DEFINE_UNSIGNED(Type) DEFINE_IN_UNSIGNED (Type) DEFINE_OUT_NUMBER (Type)

DEFINE_SIGNED (int)
DEFINE_SIGNED (long)
DEFINE_UNSIGNED (ulong)
DEFINE_UNSIGNED (size_t)

/* bool <=> NPVariantType_Bool */

static bool UNUSED
in_Bool (TopObject* top, const NPVariant* var, bool* arg)
{
    if (!NPVARIANT_IS_BOOLEAN (*var)) {
        raisef ((NPObject*) top, "not a boolean");
        return false;
    }
    *arg = NPVARIANT_TO_BOOLEAN (*var);
    return true;
}

static inline void UNUSED del_Bool (bool arg) {}

static bool UNUSED
out_Bool (TopObject* top, bool value, NPVariant* result)
{
    BOOLEAN_TO_NPVARIANT (value, *result);
    return true;
}

static inline bool UNUSED
outdel_Bool (TopObject* top, bool value, NPVariant* result)
{
    return out_Bool (top, value, result);
}

/* 0-terminated string <=> NPVariantType_String */

/* Chrome does not terminate its NPString with NUL.  Hence the need
   for del_* and outdel_*.  */

static bool UNUSED
in_stringz (TopObject* top, const NPVariant* var, stringz* arg)
{
    const NPString* npstr;
    NPUTF8* str;

    if (!NPVARIANT_IS_STRING (*var)) {
        raisef ((NPObject*) top, "not a string");
        return false;
    }
    npstr = &NPVARIANT_TO_STRING (*var);
    str = (NPUTF8*) NPN_MemAlloc (npstr->UTF8Length + 1);
    if (!str) {
        raise_oom ((NPObject*) top);
        return false;
    }
    *arg = str;
    strncpy (str, npstr->UTF8Characters, npstr->UTF8Length);
    str[npstr->UTF8Length] = '\0';
    return true;
}

static inline void UNUSED
del_stringz (stringz arg)
{
    NPN_MemFree ((char*) arg);
}
 
static bool UNUSED
out_stringz (TopObject* top, stringz value, NPVariant* result)
{
    size_t len = strlen (value);
    NPUTF8* ret = (NPUTF8*) NPN_MemAlloc (len + 1);
    if (!ret) {
        raise_oom ((NPObject*) top);
        return false;
    }
    memcpy (ret, value, len + 1);
    STRINGN_TO_NPVARIANT (ret, len, *result);
    return true;
}

static inline bool UNUSED
outdel_stringz (TopObject* top, stringz value, NPVariant* result)
{
    STRINGZ_TO_NPVARIANT (value, *result);
    return true;
}

/* NPString <=> NPVariantType_String */

static bool UNUSED
in_npstring (TopObject* top, const NPVariant* var, NPString* arg)
{
    if (!NPVARIANT_IS_STRING (*var)) {
        raisef ((NPObject*) top, "not a string");
        return false;
    }
    *arg = NPVARIANT_TO_STRING (*var);
    return true;
}

static inline void UNUSED del_npstring (NPString arg) {}

static bool UNUSED
out_npstring (TopObject* top, NPString value, NPVariant* result)
{
    bool ret = (value.UTF8Characters != 0 || value.UTF8Length == 0);
    if (ret)
        STRINGN_TO_NPVARIANT (value.UTF8Characters, value.UTF8Length, *result);
    else {
        VOID_TO_NPVARIANT (*result);
        raise_oom ((NPObject*) top);
    }
    return ret;
}

static inline bool UNUSED
outdel_npstring (TopObject* top, NPString value, NPVariant* result)
{
    return out_npstring (top, value, result);
}

/* NPObject* <=> NPVariantType_Object */

static bool UNUSED
in_npobj (TopObject* top, const NPVariant* var, NPObject** arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)) {
        raisef ((NPObject*) top, "not an object");
        return false;
    }
    *arg = NPVARIANT_TO_OBJECT (*var);
    return true;
}

static inline void UNUSED del_npobj (NPObject* arg) {}

static bool UNUSED
out_npobj (TopObject* top, NPObject* value, NPVariant* result)
{
    if (value)
        /* Caller retains. */
        OBJECT_TO_NPVARIANT (value, *result);
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

static inline bool UNUSED
outdel_npobj (TopObject* top, NPObject* value, NPVariant* result)
{
    return out_npobj (top, value, result);
}


/*
 * Generic NPClass methods.
 */

static void UNUSED
obj_noop (NPObject *npobj)
{
}

static bool UNUSED
obj_id_false(NPObject *npobj, NPIdentifier name)
{
    return false;
}

static bool UNUSED
obj_id_var_void(NPObject *npobj, NPIdentifier name, NPVariant *result)
{
    VOID_TO_NPVARIANT (*result);
    return true;
}

static bool UNUSED
setProperty_ro(NPObject *npobj, NPIdentifier name, const NPVariant *value)
{
    return set_exception (npobj, "read-only object", 0, true);
}

static bool UNUSED
removeProperty_ro(NPObject *npobj, NPIdentifier name)
{
    return set_exception (npobj, "read-only object", 0, true);
}

static bool UNUSED
enumerate_empty(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *value = 0;
    *count = 0;
    return true;
}

static bool UNUSED
hasMethod_only_toString(NPObject *npobj, NPIdentifier name)
{
    return name == ID_toString;
}

static void UNUSED
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
    NPVariant* start;
    NPVariant* end;
} Tuple;

static NPObject*
Tuple_allocate (NPP npp, NPClass *aClass)
{
    Tuple* ret = (Tuple*) NPN_MemAlloc (sizeof (Tuple));
#if DEBUG_ALLOC
    fprintf (stderr, "Tuple allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Tuple, aClass));
        ret->start = 0;
        ret->end = 0;
    }
    return &ret->npobj;
}

static NPVariant* tuple_alloc (uint32_t size);
static void tuple_free (Tuple* tuple);
static bool retain_for_js (TopObject* top, NPObject* npobj);

#if !NPGMP_SCRIPT  /* Script allocation is in a special heap.  */

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
    for (NPVariant* v = tuple->start; v < tuple->end; v++)
        NPN_ReleaseVariantValue (v);
    if (tuple->start)
        NPN_MemFree (tuple->start);
}

static bool
retain_for_js (TopObject* top, NPObject* npobj)
{
    return true;
}

#endif  /* !NPGMP_SCRIPT */

static void
Tuple_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Tuple deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    TopObject* top = Tuple_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
    tuple_free ((Tuple*) npobj);
    NPN_MemFree (npobj);
}

static size_t
Tuple_length (Tuple* tuple)
{
    return tuple->end - tuple->start;
}

#define NOT_INDEX ((uint32_t) -1)

static uint32_t
id_to_index (NPIdentifier key)
{
    if (NPN_IdentifierIsString (key)) {
        // XXX could try converting string to uint32_t.
        return NOT_INDEX;
    }
    return (uint32_t) NPN_IntFromIdentifier (key);
}

static bool
Tuple_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return key == ID_length ||
        id_to_index (key) < Tuple_length ((Tuple*) npobj);
}

/* Return true if copy SRC to DEST, else set errmsg.  */
static bool
copy_npvariant (NPObject* npobj, NPVariant* dest, const NPVariant* src)
{
    if (NPVARIANT_IS_STRING (*src)) {
        uint32_t len = NPVARIANT_TO_STRING (*src).UTF8Length;
        NPUTF8* s = (NPUTF8*) NPN_MemAlloc (len);
        if (!s) {
            raise_oom (npobj);
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
tuple_getProperty (NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    Tuple* tuple = (Tuple*) npobj;
    size_t len = Tuple_length (tuple);

    if (key == ID_length)
        DOUBLE_TO_NPVARIANT (len, *result);
    else {
        uint32_t i = id_to_index (key);
        if (i == NOT_INDEX)
            return false;  /* KEY could name a subclass property.  */
        if (i < len)
            (void) copy_npvariant (npobj, result, &tuple->start[i]);
        else
            VOID_TO_NPVARIANT (*result);
    }
    return true;
}

static bool
Tuple_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    if (!tuple_getProperty (npobj, key, result))
        VOID_TO_NPVARIANT (*result);
    return check_ex (Tuple_getTop (npobj), npobj, result, true);
}

static Tuple*
make_tuple (TopObject* top, uint32_t size)
{
    Tuple* ret = (Tuple*) NPN_CreateObject (top->instance, &top->Tuple.npclass);
    if (ret) {
        ret->start = tuple_alloc (size);
        if (ret->start) {
            memset (ret->start, '\0', size * sizeof ret->start[0]);
            ret->end = ret->start + size;
        }
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

static bool
in_int_0_or_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    if (!in_int (top, var, arg))
        return false;
    if (*arg == 0 || (*arg >= 2 && *arg <= 62))
        return true;
    raisef ((NPObject*) top, "not a valid base");
    return false;
}
#define del_int_0_or_2_to_62(arg)

static bool
in_int_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    if (!in_int (top, var, arg))
        return false;
    if (*arg >= 2 && *arg <= 62)
        return true;
    raisef ((NPObject*) top, "not a valid base");
    return false;
}
#define del_int_2_to_62(arg)

static bool
in_output_base (TopObject* top, const NPVariant* var, int* arg)
{
    if (!in_int (top, var, arg))
        return false;
    if ((*arg >= -36 && *arg <= -2) || (*arg >= 2 && *arg <= 62))
        return true;
    raisef ((NPObject*) top, "not a valid base");
    return false;
}
#define del_output_base(arg)

#if NPGMP_MPF

static bool
in_int_abs_2_to_62 (TopObject* top, const NPVariant* var, int* arg)
{
    if (!in_int (top, var, arg))
        return false;
    int i = (*arg > 0 ? *arg : -*arg);
    if (i >= 2 && i <= 62)
        return true;
    raisef ((NPObject*) top, "not a valid base");
    return false;
}
#define del_int_abs_2_to_62(arg)

#endif  /* NPGMP_MPF */

DEFINE_UNSIGNED (mp_bitcnt_t)
DEFINE_UNSIGNED (mp_size_t)
DEFINE_SIGNED (mp_exp_t)
DEFINE_UNSIGNED (mp_limb_t)

typedef mpz_ptr uninit_mpz;
typedef mpq_ptr uninit_mpq;
typedef mpf_ptr uninit_mpf;
typedef mpf_ptr defprec_mpf;
typedef x_gmp_randstate_ptr uninit_rand;

#if NPGMP_MPZ
typedef struct _Integer {
    NPObject npobj;
    mpz_t mp;
} Integer;
#endif  /* NPGMP_MPZ */

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

#if NPGMP_MPZ

static NPObject*
Integer_allocate (NPP npp, NPClass *aClass)
{
    Integer* ret = (Integer*) NPN_MemAlloc (sizeof (Integer));
#if DEBUG_ALLOC
    fprintf (stderr, "Integer allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Integer, aClass));
        mpz_init (ret->mp);
    }
    return (NPObject*) ret;
}

static void
Integer_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Integer deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    TopObject* top = Integer_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
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

    else if (!in_output_base (top, &args[0], &base)) {
        return set_exception ((NPObject*) top, "invalid argument", result,
                              true);
    }

    size_t len = mpz_sizeinbase (mpp, base) + 2;
    NPUTF8* s = (NPUTF8*) NPN_MemAlloc (len);
    if (!s)
        return oom ((NPObject*) top, result, true);

    mpz_get_str (s, base, mpp);
    if (s[0] != '-')
        len--;
    STRINGN_TO_NPVARIANT (s, s[len-2] ? len-1 : len-2, *result);
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
    NPObject* ret = NPN_CreateObject (top->instance, &top->Integer.npclass);
    if (!ret)
        raise_oom ((NPObject*) top);
    return ret;
}

/* XXX Could avoid macro use of vTop by making x_mpz a no-op and having the
   entry return a new type that creates the object in its output method. */
#define x_mpz() x_x_mpz (vTop)

static Bool
is_mpz (Variant var)
{
    if (!NPVARIANT_IS_OBJECT (*var.arg))
        return false;
    NPObject* npobj = NPVARIANT_TO_OBJECT (*var.arg);
    if (npobj->_class == (NPClass*) &var.top->Integer)
        return true;
#if NPGMP_MPQ
    if (npobj->_class == (NPClass*) &var.top->MpzRef)
        return true;
#endif  /* NPGMP_MPQ */
    return false;
}

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
    if (ret) {
        ret->owner = 0;
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, MpzRef, aClass));
    }
    return &ret->npobj;
}

static void
MpzRef_deallocate (NPObject *npobj)
{
    MpzRef* ref = (MpzRef*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "MpzRef deallocate %p; %p\n", npobj, ref->owner);
#endif  /* DEBUG_ALLOC */
    TopObject* top = MpzRef_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
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
    NPObject* ret = NPN_CreateObject (top->instance, &top->MpzRef.npclass);

    if (ret)
        init_mpzref ((MpzRef*) ret, z, q);
    else
        raise_oom ((NPObject*) top);
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
    if (NPVARIANT_TO_OBJECT (*var)->_class == (NPClass*) &top->Integer)
        *arg = &((Integer*) NPVARIANT_TO_OBJECT (*var))->mp[0];
#if NPGMP_MPQ
    else if (NPVARIANT_TO_OBJECT (*var)->_class == (NPClass*) &top->MpzRef)
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
    if (ret)
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Rational, aClass));
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
    TopObject* top = Rational_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
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
            return oom ((NPObject*) top, result, true);
    }
    else
        return set_exception ((NPObject*) top, "invalid argument", result,
                              true);
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
        || NPVARIANT_TO_OBJECT (*var)->_class != (NPClass*) &top->Rational)
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
    NPObject* ret = NPN_CreateObject (top->instance, &top->Rational.npclass);
    if (ret)
        mpq_init (&((Rational*) ret)->mp[0]);
    else
        raise_oom ((NPObject*) top);
    return ret;
}

#define x_mpq() x_x_mpq (vTop)

static Bool
is_mpq (Variant var)
{
    if (!NPVARIANT_IS_OBJECT (*var.arg))
        return false;
    NPObject* npobj = NPVARIANT_TO_OBJECT (*var.arg);
    if (npobj->_class == (NPClass*) &var.top->Rational)
        return true;
    return false;
}

#endif  /* NPGMP_MPQ */
#endif  /* NPGMP_MPZ */

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
    if (ret)
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Float, aClass));
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
    TopObject* top = Float_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
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
    bool ret = true;

    if (argCount < 1 || !in_int (top, args, &base))
        base = 10;

    if (argCount < 2 || !in_size_t (top, args + 1, &n_digits))
        n_digits = 0;

    if (base >= -36 && base <= 62 && base != 0 && base != -1 && base != 1) {
        NPUTF8* s;

        /* XXX could preallocate for n_digits != 0. */
        str = mpf_get_str (NULL, &expt, base, n_digits, mpp);
        if (!str)
            return oom ((NPObject*) top, result, true);

        allocated = strlen (str) + 1;
        if (allocated == 1) {
            s = (NPUTF8*) NPN_MemAlloc (sizeof "0");
            if (s) {
                strcpy (s, "0");
                STRINGZ_TO_NPVARIANT (s, *result);
            }
            else
                ret = oom ((NPObject*) top, result, true);
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
                ret = oom ((NPObject*) top, result, true);
        }

        x_gmp_free (str, allocated);
    }
    else
        return set_exception ((NPObject*) top, "invalid base", result, true);
    return ret;
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
        || NPVARIANT_TO_OBJECT (*var)->_class != (NPClass*) &top->Float)
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
in_defprec_mpf (TopObject* top, const NPVariant* var, mpf_ptr* arg)
{
    bool ret = in_uninit_mpf (top, var, arg);
    if (ret)
        x_x_mpf_init (top, *arg);
    return ret;
}

#define del_mpf_ptr(arg)
#define del_uninit_mpf(arg)
#define del_defprec_mpf(arg)

static NPObject*
x_x_mpf (TopObject* top)
{
    NPObject* ret = NPN_CreateObject (top->instance, &top->Float.npclass);
    if (ret)
        x_x_mpf_init (top, &((Float*) ret)->mp[0]);
    else
        raise_oom ((NPObject*) top);
    return ret;
}

#define x_mpf() x_x_mpf (vTop)

static Bool
is_mpf (Variant var)
{
    if (!NPVARIANT_IS_OBJECT (*var.arg))
        return false;
    NPObject* npobj = NPVARIANT_TO_OBJECT (*var.arg);
    if (npobj->_class == (NPClass*) &var.top->Float)
        return true;
    return false;
}

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
    if (ret)
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Rand, aClass));
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
    TopObject* top = Rand_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
    NPN_MemFree (npobj);
}

static bool
in_x_gmp_randstate_ptr (TopObject* top, const NPVariant* var,
                        x_gmp_randstate_ptr* arg)
{
    if (!NPVARIANT_IS_OBJECT (*var)
        || NPVARIANT_TO_OBJECT (*var)->_class != (NPClass*) &top->Rand)
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
    NPObject* ret = NPN_CreateObject (top->instance, &top->Rand.npclass);
    if (ret)
        gmp_randinit_default (&((Rand*) ret)->state[0]);
    else
        raise_oom ((NPObject*) top);
    return ret;
}

#define x_randstate() x_x_randstate (vTop)

static Bool
is_randstate (Variant var)
{
    if (!NPVARIANT_IS_OBJECT (*var.arg))
        return false;
    NPObject* npobj = NPVARIANT_TO_OBJECT (*var.arg);
    if (npobj->_class == (NPClass*) &var.top->Rand)
        return true;
    return false;
}

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

typedef char EntryInfo;

/*
 * Class of ordinary functions like mpz_init and mpz_add.
 */

typedef struct _Entry {
    NPObject npobj;
    int number;  /* unique ID; currently, a line number in gmp-entries.h */
    const EntryInfo* info;
} Entry;

static NPObject*
Entry_allocate (NPP npp, NPClass *aClass)
{
    Entry* ret = (Entry*) NPN_MemAlloc (sizeof (Entry));
#if DEBUG_ALLOC
    fprintf (stderr, "Entry allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret)
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Entry, aClass));
    return &ret->npobj;
}

static const char Properties[] =

#define ENTRY(nargs, nret, string, id)    "\0" STRINGIFY(__LINE__) "|" string
#include "gmp-entries.h"

#define CONSTANT(constval, string, type)  "\0|" string
#include "gmp-constants.h"

    "\0";

static const EntryInfo*
first_entry ()
{
    return &Properties[1];
}

static const EntryInfo*
next_entry (const EntryInfo* info)
{
    const char* ret = info + strlen (info) + 1;
    return (*ret ? ret : 0);
}

static const char*
EntryInfo_name (const EntryInfo* info)
{
    return strchr (info, '|') + 1;
}

static bool
is_table_entry (const char* info)
{
    return info >= &Properties[0] &&
        info < &Properties[sizeof Properties];
}

static const EntryInfo*
lookup (const NPUTF8* name)
{
    for (const EntryInfo* i = first_entry (); i; i = next_entry (i)) {
        if (!strcmp (name, EntryInfo_name (i)))
            return i;
    }
    return 0;
}

static void
EntryInfo_deallocate (const EntryInfo* info)
{
    /* If it's not in our const table, it came from NPN_MemAlloc. */
    if (!is_table_entry (info))
        NPN_MemFree ((void*) info);
}

static int
EntryInfo_number (const EntryInfo* info)
{
    return atoi (info);
}

static bool
has_properties (const NPUTF8* name)
{
    size_t len = strlen (name);

    for (const EntryInfo* i = first_entry (); i; i = next_entry (i)) {
        const char* iname = EntryInfo_name (i);
        if (!strncmp (name, iname, len) && iname[len] == '.')
            return true;
    }
    return false;
}

static const char*
Entry_name (Entry* entry)
{
    const EntryInfo* ret = entry->info;
    if (is_table_entry (ret))
        return EntryInfo_name (ret);
    return (const char*) ret;
}

static void
Entry_deallocate (NPObject *npobj)
{
#if DEBUG_ALLOC
    fprintf (stderr, "Entry deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    TopObject* top = Entry_getTop (npobj);
    EntryInfo_deallocate (((Entry*) npobj)->info);
    NPN_ReleaseObject ((NPObject*) top);
    NPN_MemFree (npobj);
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

/* Convert arguments from NPVariant to C types and free them when done.  */

#undef IN
#define IN(i, t) LIKELY (in_ ## t (vTop, vArgs + i, &vEntryArgs->a ## i))

#undef DEL
#define DEL(i, t) del_ ## t (vEntryArgs->a ## i)

#undef PROTO_IN
#define PROTO_IN(id)                                            \
    static inline bool ALWAYS_INLINE                            \
    in__ ## id (TopObject *vTop, const NPVariant *vArgs,        \
                Args_ ## id* vEntryArgs)

#undef PROTO_DEL
#define PROTO_DEL(id)                                           \
    static inline void ALWAYS_INLINE                            \
    del__ ## id (Args_ ## id* vEntryArgs)

#define ENTRY0(fun, string, id)                                 \
    typedef struct { char dummy; } Args_ ## id;                 \
    PROTO_IN (id)                                               \
    {                                                           \
        return true;                                            \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
    }

#define ENTRY1(fun, string, id, t0)                             \
    typedef struct { t0 a0; } Args_ ## id;                      \
    PROTO_IN (id)                                               \
    {                                                           \
        if (!IN (0, t0)) goto del0_ ## id;                      \
        return true; del0_ ## id:                               \
        return false;                                           \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
        DEL (0, t0);                                            \
    }

#define ENTRY2(fun, string, id, t0, t1)                         \
    typedef struct { t0 a0; t1 a1; } Args_ ## id;               \
    PROTO_IN (id)                                               \
    {                                                           \
        if (!IN (0, t0)) goto del0_ ## id;                      \
        if (!IN (1, t1)) goto del1_ ## id;                      \
        return true; del1_ ## id:                               \
        DEL (0, t0); del0_ ## id:                               \
        return false;                                           \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
        DEL (1, t1);                                            \
        DEL (0, t0);                                            \
    }

#define ENTRY3(fun, string, id, t0, t1, t2)                     \
    typedef struct { t0 a0; t1 a1; t2 a2; } Args_ ## id;        \
    PROTO_IN (id)                                               \
    {                                                           \
        if (!IN (0, t0)) goto del0_ ## id;                      \
        if (!IN (1, t1)) goto del1_ ## id;                      \
        if (!IN (2, t2)) goto del2_ ## id;                      \
        return true; del2_ ## id:                               \
        DEL (1, t1); del1_ ## id:                               \
        DEL (0, t0); del0_ ## id:                               \
        return false;                                           \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
        DEL (2, t2);                                            \
        DEL (1, t1);                                            \
        DEL (0, t0);                                            \
    }

#define ENTRY4(fun, string, id, t0, t1, t2, t3)                 \
    typedef struct { t0 a0; t1 a1; t2 a2; t3 a3; } Args_ ## id; \
    PROTO_IN (id)                                               \
    {                                                           \
        if (!IN (0, t0)) goto del0_ ## id;                      \
        if (!IN (1, t1)) goto del1_ ## id;                      \
        if (!IN (2, t2)) goto del2_ ## id;                      \
        if (!IN (3, t3)) goto del3_ ## id;                      \
        return true; del3_ ## id:                               \
        DEL (2, t2); del2_ ## id:                               \
        DEL (1, t1); del1_ ## id:                               \
        DEL (0, t0); del0_ ## id:                               \
        return false;                                           \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
        DEL (3, t3);                                            \
        DEL (2, t2);                                            \
        DEL (1, t1);                                            \
        DEL (0, t0);                                            \
    }

#define ENTRY5(fun, string, id, t0, t1, t2, t3, t4)             \
    typedef struct { t0 a0; t1 a1; t2 a2; t3 a3; t4 a4; }       \
        Args_ ## id;                                            \
    PROTO_IN (id)                                               \
    {                                                           \
        if (!IN (0, t0)) goto del0_ ## id;                      \
        if (!IN (1, t1)) goto del1_ ## id;                      \
        if (!IN (2, t2)) goto del2_ ## id;                      \
        if (!IN (3, t3)) goto del3_ ## id;                      \
        if (!IN (4, t4)) goto del4_ ## id;                      \
        return true; del4_ ## id:                               \
        DEL (3, t3); del3_ ## id:                               \
        DEL (2, t2); del2_ ## id:                               \
        DEL (1, t1); del1_ ## id:                               \
        DEL (0, t0); del0_ ## id:                               \
        return false;                                           \
    }                                                           \
    PROTO_DEL (id)                                              \
    {                                                           \
        DEL (4, t4);                                            \
        DEL (3, t3);                                            \
        DEL (2, t2);                                            \
        DEL (1, t1);                                            \
        DEL (0, t0);                                            \
    }

#include "gmp-entries.h"

/* Convert C function results to NPVariant and deallocate the C values.  */

#undef OUT
#define OUT(i, t)                                               \
    (outdel_ ## t (vTop, vEntryResults->a ## i, vResults + i)   \
     || (del_ ## t (vEntryResults->a ## i), false))

#undef DEL
#define DEL(i, t) del_ ## t (vEntryResults->a ## i)

#undef PROTO_OUT
#define PROTO_OUT(id)                                           \
    static inline bool ALWAYS_INLINE                            \
    out__ ## id (TopObject *vTop, Results_ ## id* vEntryResults,\
                 NPVariant *vResults)

#define ENTRYR0(fun, string, id)                                \
    typedef struct { char dummy; } Results_ ## id;              \
    PROTO_OUT (id)                                              \
    {                                                           \
        return true;                                            \
    }

/* XXX not scalable to more return values */
#define ENTRYR1(fun, string, id, r0)                            \
    typedef struct { r0 a0; } Results_ ## id;                   \
    PROTO_OUT (id)                                              \
    {                                                           \
        return OUT (0, r0);                                     \
    }

/* XXX not scalable to more return values */
#define ENTRYR2(fun, string, id, r0, r1)                        \
    typedef struct { r0 a0; r1 a1; } Results_ ## id;            \
    PROTO_OUT (id)                                              \
    {                                                           \
        bool ret = true;                                        \
        if (ret) ret = OUT (0, r0); else DEL (0, r0);           \
        if (ret) {                                              \
            ret = OUT (1, r1);                                  \
            if (!ret)                                           \
                NPN_ReleaseVariantValue (&vResults[0]);         \
        }                                                       \
        else                                                    \
            DEL (1, r1);                                        \
        return ret;                                             \
    }

#include "gmp-entries.h"

#undef PROTO
#define PROTO(id)                                               \
    static inline void ALWAYS_INLINE                            \
    call__ ## id (TopObject *vTop, Args_ ## id* i, Results_ ## id* o)

#define ENTRY0R1(fun, string, id, r0)                           \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun ();                                         \
    }

#define ENTRY1R0(fun, string, id, t0)                           \
    PROTO (id)                                                  \
    {                                                           \
        fun (i->a0);                                            \
    }

#define ENTRY1R1(fun, string, id, r0, t0)                       \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (i->a0);                                    \
    }

#define ENTRY1R2(fun, string, id, r0, r1, t0)                   \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (&o->a1, i->a0);                            \
    }

#define ENTRY2R0(fun, string, id, t0, t1)                       \
    PROTO (id)                                                  \
    {                                                           \
        fun (i->a0, i->a1);                                     \
    }

#define ENTRY2R1(fun, string, id, r0, t0, t1)                   \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (i->a0, i->a1);                             \
    }

#define ENTRY3R0(fun, string, id, t0, t1, t2)                   \
    PROTO (id)                                                  \
    {                                                           \
        fun (i->a0, i->a1, i->a2);                              \
    }

#define ENTRY3R1(fun, string, id, r0, t0, t1, t2)               \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (i->a0, i->a1, i->a2);                      \
    }

#define ENTRY3R2(fun, string, id, r0, r1, t0, t1, t2)           \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (&o->a1, i->a0, i->a1, i->a2);              \
    }

#define ENTRY4R0(fun, string, id, t0, t1, t2, t3)               \
    PROTO (id)                                                  \
    {                                                           \
        fun (i->a0, i->a1, i->a2, i->a3);                       \
    }

#define ENTRY4R1(fun, string, id, r0, t0, t1, t2, t3)           \
    PROTO (id)                                                  \
    {                                                           \
        o->a0 = fun (i->a0, i->a1, i->a2, i->a3);               \
    }

#define ENTRY5R0(fun, string, id, t0, t1, t2, t3, t4)           \
    PROTO (id)                                                  \
    {                                                           \
        fun (i->a0, i->a1, i->a2, i->a3, i->a4);                \
    }

#include "gmp-entries.h"

static bool
enter (TopObject* top, int entryNumber,
       const NPVariant *args, NPVariant *results)
{
    switch (entryNumber) {

        /* XXX Could distinguish pre-call from post-call errors.  */
#define ENTRY(nargs, nret, string, id)                  \
        case __LINE__: {                                \
            Args_    ## id i;                           \
            Results_ ## id o;                           \
            if (!in__ ## id (top, args, &i))            \
                return false;                           \
            call__ ## id (top, &i, &o);                 \
            del__ ## id (&i);                           \
            return out__ ## id (top, &o, results);      \
        }
            
#include "gmp-entries.h"

    default:
        return false;
    }
}

static bool
Entry_invokeDefault (NPObject *npobj,
                     const NPVariant *args, uint32_t argCount,
                     NPVariant *result)
{
    TopObject* top = Entry_getTop (npobj);
    Entry* entry = (Entry*) npobj;
    size_t nargs, nret;
    Tuple* tuple = 0;  /* avoid a warning */
    NPVariant* out;

    if (entry->number == 0)
        return false;

    nargs = Entry_length (npobj);
    nret = Entry_outLength (npobj);
    if (argCount != nargs)
        return throwf ((NPObject*) top, result, true,
                       "wrong argument count: %d, expected %d",
                       argCount, nargs);

    if (nret <= 1)
        out = result;
    else {
        tuple = make_tuple (top, nret);
        if (!tuple)
            return oom (npobj, result, true);
        out = tuple->start;
    }

    if (!enter (top, entry->number, args, out)) {
        if (nret > 1)
            NPN_ReleaseObject ((NPObject*) tuple);
        return throwf ((NPObject*) top, result, true,
                       "%s: %s", Entry_name (entry),
                       top->errmsg ?: "wrong argument type");
    }

    if (nret == 0)
        VOID_TO_NPVARIANT (*result);

    else if (nret > 1) {
        if (retain_for_js (top, (NPObject*) tuple))
            OBJECT_TO_NPVARIANT ((NPObject*) tuple, *result);
        else {
            NPN_ReleaseObject ((NPObject*) tuple);
            raise_oom ((NPObject*) top);
        }
    }

    return check_ex (top, npobj, result, true);
}

/* Non-detachable Entry methods.  XXX Should implement call and apply.  */

static bool
Entry_hasMethod(NPObject *npobj, NPIdentifier name)
{
    return name == ID_toString;
}

static bool
Entry_invoke (NPObject *npobj, NPIdentifier name,
              const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    if (name == ID_toString) {
        const char* name = Entry_name ((Entry*) npobj);
        const char format[] = "function %s() { [native code] }";
        size_t len = sizeof format + strlen (name) - 2;
        char* ret = (char*) NPN_MemAlloc (len);

        if (!ret)
            return oom (npobj, result, true);

        sprintf (ret, format, name);
        STRINGN_TO_NPVARIANT (ret, len, *result);
        return true;
    }
    return false;
}

static NPUTF8*
get_fullname (TopObject* top, Entry* entry, NPIdentifier key)
{
    size_t len;
    NPUTF8* name;
    const NPUTF8* ename;
    NPUTF8* fullname;

    name = NPN_UTF8FromIdentifier (key);
    if (!name) {
        raise_oom ((NPObject*) top);
        return 0;
    }

    if (!entry)
        return name;

    ename = Entry_name (entry);
    len = strlen (ename) + strlen (name) + 2;
    fullname = (NPUTF8*) NPN_MemAlloc (len);
    if (fullname)
        sprintf (fullname, "%s.%s", ename, name);
    NPN_MemFree (name);
    if (fullname)
        return fullname;
    raise_oom ((NPObject*) top);
    return 0;
}

static bool
has_subproperty (TopObject* top, NPObject *npobj, NPIdentifier key)
{
    Entry* entry = (Entry*) npobj;
    NPUTF8* fullname;
    bool ret;

    if (entry && entry->number &&
        (key == ID_length || key == NPN_GetStringIdentifier ("outLength")))
        return true;

    if (!NPN_IdentifierIsString (key))
        return false;

    fullname = get_fullname (top, entry, key);
    if (!fullname)
        return check_ex (top, npobj, 0, false);

    ret = lookup (fullname) != 0 || has_properties (fullname);

    NPN_MemFree (fullname);
    return ret;
}

static bool
Entry_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return has_subproperty (Entry_getTop (npobj), npobj, key);
}

static bool
get_entry (TopObject* top, const EntryInfo* info, NPVariant *result)
{
    int number = EntryInfo_number (info);
    Entry* entry;

    if (number == 0)
        return false;

    entry = (Entry*) NPN_CreateObject (top->instance, &top->Entry.npclass);

    if (entry) {
        entry->info = info;
        entry->number = number;
        OBJECT_TO_NPVARIANT ((NPObject*) entry, *result);
    }
    else
        raise_oom ((NPObject*) top);

    return true;
}

static bool
get_subproperty (TopObject* top, NPObject *npobj, NPIdentifier key,
                 NPVariant *result)
{
    Entry* entry = (Entry*) npobj;
    NPUTF8* fullname;
    const EntryInfo* info;

    if (!NPN_IdentifierIsString (key)) {
        VOID_TO_NPVARIANT (*result);
        return true;
    }

    if (entry && entry->number) {
        if (key == ID_length) {
            INT32_TO_NPVARIANT (Entry_length (npobj), *result);
            return true;
        }
        if (key == NPN_GetStringIdentifier ("outLength")) {
            INT32_TO_NPVARIANT (Entry_outLength (npobj), *result);
            return true;
        }
    }

    fullname = get_fullname (top, entry, key);
    if (!fullname)
        return check_ex (top, npobj, result, true);

    info = lookup (fullname);
    if (!info) {
        if (has_properties (fullname)) {
            Entry* subentry = (Entry*) NPN_CreateObject
                (top->instance, &top->Entry.npclass);
            if (subentry) {
                subentry->number = 0;
                subentry->info = fullname;
                OBJECT_TO_NPVARIANT ((NPObject*) subentry, *result);
                return true;
            }
        }
        else
            VOID_TO_NPVARIANT (*result);
    }
    else if (get_entry (top, info, result))
        /* ok */ ;

#define CONSTANT(value, string, type)           \
    else if (!strcmp (string, fullname))        \
        out_ ## type (top, value, result);
#include "gmp-constants.h"

    NPN_MemFree (fullname);
    return check_ex (top, npobj, result, true);
}

static bool
Entry_getProperty (NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    return get_subproperty (Entry_getTop (npobj), npobj, key, result);
}

static bool
enumerate_sub (TopObject* top, NPObject *npobj, NPIdentifier **value,
               uint32_t *count)
{
    Entry* entry = (Entry*) npobj;
    uint32_t cnt = 0;
    NPIdentifier *ptr = 0;
    char* prefix;
    size_t prefix_len;
    const char* last;
    size_t last_len;
    size_t max_len = 0;
    NPUTF8* buf = 0;

    if (entry) {
        const char* name = Entry_name (entry);
        prefix_len = strlen (name) + 1;
        prefix = NPN_MemAlloc (prefix_len + 1);
        if (!prefix) {
            *count = 0;
            *value = 0;
            return oom (npobj ?: (NPObject*) top, 0, true);
        }
        sprintf (prefix, "%s.", name);
    }
    else {
        prefix = "";
        prefix_len = 0;
    }

    /* For simplicity, assume every entry and its subentries are
       contiguous, not like this:
       gmp.mpz
       gmp.mpq      <-- interrupts the gmp.mpz subtree
       gmp.mpz.init

       Such interruptions will result in duplicates returned by (a in b).
     */
    /* Scan once for count, then allocate, and scan to fill the array.  */
    last = 0;
    last_len = 0;
    for (const EntryInfo* i = first_entry (); i; i = next_entry (i)) {
        const char* iname = EntryInfo_name (i);
        if (strncmp (prefix, iname, prefix_len) != 0)
            continue;
        const char* sub = iname + prefix_len;
        size_t sub_len = strcspn (sub, ".");
        if (last && last_len == sub_len && !strncmp (last, sub, sub_len))
            continue;  /* seen already */
        cnt++;
        last = sub;
        last_len = sub_len;
        if (sub_len > max_len)
            max_len = sub_len;
    }

    if (cnt)
        ptr = (NPIdentifier*) NPN_MemAlloc (cnt * sizeof ptr[0]);
    if (ptr)
        buf = (NPUTF8*) NPN_MemAlloc (max_len + 1);

    if (!buf) {
        if (entry)
            NPN_MemFree (prefix);
        if (ptr)
            NPN_MemFree (ptr);
        *count = 0;
        *value = 0;
        if (cnt)
            return oom (npobj ?: (NPObject*) top, 0, true);
        return true;
    }

    last = 0;
    last_len = 0;
    for (const EntryInfo* i = first_entry (); i; i = next_entry (i)) {
        const char* iname = EntryInfo_name (i);
        if (strncmp (prefix, iname, prefix_len) != 0)
            continue;
        const char* sub = iname + prefix_len;
        size_t sub_len = strcspn (sub, ".");
        if (last && last_len == sub_len && !strncmp (last, sub, sub_len))
            continue;  /* seen already */
        last = sub;
        last_len = sub_len;
        strncpy (buf, sub, sub_len);
        buf[sub_len] = '\0';
        *ptr++ = NPN_GetStringIdentifier (buf);
    }

    *count = cnt;
    *value = ptr - cnt;

    NPN_MemFree (buf);
    if (entry)
        NPN_MemFree (prefix);
    return true;
}

static bool
Entry_enumerate (NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    return enumerate_sub (Entry_getTop (npobj), npobj, value, count);
}

#if NPGMP_SCRIPT

/*
 * Stack-based script support.
 */

#include <search.h>

/* Optimize for optimizability only.  */

typedef struct _Heap {
    struct _Heap* above;
    struct _Heap* below;
    size_t height;
    size_t size;         /* size in NPVariant structures */
    size_t largest; /* size of largest available block in and below this heap */
    size_t avail;        /* total available in and below this heap */
    NPVariant* end;      /* array end (start is end - size) */
    NPVariant* pointer;  /* point of allocation */
    unsigned char markbits[];
} Heap;

typedef struct _Gc {
    Heap** heaps;  /* ordered by address */
    size_t nheaps;
} Gc;

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

static NPClass Opcode_npclass;

static enum Opcode
var_to_opcode (const NPVariant *value)
{
    if (NPVARIANT_IS_OBJECT (*value)) {
        NPObject* obj = NPVARIANT_TO_OBJECT (*value);
        if (obj->_class == &Opcode_npclass)
            return op_to_opcode (obj);
    }
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
        raise_oom (npobj);
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
Opcode_invoke (NPObject *npobj, NPIdentifier name,
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

static NPClass Opcode_npclass = {
    structVersion   : NP_CLASS_STRUCT_VERSION,
    deallocate      : obj_noop,
    invalidate      : obj_invalidate,
    hasMethod       : hasMethod_only_toString,
    invoke          : Opcode_invoke,
    hasProperty     : obj_id_false,
    getProperty     : obj_id_var_void,
    setProperty     : setProperty_ro,
    removeProperty  : removeProperty_ro,
    enumerate       : enumerate_empty
};

/* XXX Should frames be reference-counted or garbage-collected?  */
typedef struct _Frame {
    struct _Frame* next;
    Tuple* code;
    NPVariant* pc;
    /*void* locals;*/
} Frame;

typedef struct _Stack {
    Tuple tuple;
    size_t length;  /* includes substacks.
                       XXX probably should include *only* substacks
                       and be called something like segment_height. */
    ulong segment;  /* number of segments below this one */
    struct _Stack** table;
} Stack;

/* XXX Consider moving to C++.  */

#define SEGMENT_THRESHOLD 32

static inline size_t
Stack_length (const Stack* stack)
{
    return stack->length;
}

static inline void
Stack_set_length (Stack* stack, size_t length)
{
    stack->length = length;
}

static inline NPVariant*
Segment_start (const Stack* stack) { return stack->tuple.start; }
static inline NPVariant*
Segment_end (const Stack* stack) { return stack->tuple.end; }

static inline void
Segment_set_start (Stack* stack, NPVariant* start)
{
    stack->tuple.start = start;
}

static inline void
Segment_set_end (Stack* stack, NPVariant* end)
{
    stack->tuple.end = end;
}

static inline bool
Segment_shared_p (const Stack* seg)
{
    return seg->tuple.npobj.referenceCount > 1;
}

static inline size_t
Segment_length (const Stack* stack)
{
    return Segment_end (stack) - Segment_start (stack);
}

static inline bool
Segment_contains (const Stack* stack, size_t index)
{
    /* Careful!  This relies on unsigned modular arithmetic.  */
    return (size_t) (stack->length - 1 - index) < Segment_length (stack);
}

static inline size_t
Segment_height (const Stack* stack)
{
    return stack->length - Segment_length (stack);
}

static inline void
Segment_set_height (Stack* stack, size_t height)
{
    stack->length = height + Segment_length (stack);
}

static inline Stack**
Segment_table (Stack* stack)
{
    return stack->table;
}

static inline void
Segment_set_table (Stack* stack, Stack** table)
{
    stack->table = table;
}

static Stack**
Segment_copy_table (Stack* stack)
{
    Stack** table;
    size_t n = popcount (stack->segment);

    table = NPN_MemAlloc (n * sizeof table[0]);
    if (table)
        memcpy (table, Segment_get_table (stack), n * sizeof table[0]);
    return table;
}

#if __GNUC__
#define popcount(x) __builtin_popcount (x)
#else

static int
popcount (unsigned int x)
{
    int ret;
    for (ret = 0; x; x >>= 1)
        ret += (x & 1);
    return ret;
}

#endif  /* __GNUC__ */

/* The following four functions share knowledge of stack->table.  The
   table supports lookup by index or segment number in a segmented
   array in O(log(N)) time and O(N*log(N)) space, where N is the
   number of segments.

   XXX The order of pointers in the table should probably be reversed,
   shifting the popcount() burden from sequential to random access.
   Alternatively, one could add the table length to the Stack
   structure.  */

/* Place this segment atop an arbitrary stack.  Return false if memory
   allocation fails.  Assumes STACK->table is *not* live on entry.  */
static bool
Segment_set_prev (Stack* stack, const Stack* prev)
{
    assert (!stack->table);

    if (prev) {
        size_t n;
        Stack** table;
        unsigned int mask;

        stack->segment = prev->segment + 1;
        n = popcount (stack->segment);
        table = (Stack**) NPN_MemAlloc (n * sizeof table[0]);
        if (!table)
            return false;

        Segment_set_table (stack, table);
        NPN_RetainObject ((NPObject*) prev);
        mask = stack->segment;
        for (unsigned int bit = 1; bit < stack->segment; bit <<= 1) {
            if (stack->segment & bit)
                table[--n] = Stack_segment (prev, mask &~ bit);
            mask |= bit;
        }
        assert (n == 0);
        Stack_set_length (stack, Segment_length (stack) + Stack_length (prev));
    }
    else {
        stack->segment = 0;
        Segment_set_table (stack, 0);
        Stack_set_length (stack, Segment_length (stack));
    }
    return true;
}

/* Return the segment containing INDEX.  */
static Stack*
Stack_segment_containing (const Stack* stack, size_t index)
{
    assert (index < Stack_get_length (stack));
    while (!Segment_contains (stack, index)) {
        Stack** table = Segment_table (stack);
        size_t i;
        for (i = 0; index >= Stack_get_length (table[i]); i++)
            continue;
        stack = table[i];
    }
    return stack;
}

/* Return segment number SEGMENT.  */
static Stack*
Stack_get_segment (const Stack* stack, unsigned int segment)
{
    assert (segment <= stack->segment);
    while (segment != stack->segment) {
        Stack** table = Segment_table (stack);
        size_t i;
        for (i = 0; segment >= table[i]->segment; i++)
            continue;
        stack = table[i];
    }
    return stack;
}

/* Return a pointer to the table element holding a pointer to the
   previous segment.  The stack is valid so long as the previous
   segment's number is one less than STACK->segment, every segment's
   length field is correct, and there are no empty segments.  */
static inline Stack**
Segment_prev_ref (const Stack* stack)
{
    return Segment_table (stack) + (popcount (stack->segment) - 1);
}

/* End of functions intimate with stack->table.  */

#if EXAMPLE_FOR_DOCUMENTATION
static bool
Stack_valid_p (const Stack* stack)
{
    size_t segment_length = Segment_length (stack);
    const Stack* prev = *(Stack_wprev_ref (stack));
    size_t prev_length = (prev ? prev->length : 0);
    size_t prev_number = (prev ? prev->segment : 0);

    /* This assumes all STACK->table elements point to segments of STACK.  */
    return segment_length > 0 &&
        stack->length == prev_length + segment_length &&
        stack->segment == prev_segment + 1 &&
        (prev == 0 || Stack_valid_p (prev));
}
#endif  /* EXAMPLE_FOR_DOCUMENTATION */

static NPVariant*
Stack_ref (const Stack* stack, size_t index)
{
    size_t offset;
    stack = Stack_segment_containing (stack, index);
    return Segment_start (stack) + (index - Segment_height (stack));
}

static Stack*
Segment_prev (const Stack* stack)
{
    return (stack->segment ? *Segment_prev_ref (stack) : 0);
}

static inline void
Segment_init (Stack* stack, NPVariant* start, NPVariant* end,
              size_t height, unsigned int segment, Stack** table)
{
    Segment_set_start  (stack, start);
    Segment_set_end    (stack, end);
    Segment_set_height (stack, height);
    stack->segment = segment;
    Segment_set_table  (stack, table);
}

static const Stack*
Stack_create (TopObject* top, NPVariant* start, NPVariant* end,
              size_t height, unsigned int segment, Stack** table)
{
    Stack* stack;

    stack = (Stack*) NPN_CreateObject (top->instance, &top->Stack.npclass);

    if (stack)
        Segment_init (stack, start, end, height, segment, table);
    return stack;
}

/* Return a pass-thru copy of the part of STACK from 0 to INDEX, or
   null if allocation fails.  Requires INDEX > 0.  */

static Stack*
Stack_substack (TopObject* top, const Stack* stack, size_t index)
{
    Stack* copy;
    Stack** table;
    assert (index <= Stack_length (stack));
    assert (index > 0);

    copy = Stack_segment_containing (stack, index - 1);

    if (index == Stack_length (copy)) {
        NPN_RetainObject ((NPObject*) copy);
        return copy;
    }
    assert (Segment_length (copy) > 1);

    table = Segment_copy_table (copy);
    if (!table)
        return 0;

    copy = Stack_create (top, Segment_start (copy),
                         Segment_start (copy) + (index - Segment_height (copy)),
                         Segment_height (copy), copy->segment, table);
    if (!copy)
        NPN_MemFree (table);
    return copy;
}

static void
Segment_clear (Stack* stack)
{
    Stack* prev = Segment_prev (stack);
    if (prev) {
        NPN_ReleaseObject ((NPObject*) prev);
        NPN_MemFree (stack->table);
#ifndef NDEBUG
        stack->table = 0;
#endif
    }
}

static NPObject*
Stack_allocate (NPP npp, NPClass *aClass)
{
    Stack* ret = (Stack*) NPN_MemAlloc (sizeof (Stack));
#if DEBUG_ALLOC
    fprintf (stderr, "Stack allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        memset (ret, '\0', sizeof *ret);
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Stack, aClass));
    }
    return (NPObject*) ret;
}

static void
Stack_deallocate (NPObject *npobj)
{
    Stack* stack = (Stack*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "Stack deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */
    if (stack->table)
        Segment_clear (stack);
    NPN_ReleaseObject ((NPObject*) Stack_getTop (npobj));
    NPN_MemFree (npobj);
}

static bool
Stack_hasProperty (NPObject *npobj, NPIdentifier key)
{
    return Tuple_hasProperty (npobj, key) ||
        key == NPN_GetStringIdentifier ("segment") ||
        key == NPN_GetStringIdentifier ("previousSegment");
}

static bool
stack_getProperty (NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    const Stack* stack = (Stack*) npobj;

    if (tuple_getProperty (npobj, key, result))
        return true;
    if (key == NPN_GetStringIdentifier ("segment"))
        DOUBLE_TO_NPVARIANT ((double) stack->segment, *result);
    else if (key == NPN_GetStringIdentifier ("previousSegment")) {
        stack = Segment_prev (stack);
        if (stack)
            OBJECT_TO_NPVARIANT (NPN_RetainObject ((NPObject*) stack), *result);
        else
            VOID_TO_NPVARIANT (*result);
    }
    else
        VOID_TO_NPVARIANT (*result);
    return true;
}

static bool
Stack_getProperty (NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    if (!stack_getProperty (npobj, key, result))
        VOID_TO_NPVARIANT (*result);
    return true;
}

typedef struct _Root {
    NPObject npobj;
    NPObject* payload;
    struct _Root** prev;
    struct _Root* next;
} Root;

static NPObject*
Root_allocate (NPP npp, NPClass *aClass)
{
    Root* ret = (Root*) NPN_MemAlloc (sizeof (Root));
#if DEBUG_ALLOC
    fprintf (stderr, "Root allocate %p\n", ret);
#endif  /* DEBUG_ALLOC */
    if (ret) {
        memset (ret, '\0', sizeof *ret);
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Root, aClass));
        ret->payload = 0;
    }
    return (NPObject*) ret;
}

static void
Root_deallocate (NPObject *npobj)
{
    Root* root = (Root*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "Root deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */

    if (root->prev)
        *root->prev = root->next;
    if (root->next)
        root->next->prev = root->prev;

    NPObject* payload = root->payload;
    if (payload)
        NPN_ReleaseObject (payload);
    NPN_ReleaseObject ((NPObject*) &Root_getTop (npobj));
    NPN_MemFree (npobj);
}

/* Forward all methods other than memory management to the payload object.  */

static bool
Root_hasMethod (NPObject *npobj, NPIdentifier name)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_HasMethod (top->instance, root->payload, name);
}
static bool
Root_invoke (NPObject *npobj, NPIdentifier name,
             const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_Invoke (top->instance, root->payload, name, args, argCount,
                       result);
}
static bool
Root_invokeDefault (NPObject *npobj,
                    const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_InvokeDefault (top->instance, root->payload, args, argCount,
                              result);
}
static bool
Root_hasProperty (NPObject *npobj, NPIdentifier name)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_HasProperty (top->instance, root->payload, name);
}
static bool
Root_getProperty (NPObject *npobj, NPIdentifier name, NPVariant *result)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_GetProperty (top->instance, root->payload, name, result);
}
static bool
Root_setProperty (NPObject *npobj, NPIdentifier name, const NPVariant *value)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_SetProperty (top->instance, root->payload, name, value);
}
static bool
Root_removeProperty (NPObject *npobj, NPIdentifier name)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_RemoveProperty (top->instance, root->payload, name);
}
static bool
Root_enumerate (NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_Enumerate (top->instance, root->payload, value, count);
}
static bool
Root_construct (NPObject *npobj,
                const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    Root* root = (Root*) npobj;
    TopObject* top = Root_getTop (npobj);
    return NPN_Construct (top->instance, root->payload, args, argCount, result);
}


typedef struct _Thread {
    Stack stack;
    Frame frame;
    Heap* heap;
    size_t alloc_since_gc;
    size_t last_heap_size;  /* size in NPVariant structures */
    Root* roots;            /* heap areas pointed to by JavaScript.  */
    NPVariant* pc;
    NPVariant* sp;
    void* tls;              /* to be used with tsearch() */
    Gc* gc;
} Thread;

static THREAD_LOCAL Thread* Current;

typedef struct _Property {
    NPUTF8* key;
    NPVariant* value;
} Property;

static int
compare_properties (const void* a1, const void* a2)
{
    const NPUTF8* s1 = ((Property*) a1)->key;
    const NPUTF8* s2 = ((Property*) a2)->key;
    return strcmp (s1, s2);
}

static void
mark (Gc* gcobj, NPVariant* start, NPVariant* end)
{
    /* XXX do something */
}

static void
mark_root (const void *nodep, VISIT value, int level)
{
    if (value == leaf) {
        NPVariant* var = ((const Property*) nodep)->value;
        mark (Current->gc, var, var + 1);
    }
}

static void
mark_stack (Gc* gcobj, const Stack* stack)
{
    if (stack) {
        mark (gcobj, Segment_start (stack), Segment_end (stack));
        mark_stack (gcobj, Segment_prev (stack));
    }
}

static void
mark_object (Gc* gcobj, NPObject* object)
{
    /* XXX do something */
}

static void
gc (void)
{
    Heap* heap;
    size_t nheaps = Current->heap->height + 1;
    Heap* heaps[nheaps];
    Gc gcobj = { heaps: heaps, nheaps: nheaps };

    for (heap = Current->heap; heap; heap = heap->below) {
        memset (heap->markbits, '\0', ((heap->size + 7) / 8));
        heaps[heap->height] = heap;
    }

    for (Root* root = Current->roots; root; root = root->next)
        mark_object (&gcobj, root->payload);

    Current->gc = &gcobj;  /* twalk() deficiency */

    mark (&gcobj, Current->pc, Current->frame.code->end);
    for (Frame* frame = Current->frame.next; frame; frame = frame->next)
        mark (&gcobj, frame->code->start, frame->code->end);

    /* XXX should avoid marking the *contents* of positions between
       thread->sp and the current segment's end. */
    mark_stack (&gcobj, &Current->stack);

    twalk (Current->roots, mark_root);

    /* XXX sweep/compact */
}

static NPVariant*
vector_alloc (uint32_t size)
{
    Heap* heap;
    Heap** abovep;
    NPVariant* ret;
    size_t avail, largest, alloc, min, max;

    heap = Current->heap;
    while (1) {

        if (!heap || heap->largest < size) {
            heap = Current->heap;
            if (heap &&
                Current->alloc_since_gc * 2 >  Current->last_heap_size && 
                heap->avail                 >= size                    &&
                Current->last_heap_size     >= size)
            {
                gc ();
                Current->alloc_since_gc = 0;
                continue;
            }
            break;
        }

        avail = heap->end - heap->pointer;

        if (avail >= size) {

            /* Success.  */
            ret = heap->pointer;
            heap->pointer += size;

            largest = heap->largest;
            if (largest < avail - size) {
                largest = avail - size;
                if (heap->below && heap->below->largest > largest)
                    largest = heap->below->largest;
            }

            for (; heap; heap = heap->above) {
                if (heap->largest <= largest) {
                    if (heap->end - heap->pointer > largest)
                        largest = heap->end - heap->pointer;
                    heap->largest = largest;
                }
                heap->avail -= size;
            }

            Current->alloc_since_gc += size;
            return ret;
        }

        heap = heap->below;
    }

    min = 1024;
    max = 1024*1024;
    alloc = min;
    if (alloc < Current->last_heap_size * 4)
        alloc = Current->last_heap_size * 4;
    if (alloc > max)
        alloc = max;
    if (alloc < size)  /* XXX should this affect thread->last_heap_size? */
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

    Current->last_heap_size = alloc;
    avail = alloc - size;

    heap->size    = alloc;
    heap->end     = ret + alloc;
    heap->pointer = ret + size;
    heap->above   = 0;

    /* Move heap to its place in the list ordered by address.  */
    abovep = &Current->heap;
    while (*abovep && (*abovep)->end > heap->end) {
        heap->above = *abovep;
        (*abovep)->height++;
        (*abovep)->avail += avail;
        if ((*abovep)->largest < avail)
            (*abovep)->largest = avail;
        abovep = &(*abovep)->below;
    }
    heap->below = *abovep;
    *abovep = heap;

    heap->largest = avail;
    if (heap->below) {
        heap->below->above = heap;
        heap->height = heap->below->height + 1;
        if (heap->below->largest > avail)
            heap->largest = heap->below->largest;
        heap->avail = avail + heap->below->avail;
    }
    else {
        heap->height = 0;
        heap->avail = avail;
    }

    Current->alloc_since_gc += size;

    return ret;
}

static NPVariant*
tuple_alloc (uint32_t size)
{
    return vector_alloc (size);
}

static void
tuple_free (Tuple* tuple)
{
    /* Nothing to do, data is in a garbage-collected heap.  */
}

static bool
retain_for_js (TopObject* top, NPObject* npobj)
{
    Root* root = (Root*) NPN_CreateObject (top->instance, &top->Root.npclass);
    if (!root)
        return false;
    root->payload = NPN_RetainObject (npobj);
    root->next = Current->roots;
    if (root->next)
        root->next->prev = &root->next;
    root->prev = &Current->roots;
    Current->roots = root;
    return true;
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
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Thread, aClass));
    }
    return (NPObject*) ret;
}

static void
Thread_deallocate (NPObject *npobj)
{
    Thread* thr = (Thread*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "Thread deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */

    for (Heap* heap = thr->heap; heap;) {
        for (NPVariant* v = heap->end - heap->size; v < heap->pointer; v++)
            NPN_ReleaseVariantValue (v);

        if (!heap->below) {
            NPN_MemFree (heap);
            break;
        }
        heap = heap->below;
        NPN_MemFree (heap->above);
    }

    for (Frame* frame = thr->frame.next; frame; ) {
        Frame* next = frame->next;
        NPN_MemFree (frame);
        if (!next)
            break;
        frame = next;
    }

    TopObject* top = Thread_getTop (npobj);
    NPN_ReleaseObject ((NPObject*) top);
    NPN_MemFree (npobj);
}

static bool
Thread_hasProperty(NPObject *npobj, NPIdentifier key)
{
    NPUTF8* name;

    if (!NPN_IdentifierIsString (key))
        return false;
    name = NPN_UTF8FromIdentifier (key);
    return !!tfind (&name, &((Thread*) npobj)->tls, compare_properties);
}

static bool
Thread_getProperty(NPObject *npobj, NPIdentifier key, NPVariant* result)
{
    if (NPN_IdentifierIsString (key)) {
        NPUTF8* name = NPN_UTF8FromIdentifier (key);
        Property* found = (Property*) tfind (&name, &((Thread*) npobj)->tls,
                                             compare_properties);
        if (found)
            return copy_npvariant (npobj, result, found->value);
    }
    VOID_TO_NPVARIANT (*result);
    return true;
}

/* Reject containers to avoid reference loops.  */
static bool
allowed_in_heap (TopObject* top, const NPVariant* var)
{
    NPObject* o;

    if (!NPVARIANT_IS_OBJECT (*var))
        return true;

    o = NPVARIANT_TO_OBJECT (*var);
    return (o->_class == &Opcode_npclass || IS_INSTANCE_OBJECT (top, o));
}

static bool
Thread_setProperty(NPObject *npobj, NPIdentifier key, const NPVariant* value)
{
    return false;  // XXX use tsearch
}

static bool
Thread_removeProperty(NPObject *npobj, NPIdentifier key)
{
    return false;  // XXX use tdelete
}

static bool
Thread_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *count = 0;  // XXX use twalk
    return true;
}

/*
 * Class of the "op" object.
 */

static NPObject*
Op_allocate (NPP npp, NPClass* aClass)
{
    NPObject* ret = (NPObject*) NPN_MemAlloc (sizeof (NPObject));
    if (ret)
        NPN_RetainObject ((NPObject*) CONTAINING (TopObject, Op, aClass));
        //NPN_RetainObject ((NPObject*) npp->pdata);
    return ret;
}

static void
Op_deallocate (NPObject *npobj)
{
    TopObject* top = Op_getTop (npobj);
#if DEBUG_ALLOC
    fprintf (stderr, "Op deallocate %p; %u\n", npobj, (unsigned int) top->npobj.referenceCount);
#endif  /* DEBUG_ALLOC */
    top->npobjOp = 0;
    NPN_MemFree (npobj);
    /* Decrement the top object's reference count.  See comments in
       Mpz_deallocate.  */
    NPN_ReleaseObject ((NPObject*) top);
}

static bool
Op_hasMethod(NPObject *npobj, NPIdentifier name)
{
    return id_to_opnum (npobj, name) >= 0;
}

static bool
Op_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    *count = 0;
    return true;  // XXX
    //*count = NUM_OPS;
}

static bool
Op_invoke (NPObject *npobj, NPIdentifier name,
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

static bool
ensure_stack (Thread* thread, size_t count)
{
    Stack* stack = &thread->stack;
    size_t avail = Segment_end (stack) - thread->sp;

    if (count > avail) {
        
    }
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

/* Return a script represented as function arguments.  */

static bool
Op_invokeDefault (NPObject* npobj,
                  const NPVariant *args, uint32_t argCount, NPVariant *result)
{
    TopObject* top = Op_getTop (npobj);
    Tuple* tuple;

    for (uint32_t i = 0; i < argCount; i++) {
        if (!allowed_in_heap (top, &args[i]))
            return set_exception (npobj, "code includes a container", result,
                                  true);
    }

    tuple = make_tuple (top, argCount);
    for (uint32_t i = 0; i < argCount; i++) {
        if (!copy_npvariant (npobj, &tuple->start[i], &args[i])) {
            VOID_TO_NPVARIANT (*result);
            NPN_ReleaseObject (&tuple->npobj);
            return true;
        }
    }

    OBJECT_TO_NPVARIANT (&tuple->npobj, *result);
    return true;
}

/* Returns the number of valid stack elements, not beyond thread->sp.  */
static size_t
Thread_length (const Thread* thread)
{
    return Segment_height (&thread->stack) +
        (thread->sp - Segment_start (&thread->stack));
}

static NPVariant*
stack_get (const Stack* stack, size_t index, bool* shared)
{
    size_t length = stack->length;
    assert (index < length);
    while (!Segment_shared_p (stack)) {
        length -= Segment_length (stack);
        if (length <= index) {
            *shared = false;
            return Segment_start (stack) + (index - length);
        }
        stack = Segment_prev (stack);
    }
    *shared = true;
    return Stack_ref (stack, index);
}

/* Splice out the top element of the (shared) previous segment. */
static bool
stack_drop_prev_elt (TopObject* top, Stack* stack)
{
    size_t pos = Segment_height (stack);
    const Stack* prev = Stack_substack (top, stack, pos - 1);
    bool ret;

    if (!prev)
        return false;

    if (LIKELY (prev->segment == stack->segment - 1)) {
        const Stack** pprev = Segment_prev_ref (stack);
        NPN_ReleaseObject ((NPObject*) *pprev);
        *pprev = prev;
        Segment_set_height (stack, Segment_height (stack) - 1);
        return true;
    }

    Segment_clear (stack);
    ret = Segment_set_prev (stack, prev);
    NPN_ReleaseObject ((NPObject*) prev);
    return ret;
}

static bool
undef (NPVariant* result)
{
    VOID_TO_NPVARIANT (*result);
    return true;
}

static NPVariant*
peek_arg (Thread* thread, bool* shared)
{
    Stack* stack = &thread->stack;
    const Stack* prev;

    if (thread->sp != Segment_start (stack)) {
        *shared = false;
        return thread->sp - 1;
    }
    if (stack->segment == 0) {
        raisef ((NPObject*) thread, "stack underflow");
        return 0;
    }
    prev = Segment_prev (stack);
    *shared = Segment_shared_p (prev);
    return Segment_end (prev) - 1;
}

/* Drop the top stack element when SP points to base of segment.  */
static bool
drop1 (Thread* thread)
{
    TopObject* top = Thread_getTop ((NPObject*) thread);
    Stack* stack = &thread->stack;
    bool shared;
    NPVariant* var;

    assert (thread->sp == Segment_start (stack));

    if (stack->segment == 0) {
        raisef ((NPObject*) thread, "stack underflow");
        return false;
    }
    prev = Segment_prev (stack);
    assert (Segment_length (prev) > 0);

    if (Segment_shared_p (prev)) {
        if (!stack_drop_prev_elt (top, stack)) {
            raise_oom ((NPObject*) thread);
            return false;
        }
    }
    else {
        *stack = *prev;
        Segment_set_table (prev, 0);
        NPN_ReleaseObject ((NPObject*) prev);
        thread->sp = Segment_end (stack) - 1;
        NPN_ReleaseVariantValue (thread->sp);
        VOID_TO_NPVARIANT (*thread->sp);
    }
    return true;
}

/* Drop the top stack element without releasing its variant value.  */
static bool
drop_uninit (Thread* thread)
{
    Stack* stack = &thread->stack;
    if (thread->sp == Segment_start (stack))
        return drop1 (thread);
    thread->sp--;
    VOID_TO_NPVARIANT (*thread->sp);
    return true;
}

static bool
op_roll (Thread* thread)
{
    TopObject* top = Thread_getTop ((NPObject*) thread);
    Stack* stack = &thread->stack;
    Stack* seg;
    size_t index, pos, ipos, len;
    bool shared;
    NPVariant* var;
    NPVariant temp;

    var = peek_arg (thread, &shared);
    if (!var)
        return false;

    if (!in_size_t (top, var, &index)) {
        raisef ((NPObject*) thread, "expected stack index");
        return false;
    }

    pos = Thread_length (thread);
    if (index + 2 > pos) {
        raisef ((NPObject*) thread, "stack bounds exceeded");
        return false;
    }

    ipos = pos - index - 2;  /* position of item to move to the top */
    len = stack->length - Segment_length (stack);  /* top segment base pos */

    if (ipos >= len) {
        /* XXX Should move data only if size is below a threshold.  */
        NPN_ReleaseVariantValue (--thread->sp);
        var = thread->sp - (index + 2);
        temp = *var;
        memmove (var, var + 1, index * sizeof var[0]);
        thread->sp[-1] = temp;
        return true;
    }

    /* Slow path.  */
    var = Stack_ref (pos - 2);
    seg = Stack_prev (stack);

    /* Pop the operand.  */
    if (thread->sp != Segment_start (stack)) {
        NPN_ReleaseVariantValue (--thread->sp);
    }

    else if (!Segment_shared_p (seg)) {
        NPVariant end = Segment_get_end (seg) - 1;
        NPN_ReleaseVariantValue (end);
        stack->length--;

        if (end == Segment_get_start (seg)) {
            /* Discard empty segment.  */
            NPN_MemFree (stack->table);
            stack->table = seg->table;
            stack->segment--;
            seg->table = 0;
            NPN_ReleaseObject ((NPObject*) seg);
            seg = Stack_prev (stack);
        }
        else
            Segment_set_end (seg, end);
    }
    XXX;
    for (; !Segment_shared_p (seg); seg = Stack_wprev (seg)) {
            size_t height = Segment_prev_len (seg);
            size_t offset = (height < ipos ? ipos - height : 0);

    }

}

/* Run a script.  */

static bool
Tuple_invokeDefault (NPObject* npobj,
                     const NPVariant *args, uint32_t argCount,
                     NPVariant *result)
{
    TopObject* top = Tuple_getTop (npobj);
    Thread* thread = Current;
    Stack* stack = &thread->stack;
    Frame* frame = &thread->frame;
    enum Opcode opcode;
    size_t pos;
    const Stack* prev;
    NPObject* fun;
    bool isEntry;
    size_t nargs, nret, needed;
    NPVariant* temp_ptr;
    NPVariant temp;
    size_t index;
    bool shared;
    Tuple* temp_tuple;
    bool ok;

    if (Segment_length (stack) < argCount + 1) {
        size_t alloc = (SEGMENT_THRESHOLD + argCount + 15) &~ 15;
        NPVariant* sp = vector_alloc (alloc);

        if (!sp)
            /* XXX Could try allocating in segments for large argCount. */
            return oom (npobj, result, true);

        Segment_init (stack, sp, thread->sp + alloc, 0, 0, 0);
        thread->sp = sp;
    }

    for (uint32_t i = 0; i < argCount; i++) {
        if (!allowed_in_heap (top, &args[i]))
            return throwf (npobj, result, true, "argument is a container");
    }

    /* Copy args to stack.  */
    for (uint32_t i = 0; i < argCount; i++) {
        if (copy_npvariant (npobj, thread->sp, &args[i])) {
            thread->sp++;
            continue;
        }
        /* Error. */
        while (i--) {
            NPN_ReleaseVariantValue (--thread->sp);
            VOID_TO_NPVARIANT (*thread->sp);
        }
        return check_ex (top, npobj, result, true);
    }

    frame->code = (Tuple*) npobj;
    frame->next = 0;

    for (frame->pc = frame->code->start; ; frame->pc++) {

        if (frame->pc == frame->code->end) {
            Frame next = frame->next;
            if (!frame)
                break;
            *frame = *next;
            NPN_MemFree (next);
            continue;
        }

        opcode = var_to_opcode (frame->pc);
        switch (opcode) {

        case OP_pick:

            temp_ptr = peek_arg (thread, &shared);
            if (UNLIKELY (!temp_ptr))
                return check_ex (top, npobj, result, true);
            if (UNLIKELY (!in_size_t (top, temp_ptr, &index)))
                return throwf (npobj, result, true, "expected stack index");

            pos = Thread_length (thread);
            if (UNLIKELY (index >= pos - 1))
                return throwf (npobj, result, true, "stack bounds exceeded");

            if (UNLIKELY (shared)) {
                if (!stack_drop_prev_elt (top, stack))
                    return oom (npobj, result, true);
                temp_ptr = Segment_start (stack);
            }
            else {
                NPN_ReleaseVariantValue (temp_ptr);
                VOID_TO_NPVARIANT (*temp_ptr);  /* XXX Being careful. */
            }
            if (UNLIKELY (!copy_npvariant (npobj, temp_ptr,
                                           Stack_ref (stack, pos - index - 2))))
                return check_ex (top, npobj, result, true);
            continue;

        case OP_roll:
            if (UNLIKELY (!op_roll (thread)))
                return check_ex (top, npobj, result, true);
            continue;

        case OP_drop:
            if (LIKELY (thread->sp != Segment_start (stack))) {
                NPN_ReleaseVariantValue (--thread->sp);
                VOID_TO_NPVARIANT (*thread->sp);  /* XXX Being careful. */
                continue;
            }
            if (UNLIKELY (!drop1 (thread)))
                return check_ex (top, npobj, result, true);
            continue;

        case OP_quote:
            if (UNLIKELY (!advance_pc (frame)))
                return throwf (npobj, result, true, "incomplete quotation");

            /* FALL THROUGH */
        case OP_DATA:

            /* Push data.  */
            if (UNLIKELY (!extend (thread, 1)))
                return oom (npobj, result, true);

            if (UNLIKELY (!copy_npvariant (npobj, thread->sp - 1, frame->pc))) {
                drop_uninit (thread);
                return check_ex (top, npobj, result, true);
            }

            continue;

        default:
            break;
        }

        if (UNLIKELY (!NPVARIANT_IS_OBJECT (frame->pc)))
            return throwf (npobj, result, true, "not a function");

        fun = NPVARIANT_TO_OBJECT (frame->pc);

        if (fun->_class == &top->Tuple.npclass) {
            Tuple* tuple = (Tuple*) fun;
            Frame* next;

            frame->pc++;
            if (frame->pc == frame->code->end) {
                /* Eliminate the tail call.  */
                frame->code = tuple;
                continue;
            }

            next = (Frame*) NPN_MemAlloc (sizeof (Frame));
            if (!next) {
                frame->pc--;
                return oom (npobj, result, true);
            }
            *next = *frame;
            frame->next = next;
            frame->code = tuple;
            frame->pc   = frame->code->start;
            continue;
        }

        isEntry = (fun->_class == &top->Entry.npclass);
        ok = false;

        if (isEntry) {
            nargs = Entry_length (fun);
            nret = Entry_outLength (fun);
            ok = true;
        }
        else if (NPN_GetProperty (top->instance, fun, ID_length, &temp)) {
            ok = in_size_t (top, &temp, &nargs);
            NPN_ReleaseVariantValue (&temp);
            nret = 1;
        }

        if (!ok)
            return throwf (npobj, result, true, "can not find function arity");

        if (nret > nargs) {
            needed = nret;
            if (UNLIKELY (!extend (thread, nret - nargs)))
                return oom (npobj, result, true);
        }
        else {
            needed = nargs;
        }

        if (UNLIKELY (needed > thread->sp - Segment_start (stack)) &&
            UNLIKELY (!Stack_join (stack, needed)))
            return check_ex (top, npobj, result, true);

        if (nret > nargs)
            memset (thread->sp - (nret - nargs), '\0',
                    (nret - nargs) * sizeof thread->sp[0]);

        if (isEntry) {
            if (UNLIKELY (!enter (top, ((Entry*) fun)->number,
                                  thread->sp - nargs, nargs,
                                  thread->sp - nargs))) {
                /* XXX Where should sp point? */
                return check_ex (top, npobj, result, true);
            }
            if (nret > nargs)
                XXX;  /* XXX can't use overlapping args+result buffers. */
        }
        else {
            /* XXX NPAPI does not report exceptions thrown.  */
            if (!NPN_InvokeDefault (top->instance, fun, thread->sp - needed,
                                    nargs, &temp)) {
                /* XXX Where should sp point? */
            raisef (npobj, "call failed");
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
            raise_oom (npobj);
            return check_ex (top, npobj, result, true);
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

    tuple = (Tuple*) NPN_CreateObject (top->instance, &top->Tuple.npclass);

    if (tuple) {
        tuple->array = thread->stack;
        tuple->nelts = thread->sp - thread->stack;
        retain_for_js (top, (NPObject*) tuple);
        OPBJECT_TO_NPVARIANT (&tuple->npobj, *result);
    }
    else {
        raisef (npobj, "tuple return unsupported");
        return check_ex (top, npobj, result, true);
    }
    return true;
}

static void
init_script ()
{
    for (size_t i = 0; i < NUM_OPS; i++) {
        Ops[i]._class = &Opcode_npclass;
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

#if NPGMP_SCRIPT
        ret->Root.top                        = ret;
        ret->Root.npclass.structVersion      = NP_CLASS_STRUCT_VERSION;
        ret->Root.npclass.allocate           = Root_allocate;
        ret->Root.npclass.deallocate         = Root_deallocate;
        ret->Root.npclass.invalidate         = obj_invalidate;
        ret->Root.npclass.hasMethod          = Root_hasMethod;
        ret->Root.npclass.invoke             = Root_invoke;
        ret->Root.npclass.invokeDefault      = Root_invokeDefault;
        ret->Root.npclass.hasProperty        = Root_hasProperty;
        ret->Root.npclass.getProperty        = Root_getProperty;
        ret->Root.npclass.setProperty        = Root_setProperty;
        ret->Root.npclass.removeProperty     = Root_removeProperty;
        ret->Root.npclass.enumerate          = Root_enumerate;
        ret->Root.npclass.construct          = Root_construct;

        ret->Stack.top                       = ret;
        ret->Stack.npclass.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->Stack.npclass.allocate          = Stack_allocate;
        ret->Stack.npclass.deallocate        = Stack_deallocate;
        ret->Stack.npclass.invalidate        = obj_invalidate;
        ret->Stack.npclass.hasMethod         = obj_id_false;
        ret->Stack.npclass.hasProperty       = Stack_hasProperty;
        ret->Stack.npclass.getProperty       = Stack_getProperty;
        ret->Stack.npclass.setProperty       = Stack_setProperty;
        ret->Stack.npclass.removeProperty    = Stack_removeProperty;
        ret->Stack.npclass.enumerate         = Stack_enumerate;
 
        ret->Thread.top                      = ret;
        ret->Thread.npclass.structVersion    = NP_CLASS_STRUCT_VERSION;
        ret->Thread.npclass.allocate         = Thread_allocate;
        ret->Thread.npclass.deallocate       = Thread_deallocate;
        ret->Thread.npclass.invalidate       = obj_invalidate;
        ret->Thread.npclass.hasMethod        = obj_id_false;
        ret->Thread.npclass.hasProperty      = Thread_hasProperty;
        ret->Thread.npclass.getProperty      = Thread_getProperty;
        ret->Thread.npclass.setProperty      = Thread_setProperty;
        ret->Thread.npclass.removeProperty   = Thread_removeProperty;
        ret->Thread.npclass.enumerate        = Thread_enumerate;
#endif

        ret->Entry.top                       = ret;
        ret->Entry.npclass.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->Entry.npclass.allocate          = Entry_allocate;
        ret->Entry.npclass.deallocate        = Entry_deallocate;
        ret->Entry.npclass.invalidate        = obj_invalidate;
        ret->Entry.npclass.invokeDefault     = Entry_invokeDefault;
        ret->Entry.npclass.hasMethod         = Entry_hasMethod;
        ret->Entry.npclass.invoke            = Entry_invoke;
        ret->Entry.npclass.hasProperty       = Entry_hasProperty;
        ret->Entry.npclass.getProperty       = Entry_getProperty;
        ret->Entry.npclass.setProperty       = setProperty_ro;
        ret->Entry.npclass.removeProperty    = removeProperty_ro;
        ret->Entry.npclass.enumerate         = Entry_enumerate;

        ret->Tuple.top                       = ret;
        ret->Tuple.npclass.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->Tuple.npclass.allocate          = Tuple_allocate;
        ret->Tuple.npclass.deallocate        = Tuple_deallocate;
        ret->Tuple.npclass.invalidate        = obj_invalidate;
#if NPGMP_SCRIPT
        ret->Tuple.npclass.invokeDefault     = Tuple_invokeDefault;
#endif
        ret->Tuple.npclass.hasMethod         = obj_id_false;
        ret->Tuple.npclass.hasProperty       = Tuple_hasProperty;
        ret->Tuple.npclass.getProperty       = Tuple_getProperty;
        ret->Tuple.npclass.setProperty       = setProperty_ro;
        ret->Tuple.npclass.removeProperty    = removeProperty_ro;
        ret->Tuple.npclass.enumerate         = enumerate_empty;

#if NPGMP_MPZ
        ret->Integer.top                     = ret;
        ret->Integer.npclass.structVersion   = NP_CLASS_STRUCT_VERSION;
        ret->Integer.npclass.allocate        = Integer_allocate;
        ret->Integer.npclass.deallocate      = Integer_deallocate;
        ret->Integer.npclass.invalidate      = obj_invalidate;
        ret->Integer.npclass.hasMethod       = hasMethod_only_toString;
        ret->Integer.npclass.invoke          = Integer_invoke;
        ret->Integer.npclass.hasProperty     = obj_id_false;
        ret->Integer.npclass.getProperty     = obj_id_var_void;
        ret->Integer.npclass.setProperty     = setProperty_ro;
        ret->Integer.npclass.removeProperty  = removeProperty_ro;
        ret->Integer.npclass.enumerate       = enumerate_empty;
#endif  /* NPGMP_MPZ */

#if NPGMP_MPQ
        ret->MpzRef.top                      = ret;
        ret->MpzRef.npclass.structVersion    = NP_CLASS_STRUCT_VERSION;
        ret->MpzRef.npclass.allocate         = MpzRef_allocate;
        ret->MpzRef.npclass.deallocate       = MpzRef_deallocate;
        ret->MpzRef.npclass.invalidate       = obj_invalidate;
        ret->MpzRef.npclass.hasMethod        = hasMethod_only_toString;
        ret->MpzRef.npclass.invoke           = MpzRef_invoke;
        ret->MpzRef.npclass.hasProperty      = obj_id_false;
        ret->MpzRef.npclass.getProperty      = obj_id_var_void;
        ret->MpzRef.npclass.setProperty      = setProperty_ro;
        ret->MpzRef.npclass.removeProperty   = removeProperty_ro;
        ret->MpzRef.npclass.enumerate        = enumerate_empty;

        ret->Rational.top                    = ret;
        ret->Rational.npclass.structVersion  = NP_CLASS_STRUCT_VERSION;
        ret->Rational.npclass.allocate       = Rational_allocate;
        ret->Rational.npclass.deallocate     = Rational_deallocate;
        ret->Rational.npclass.invalidate     = obj_invalidate;
        ret->Rational.npclass.hasMethod      = hasMethod_only_toString;
        ret->Rational.npclass.invoke         = Rational_invoke;
        ret->Rational.npclass.hasProperty    = obj_id_false;
        ret->Rational.npclass.getProperty    = obj_id_var_void;
        ret->Rational.npclass.setProperty    = setProperty_ro;
        ret->Rational.npclass.removeProperty = removeProperty_ro;
        ret->Rational.npclass.enumerate      = enumerate_empty;
#endif  /* NPGMP_MPQ */

#if NPGMP_RAND
        ret->Rand.top                        = ret;
        ret->Rand.npclass.structVersion      = NP_CLASS_STRUCT_VERSION;
        ret->Rand.npclass.allocate           = Rand_allocate;
        ret->Rand.npclass.deallocate         = Rand_deallocate;
        ret->Rand.npclass.invalidate         = obj_invalidate;
        ret->Rand.npclass.hasMethod          = obj_id_false;
        ret->Rand.npclass.hasProperty        = obj_id_false;
        ret->Rand.npclass.getProperty        = obj_id_var_void;
        ret->Rand.npclass.setProperty        = setProperty_ro;
        ret->Rand.npclass.removeProperty     = removeProperty_ro;
        ret->Rand.npclass.enumerate          = enumerate_empty;
#endif  /* NPGMP_RAND */

#if NPGMP_MPF
        ret->Float.top                       = ret;
        ret->Float.npclass.structVersion     = NP_CLASS_STRUCT_VERSION;
        ret->Float.npclass.allocate          = Float_allocate;
        ret->Float.npclass.deallocate        = Float_deallocate;
        ret->Float.npclass.invalidate        = obj_invalidate;
        ret->Float.npclass.hasMethod         = hasMethod_only_toString;
        ret->Float.npclass.invoke            = Float_invoke;
        ret->Float.npclass.hasProperty       = obj_id_false;
        ret->Float.npclass.getProperty       = obj_id_var_void;
        ret->Float.npclass.setProperty       = setProperty_ro;
        ret->Float.npclass.removeProperty    = removeProperty_ro;
        ret->Float.npclass.enumerate         = enumerate_empty;

        ret->default_mpf_prec                = 0;
#endif
    }
    return (NPObject*) ret;
}

static void
TopObject_deallocate (NPObject *npobj)
{
    TopObject* top = (TopObject*) npobj;
#if DEBUG_ALLOC
    fprintf (stderr, "TopObject deallocate %p\n", npobj);
#endif  /* DEBUG_ALLOC */

#if 0
    if (top->destroying) {
#if DEBUG_ALLOC
        fprintf (stderr, "TopObject deallocate %p: skipping free\n", npobj);
#endif  /* DEBUG_ALLOC */
        return;
    }
#endif

    free_errmsg (top->errmsg);
    NPN_MemFree (npobj);
}

static bool
TopObject_hasProperty(NPObject *npobj, NPIdentifier key)
{
    return has_subproperty ((TopObject*) npobj, 0, key);
}

static bool
TopObject_getProperty(NPObject *npobj, NPIdentifier key, NPVariant *result)
{
    return get_subproperty ((TopObject*) npobj, 0, key, result);
}

static bool
TopObject_enumerate(NPObject *npobj, NPIdentifier **value, uint32_t *count)
{
    return enumerate_sub ((TopObject*) npobj, 0, value, count);
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

static TopObject*
get_top (NPObject* npobj)
{
    if (npobj->_class == &TopObject_npclass)
        return (TopObject*) npobj;
    return ((Class*) npobj->_class)->top;
}


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

#if NPGMP_SCRIPT
    thread = (Thread*) NPN_CreateObject
        (instance, &((TopObject*) instance->pdata)->npclassThread);
    if (!thread) {
        NPN_ReleaseObject ((NPObject*) instance->pdata);
        return NPERR_OUT_OF_MEMORY_ERROR;
    }
#endif

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
        NPN_ReleaseObject ((NPObject*) top);
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
            *((NPObject**)value) = NPN_RetainObject ((NPObject*) top);
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
    ID_length   = NPN_GetStringIdentifier ("length");

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
