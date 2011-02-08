// Scheme numerical tower in JavaScript.  Described in README.
// Copyright (c) 2011 by John Tobey <John.Tobey@gmail.com>

/*
    File: schemeNumber.js

    Exports:

        <SchemeNumber>

    Depends:

        <biginteger.js> for <BigInteger>
 */

// Grab the BigInteger library.
var BigInteger;
if (typeof require !== "undefined")
    BigInteger = require("biginteger").BigInteger;
else
    BigInteger = this.BigInteger;

if (!BigInteger) {
    if (typeof load !== "undefined")
        load("biginteger.js");
    else if (this.readFile)
        eval(this.readFile("biginteger.js"));
    else
        throw new Error("BigInteger is not defined.");
}

/*
    Class: SchemeNumber
    A number object as <defined by the Scheme language at
    http://www.r6rs.org/>.

    Scheme supports *exact* arithmetic and mixing exact with standard
    (*inexact*) numbers.  Several basic operations, including
    addition, subtraction, multiplication, and division, when given
    only exact arguments, must return an exact, numerically correct
    result.

    These operations are allowed to fail due to running out of memory,
    but they are not allowed to return approximations the way
    ECMAScript operators may, unless given one or more inexact
    arguments.

    For example, adding exact *1/100* to exact *0* one hundred times
    produces exactly *1*, not 1.0000000000000007 as in JavaScript.
    Raising exact *2* to the power of exact *1024* returns a 308-digit
    integer with complete precision, not *Infinity* as in ECMAScript.

    This implementation provides all functions listed in the <R6RS
    Scheme specification at http://www.r6rs.org/>, Section 11.7, along
    with <eqv?> from Section 11.5.  (<eqv?> uses JavaScript's *===* to
    compare non-numbers.)

    The schemeNumber.js file exports an object <SchemeNumber>.  It
    contains a property <fn>, which in turn contains the functions
    implementing the numeric types.

    The <SchemeNumber> object is in fact a function that converts its
    argument to a Scheme number: similar to a constructor, but it may
    not always return an object, let alone a unique object.

    Parameters:

        obj - Object to be converted to a Scheme number.

    *obj* may have any of the following types:

        Scheme number - returned unchanged.
        String        - converted as if by *string->number*.
        Native ECMAScript number - treated as an inexact real.

    Returns:

        A Scheme number.

    Exceptions:

        If *obj* can not be parsed, <SchemeNumber> will <raise> an
        exception with condition type *&assertion*.

    See Also:

        <fn>, <raise>
*/
var SchemeNumber = (function() {

/*
    Property: VERSION
    Library version as an array of integers.

    For example, *[1,2,4]* corresponds to Version 1.2.4.
*/

var abs      = Math.abs;
var floor    = Math.floor;
var ceil     = Math.ceil;
var round    = Math.round;
var pow      = Math.pow;
var sqrt     = Math.sqrt;
var atan2    = Math.atan2;
var log      = Math.log;
var exp      = Math.exp;
var LN2      = Math.LN2;
var LN10     = Math.LN10;
var isFinite = this.isFinite;
var isNaN    = this.isNaN;

function retFalse()   { return false; }
function retTrue()    { return true;  }
function retFirst(a)  { return a; }
function retThis()    { return this; }
function retZero()    { return ZERO; }
function retOne()     { return ONE; }

function divisionByExactZero() {
    raise("&assertion", "division by exact zero");
}
function unimpl() {
    throw new Error("BUG: unimplemented");
}
function pureVirtual() {
    throw new Error("BUG: Abstract method not overridden");
}

/* Internal class hierarchy:

   Number  <----  C  <----  Rectangular
                       |
                       `--  R  <----  Flonum[1]
                                 |
                                 `--  ER  <---  EQ  <----  EQFraction
                                                      |
                                                      `--  EI  <----  EINative
                                                                 |
                                                                 `--  EIBig

   [1] The Flonum class actually equals Number for reasons of
   efficiency and interoperability with native numbers.  Logically,
   Flonum should be a direct subclass of R.  Code at the bottom of
   this file populates missing slots in Flonum.prototype as if that
   were the case.

   The concrete classes are:

   Flonum      - inexact real as a native number, possibly NaN or infinite.
   Rectangular - complex number as real and imaginary parts of same exactness.
   EQFraction  - exact rational as numerator and denominator in lowest terms.
   EINative    - exact integer as (wrapped) native number.
   EIBig       - exact integer as BigInteger.

   The abstract C, R, ER, EQ, and EI classes hold information about
   the respective number types (complex, real, exact real, exact
   rational, and exact integer) and stimulate thought about new
   concrete classes.

   Possible future classes:
   C <-- Polar - possibly exact complex number in polar coordinates;
   EQ <-- EQNative - exact rational as native number (power-of-2 denominator);
   EQ <-- EQDecimal - exact rational as BigInteger times a power of 10;
   R <-- BigFloat - inexact real of non-standard precision.
*/

// SN: private alias for the public SchemeNumber object.
function SN(obj) {
    if (obj instanceof Number || typeof obj === "number")
        return obj;
    return parseNumber(String(obj));
}
// For NaturalDocs:
var SchemeNumber = SN;

function isNumber(x) {
    return x instanceof Number || typeof x === "number";
}

// These three little abstractions are vestiges of a plan for an
// alternative implementation not affecting Number.prototype.  Maybe
// in some kind of sandbox environment we'll need it.
var toFlonum = Number;
var floPow = pow;
var floLog = log;

var Flonum = Number;  // See comment about internal class hierarchy.

var HIERARCHY = {
    C: ["Rectangular", "R"],
    R: ["Flonum", "ER"],
    ER: ["EQ"],
    EQ: ["EQFraction", "EI"],
    EI: ["EINative", "EIBig"],
};

var CLASSES = {
    C:C, R:R, ER:ER, EQ:EQ, EI:EI,
    Rectangular:Rectangular, Flonum:Flonum,
    EQFraction:EQFraction, EINative:EINative, EIBig:EIBig,
};

var DISP = {};
for (var className in CLASSES) {
    DISP[className] = {};  // Contents will go into class prototype.
}

//
// Input functions.
//

// How to split a rectangular literal into real and imaginary components:
var decimalComplex = /^(.*[^a-zA-Z]|)([-+].*)i$/;
var radixComplex = /^(.*)([-+].*)i$/;

var nanInfPattern = /^[-+](nan|inf)\.0$/;
var exponentMarkerPattern = /[eEsSfFdDlL]/;
var decimal10Pattern = /^([0-9]+\.?|[0-9]*\.[0-9]+)([eEsSfFdDlL][-+]?[0-9]+)?$/;

var uintegerPattern = {
    2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-fA-F]+$/
};

var PARSE_ERROR = new Object();

// Scheme number syntaxes, e.g. #e1.1@-2d19, 2/3
function stringToNumber(s, radix, exact) {
    var i = 0;

    function lose() {
        throw PARSE_ERROR;
    }
    function setExact(value) {
        if (exact !== undefined) lose();
        exact = value;
    }
    function setRadix(value) {
        if (radix) lose();
        radix = value;
    }
    function parseUinteger(s, sign) {
        if (!uintegerPattern[radix].test(s))
            lose();

        var n = parseInt(s, radix);

        if (exact === false)
            return toFlonum(sign * n);

        if (n < 9007199254740992)
            return toEINative(sign * n);

        n = BigInteger.parse(s, radix);
        if (sign < 0)
            n = n.negate();
        return new EIBig(n);
    }
    function parseReal(s) {
        if (nanInfPattern.test(s)) {
            if (exact)
                lose();
            switch (s) {
            case "+inf.0": return INFINITY;
            case "-inf.0": return M_INFINITY;
            default: return NAN;
            }
        }

        var sign = 1;
        switch (s[0]) {
        case '-': sign = -1;  // fall through
        case '+': s = s.substring(1);
        }

        var slash = s.indexOf('/');
        if (slash != -1)
            return parseUinteger(s.substring(0, slash), sign)
                .SN_divide(parseUinteger(s.substring(slash + 1), 1));

        if (radix !== 10)
            lose();

        var pipe = s.indexOf('|');
        if (pipe !== -1) {

            // WHOA!!!  Explicit mantissa width!  Somebody really
            // cares about correctness.  However, I haven't got all
            // day, so execution speed loses.

            var afterPipe = s.substring(pipe + 1);
            if (!uintegerPattern[10].test(afterPipe))
                lose();

            s = s.substring(0, pipe);
            var precision = parseInt(afterPipe);

            if (precision === 0)
                s = "0.0";
            else if (precision < 53)
                return parseWithWidth(s, precision, exact);
        }

        // We have only one floating point width.
        s = s.replace(exponentMarkerPattern, 'e');

        var dot = s.indexOf('.');
        var e = s.indexOf('e');
        if (dot === -1 && e === -1)
            return parseUinteger(s, sign);

        if (!decimal10Pattern.test(s))
            lose();

        if (!exact)
            return toFlonum(sign * parseFloat(s));

        var integer = s.substring(0, dot === -1 ? e : dot);
        var exponent = 0;
        var fraction;

        if (e === -1)
            fraction = s.substring(dot + 1);
        else {
            if (dot === -1)
                fraction = "";
            else
                fraction = s.substring(dot + 1, e);
            exponent = parseInt(s.substring(e + 1));
        }

        return parseUinteger(integer + fraction, sign)
            .SN__exp10(exponent - fraction.length);
    }
    function parseComplex(s) {
        var a = s.indexOf('@');
        if (a !== -1)
            return makePolar(parseReal(s.substring(0, a)),
                             parseReal(s.substring(a + 1)));

        if (s[s.length - 1] !== "i")
            return parseReal(s);

        if (s === "i") {
            if (exact === false)
                return inexactRectangular(INEXACT_ZERO, toFlonum(1));
            return I;
        }
        if (s === "-i") {
            if (exact === false)
                return inexactRectangular(INEXACT_ZERO, toFlonum(-1));
            return M_I;
        }

        var match = (radix === 10 ? decimalComplex : radixComplex).exec(s);
        var x, y;
        if (match) {
            x = match[1];
            y = match[2];
            x = (x ? parseReal(x) : (exact === false ? INEXACT_ZERO : ZERO));
            y = (y === "+" ? ONE : (y === "-" ? M_ONE : parseReal(y)));
        }
        else {
            // Could be "3i" for example.
            x = (exact === false ? INEXACT_ZERO : ZERO);
            y = parseReal(s.substring(0, s.length - 1));
        }

        return makeRectangular(x, y);
    }

    // Parse a real that had a |p attached.
    // See the second half of R6RS Section 4.2.8 and also
    // http://www.mail-archive.com/r6rs-discuss@lists.r6rs.org/msg01676.html.
    function parseWithWidth(s, precision) {

        // First, parse it as exact.
        var x = stringToNumber(s, radix, true);
        if (x === false || !x.SN_isReal())
            lose();

        if (!x.SN_isZero()) {
            var xabs = x.SN_abs();

            var shift = precision - floor(xabs.SN_log() / LN2) - 1;
            var scale = positiveIntegerExpt(TWO, abs(shift));
            if (shift < 0)
                scale = scale.SN_reciprocal();
            var shifted = xabs.SN_multiply(scale);

            // Correct for log() imprecision.
            var denom = positiveIntegerExpt(TWO, precision);
            while (shifted.SN_ge(denom)) {
                shifted = shifted.SN_divide(TWO);
                scale = scale.SN_divide(TWO);
            }
            for (var twiceShifted = shifted.SN_add(shifted);
                 twiceShifted.SN_lt(denom);
                 twiceShifted = shifted.SN_add(shifted)) {
                shifted = twiceShifted;
                scale = scale.SN_add(scale);
            }

            // 0.5 <= shifted/denom < 1.
            var rounded = shifted.SN_round().SN_divide(scale);
            if (x.SN_isNegative())
                rounded = rounded.SN_negate();
            x = rounded;
        }

        // Then make it inexact unless there is #e.
        if (!exact)
            x = x.SN_toInexact();

        return x;
    }

    radix = radix || 10;
    try {
        while (s[i] === "#") {
            switch (s[i+1]) {
            case 'i': case 'I': setExact(false); break;
            case 'e': case 'E': setExact(true ); break;
            case 'b': case 'B': setRadix( 2); break;
            case 'o': case 'O': setRadix( 8); break;
            case 'd': case 'D': setRadix(10); break;
            case 'x': case 'X': setRadix(16); break;
            default: return false;
            }
            i += 2;
        }
        return parseComplex(s.substring(i));
    }
    catch (e) {
        if (e === PARSE_ERROR)
            return false;
        if (s == undefined)
            raise("&assertion", "missing argument");
        throw e;
    }
}

function parseNumber(s, exact, radix) {
    var ret = stringToNumber(s, radix, exact);
    if (ret === false)
        raise("&assertion", "not a number", s);
    return ret;
}

function makeRectangular(x, y) {
    if (x.SN_isExact() && y.SN_isExact())
        return exactRectangular(x, y);
    return inexactRectangular(x.SN_toInexact(), y.SN_toInexact());
}

function makePolar(r, theta) {
    return inexactRectangular(r.SN_multiply(theta.SN_cos()),
                              r.SN_multiply(theta.SN_sin()));
}

function toReal(x) {
    x = SN(x);
    if (!x.SN_isReal())
        raise("&assertion", "not a real number", x);
    return x;
}

function toInteger(n) {
    n = SN(n);
    if (!n.SN_isInteger())
        raise("&assertion", "not an integer", n);
    return n;
}

function assertRational(q) {
    if (!q.SN_isRational())
        raise("&assertion", "not a rational number", q);
    return q;
}

function assertNonNegative(n) {
    if (n.SN_isNegative())
        raise("&assertion", "negative number", n);
    return n;
}

/*
    Property: fn
    Container of Scheme functions.

    The <SchemeNumber> object contains a property, <SchemeNumber.fn>,
    which in turn contains the functions implementing the Scheme
    numeric types.

    These functions are stored in <fn> under their Scheme names, so
    ["quotation"] is needed where the names contain characters that
    are incompatible with dot.notation.  (In JavaScript, *X.Y* and
    *X["Y"]* are equivalent expressions where Y is a valid identifier.
    Not all Scheme function names are valid JavaScript identifiers, so
    one needs the second syntax to extract them from <fn>.)

    You may find it convenient to copy <SchemeNumber>, <fn>, and the
    output function <number->string> into short-named variables, by
    convention *sn*, *sf*, and *ns*.  The rest of this section assumes
    you have done this:

    > var sn = SchemeNumber;
    > var sf = sn.fn;
    > var ns = sf["number->string"];

    Functions that require a Scheme number argument automatically
    filter the argument through <SchemeNumber>.

    For example, *"2"* (string) would be exact (parsed as Scheme) but
    *2* (equal to *2.0*) would be inexact, as demonstrated:

    > a1 = sf["exact?"]("2");       // a1 === true
    > a1 = sf["exact?"](sn("2"));   // same
    > 
    > a2 = sf["exact?"](2);         // a2 === false
    > a2 = sf["exact?"]("2.0");     // same
    > a2 = sf["exact?"](sn("2.0")); // same

    Note that the following functions accept arguments of any type and
    therefore do not apply <SchemeNumber> to their arguments:

    - <eqv?>
    - <number?>
    - <complex?>
    - <real?>
    - <rational?>
    - <integer?>
    - <real-valued?>
    - <rational-valued?>
    - <integer-valued?>

    Here, for example, is 2 to the 1,024th power, as a decimal
    string:

    > a3 = ns(sf.expt("2", "1024"));

    Fractional
    arithmetic:

    > a4 = sf["+"]("1/3", "4/5");  // 17/15

    Numerator and denominator of a floating-point value,
    hexadecimal:

    > a5 = ns(sf.numerator(1/3), 16);    // "#i15555555555555"
    > a6 = ns(sf.denominator(1/3), 16);  // "#i40000000000000"

    The *#i* prefix denotes an inexact number, as detailed in <R6RS at
    http://www.r6rs.org/>.  Since 1/3 is a native JavaScript number,
    the library regards it as inexact, and operations such as
    numerator yield inexact integer results.  If we used *"1/3"*
    (quoted) instead of *1/3*, the numerator and denominator would be
    the mathematically correct 1 and 3.

    Functions specified to return two values (such as <div-and-mod>
    and <exact-integer-sqrt>) return a two-element array as per
    JavaScript conventions.

    Caveats:

      o As currently implemented (but expected to change), most
        functions ignore extra arguments.  <R6RS at
        http://www.r6rs.org/> Section 6.2 requires an *&assertion*
        exception in these cases.  This is the only known deviation
        from R6RS semantics as of 2011-02-08.

      o Arcane features such as explicit mantissa widths or complex
        transcendental functions, while believed complete, are
        unoptimized.

      o The library exhibits other visible behaviors besides those
        described herein.  However, they are not part of its public
        API and may change or disappear from one release to the next.

      o In particular, Scheme numbers' *toString* property sometimes
        produces output that is incorrect in the Scheme sense.  (This
        stems from the decision to represent inexact reals as
        unadorned native numbers.)

    To serialize numbers as Scheme would, use
    <SchemeNumber.fn["number->string"]>.

    > "" + SchemeNumber(2);                  // "2"
    > SchemeNumber.fn["number->string"](2);  // "2."

    To test a Scheme number for numerical equality with another Scheme
    number or a native value, use <SchemeNumber.fn["="]>.  Likewise
    for *">"* etc.  Refer to <R6RS at http://www.r6rs.org/> for the
    full list of functions.

    See Also:

        <SchemeNumber>
*/

SchemeNumber.fn = {

    "eqv?" : function(a, b) {
        if (a === b)
            return true;
        a = SN(a);
        b = SN(b);
        return (a.SN_isExact() === b.SN_isExact() && a.SN_eq(b));
    },

    "number?"   : isNumber,
    "complex?"  : isComplex,
    "real?"     : function(x) { return isNumber(x) && x.SN_isReal();     },
    "rational?" : function(x) { return isNumber(x) && x.SN_isRational(); },
    "integer?"  : function(x) { return isNumber(x) && x.SN_isInteger();  },

    "real-valued?" : isRealValued,

    "rational-valued?" : function(x) {
        return isRealValued(x) && x.SN_realPart().SN_isRational();
    },

    "integer-valued?" : function(x) {
        return isRealValued(x) && x.SN_realPart().SN_isInteger();
    },

    "exact?"   : makeUnary("SN_isExact"),
    "inexact?" : makeUnary("SN_isInexact"),

    inexact : makeUnary("SN_toInexact"),
    exact   : makeUnary("SN_toExact"),

    "=" : function(a, b) {
        var len = arguments.length;
        a = SN(a);
        for (var i = 1; i < len; i++) {
            if (!a.SN_eq(arguments[i]))
                return false;
        }
        return true;
    },

    "<"  : makeComparator("SN_lt"),
    ">"  : makeComparator("SN_gt"),
    "<=" : makeComparator("SN_le"),
    ">=" : makeComparator("SN_ge"),

    "zero?"     : makeUnary("SN_isZero"),
    "positive?" : makeUnary("SN_isPositive"),
    "negative?" : makeUnary("SN_isNegative"),
    "odd?"      : makeUnary("SN_isOdd"),
    "even?"     : makeUnary("SN_isEven"),
    "finite?"   : makeUnary("SN_isFinite"),
    "infinite?" : makeUnary("SN_isInfinite"),
    "nan?"      : makeUnary("SN_isNaN"),

    max : makeMaxMin("SN_gt"),
    min : makeMaxMin("SN_lt"),

    "+" : function() {
        var ret = ZERO;
        var len = arguments.length;
        var i = 0;
        while (i < len)
            ret = ret.SN_add(SN(arguments[i++]));
        return ret;
    },

    "*" : function() {
        var ret = ONE;
        var len = arguments.length;
        var i = 0;
        while (i < len)
            ret = ret.SN_multiply(SN(arguments[i++]));
        return ret;
    },

    "-" : function(a) {
        var ret = SN(a);
        var len = arguments.length;
        if (len < 2)
            return ret.SN_negate();
        var i = 1;
        while (i < len)
            ret = ret.SN_subtract(SN(arguments[i++]));
        return ret;
    },

    "/" : function(a) {
        var first = SN(a);
        var len = arguments.length;
        if (len < 2)
            return first.SN_reciprocal();
        if (len === 2)
            return first.SN_divide(arguments[1]);
        var product = ONE;
        var i = 1;
        while (i < len)
            product = product.SN_multiply(SN(arguments[i++]));
        return first.SN_divide(product);
    },

    abs             : makeUnary("SN_abs"),
    "div-and-mod"   : function(x, y) { return doDivMod(x, y, false, 2); },
    div             : function(x, y) { return doDivMod(x, y, false, 0); },
    mod             : function(x, y) { return doDivMod(x, y, false, 1); },
    "div0-and-mod0" : function(x, y) { return doDivMod(x, y, true, 2); },
    div0            : function(x, y) { return doDivMod(x, y, true, 0); },
    mod0            : function(x, y) { return doDivMod(x, y, true, 1); },

    gcd : function() {
        var ret = ZERO;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && arg.SN_isExact();
            ret = gcd(ret, arg.SN_abs().SN_toExact());
        }
        ret = ret.SN_abs();
        return (exact ? ret : ret.SN_toInexact());
    },

    lcm : function() {
        var ret = ONE;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && arg.SN_isExact();
            arg = arg.SN_toExact();
            ret = ret.SN_multiply(arg).SN_divide(gcd(ret, arg.SN_abs()));
        }
        ret = ret.SN_abs();
        return (exact ? ret : ret.SN_toInexact());
    },

    numerator   : makeUnary("SN_numerator"),
    denominator : makeUnary("SN_denominator"),
    floor       : makeUnary("SN_floor"),
    ceiling     : makeUnary("SN_ceiling"),
    truncate    : makeUnary("SN_truncate"),
    round       : makeUnary("SN_round"),
    rationalize : rationalize,
    exp         : makeUnary("SN_exp"),

    log : function(z, base) {
        var ret = SN(z).SN_log();
        if (typeof base !== "undefined")
            ret = ret.SN_divide(SN(base).SN_log());
        return ret;
    },

    sin  : makeUnary("SN_sin"),
    cos  : makeUnary("SN_cos"),
    tan  : makeUnary("SN_tan"),
    asin : makeUnary("SN_asin"),
    acos : makeUnary("SN_acos"),

    atan : function(y, x) {
        switch (arguments.length) {
        case 1: return SN(y).SN_atan();
        case 2: return SN(y).SN_atan2(x);
        default: raise("&assertion", "atan expects 1 to 2 arguments, given "
                       + arguments.length);
        }
    },

    sqrt : makeUnary("SN_sqrt"),
    "exact-integer-sqrt" : makeUnary("SN_exactIntegerSqrt"),
    expt : makeBinary("SN_expt"),

    "make-rectangular" : function(x, y) {
        return makeRectangular(toReal(x), toReal(y));
    },

    "make-polar" : function(r, theta) {
        return makePolar(toReal(r), toReal(theta));
    },

    "real-part" : makeUnary("SN_realPart"),
    "imag-part" : makeUnary("SN_imagPart"),
    magnitude   : makeUnary("SN_magnitude"),
    angle       : makeUnary("SN_angle"),

    "number->string" : function(z, radix, precision) {
        return SN(z).SN_numberToString(radix, precision);
    },

    "string->number" : function(s, radix) {
        return stringToNumber(String(s), radix);
    }
};

// Scheme function helpers.

function isComplex(x) {
    return isNumber(x) && x.SN_isComplex();
}
function isRealValued(x) {
    return isComplex(x) && x.SN_imagPart().SN_isZero();
}

function makeUnary(methodName) {
    return function(a) {
        return SN(a)[methodName]();
    };
}
function makeBinary(methodName) {
    return function(a, b) {
        return SN(a)[methodName](b);
    };
}

function makeComparator(cmp) {
    return function(a, b) {
        var len = arguments.length;
        b = toReal(b);
        if (!toReal(a)[cmp](b))
            return false;
        for (var i = 2; i < len; i++) {
            var c = toReal(arguments[i]);
            if (!b[cmp](c))
                return false;
            b = c;
        }
        return true;
    };
}

function makeMaxMin(cmp) {
    return function(a) {
        var len = arguments.length;
        if (len === 0)
            raise("&assertion", "max/min needs at least one argument");

        var ret = toReal(a);
        var exact = ret.SN_isExact();

        for (var i = 1; i < len; i++) {
            var x = toReal(arguments[i]);
            if (x.SN_isNaN())
                return x;
            if (exact) {
                exact = x.SN_isExact();
                if (!exact)
                    ret = ret.SN_toInexact();  // XXX Cheaper comparisons?
            }
            if (x[cmp](ret) !== false) {
                ret = x;
            }
        }
        return exact ? ret : ret.SN_toInexact();
    };
}

function divModArg2Zero(arg) {
    raise("&assertion", "div/mod second argument is zero", arg);
}

function doDivMod(x, y, is0, which) {
    x = toReal(x);
    y = toReal(y);

    if (!x.SN_isFinite())
        raise("&assertion", "div/mod first argument is not finite", x);
    if (y.SN_isZero())
        divModArg2Zero(y);

    if (!is0) {
        switch (which) {
        case 0: return x.SN_div(y);
        case 1: return x.SN_mod(y);
        case 2: default: return x.SN_divAndMod(y);
        }
    }

    var dm = x.SN_divAndMod(y);
    var m = dm[1];
    var yabs = y.SN_abs();

    if (m.SN_add(m).SN_ge(yabs)) {
        switch (which) {
        case 0: return dm[0].SN_add(y.SN_isNegative() ? M_ONE : ONE);
        case 1: return m.SN_subtract(yabs);
        case 2: default: return [dm[0].SN_add(y.SN_isNegative() ? M_ONE : ONE),
                                 m.SN_subtract(yabs)];
        }
    }
    switch (which) {
    case 0: return dm[0];
    case 1: return m;
    case 2: default: return dm;
    }
}

function rationalize(x, delta) {
    x = SN(x);
    delta = SN(delta);

    // Handle weird cases first.
    if (!x.SN_isFinite() || !delta.SN_isFinite()) {
        toReal(x);
        toReal(delta);
        if (delta.SN_isInfinite())
            return (x.SN_isFinite() ? INEXACT_ZERO : NAN);
        if (delta.SN_isNaN())
            return delta;
        return x;
    }

    if (delta.SN_isZero())
        return x;

    delta = delta.SN_abs();  // It's what PLT and Mosh seem to do.

    var x0 = x.SN_subtract(delta);
    var x1 = x.SN_add(delta);
    var a = x0.SN_floor();
    var b = x1.SN_floor();

    if (a.SN_ne(b)) {
        var negative = a.SN_isNegative();
        if (b.SN_isNegative() != negative)
            return (a.SN_isExact() ? ZERO : INEXACT_ZERO);
        return (negative ? b : x0.SN_ceiling());
    }
    var cf = [];  // Continued fraction, b implied.

    while (true) {
        x0 = x0.SN_subtract(a);
        if (x0.SN_isZero())
            break;
        x1 = x1.SN_subtract(a);
        if (x1.SN_isZero())
            break;

        x0 = x0.SN_reciprocal();
        x1 = x1.SN_reciprocal();
        a = x0.SN_floor();

        switch (a.SN_compare(x1.SN_floor())) {
        case -1: cf.push(x0.SN_ceiling()); break;
        case  1: cf.push(x1.SN_ceiling()); break;
        case 0: default:
            cf.push(a);
            continue;
        }
        break;
    }
    var ret = ZERO;
    var i = cf.length;
    while (i--)
        ret = ret.SN_add(cf[i]).SN_reciprocal();
    return ret.SN_add(b);
}

/*
    Property: raise
    Function that translates a Scheme exception to ECMAScript.

    When a library function encounters a situation where the Scheme
    specification requires it to raise an exception with a certain
    condition type, the function calls <SchemeNumber.raise>.

    Programs may assign a custom function to <SchemeNumber.raise> to
    intercept such exceptions.

    Parameters:

        conditionType - The specified condition, for example, "&assertion".
        message       - A string describing the error.
        irritants...  - Zero or more erroneous data arguments.

    Returns:

        The default <SchemeNumber.raise> function simply throws an
        *Error*.

    See Also:

        <fn>, <SchemeNumber>
*/
SchemeNumber.raise = defaultRaise;

function defaultRaise(conditionType, message, irritant) {
    var msg = "SchemeNumber: " + conditionType + ": " + message;
    if (arguments.length > 2)
        msg += ": " + irritant;
    throw new Error(msg);
}

function raise() {
    var len = arguments.length;
    var args = new Array(len);
    while (len--)
        args[len] = arguments[len];

    // Call the exception hook.
    SN.raise.apply(SN, args);

    // Oops, it returned.  Fall back to our known good raiser.
    defaultRaise.apply(this, args);
}

/*
    Property: maxIntegerDigits
    Maximum size of integers created by the <expt> function.

    To avoid using up all system memory, exact results of a call to
    <SchemeNumber.fn.expt> are capped at a configurable number of
    digits, by default one million.  <SchemeNumber.maxIntegerDigits>
    holds this limit.

    The size limit does *not* currently protect against other means of
    creating large exact integers.  For example, when passed
    "#e1e9999999", the <SchemeNumber> function tries to allocate 10
    million digits, regardless of <maxIntegerDigits>.

    In a future release, cases such as the preceeding example may be
    checked.  If there is any possibility of legitimately creating
    such large integers, either as number objects or components
    thereof, code should increase <maxIntegerDigits>.

    Default Value:

        - 1000000 (1e6 or 1 million)
*/

// Configurable maximum integer magnitude.
SN.maxIntegerDigits = 1e6;  // 1 million digits.

//
// Flonum: Inexact real as a native number.
//

DISP.Flonum.SN_isExact    = retFalse;
DISP.Flonum.SN_isInexact  = retTrue;
DISP.Flonum.SN_isComplex  = retTrue;
DISP.Flonum.SN_isReal     = retTrue;

DISP.Flonum.SN_debug = function() {
    return "Flonum(" + this.SN_numberToString() + ")";
};

// Return a string of "0" and "1" characters, possibly including a "."
// and possibly a leading "-", that in base 2 equals x.  This works by
// calling Number.prototype.toString with a radix of 2.  Specification
// ECMA-262 Edition 5 (December 2009) does not strongly assert that
// this works.  As an alternative, should this prove non-portable
// (translation: fails in IE), nativeDenominator could instead do:
// for (d = 1; x !== floor(x); d *= 2) { x *= 2; } return d;
function numberToBinary(x) {
    return x.toString(2);
}

function nativeDenominatorLog2(x) {
    //assert(isFinite(x));
    var s = numberToBinary(abs(x));
    var i = s.indexOf(".");
    if (i === -1)
        return 0;
    return s.length - i - 1;
}

function nativeDenominator(x) {
    // Get the "denominator" of a floating point value.
    // The result will be a power of 2.
    //assert(isFinite(x));
    return pow(2, nativeDenominatorLog2(x));
}

function exactNativeIntegerToString(n, radix) {
    if (n > -9007199254740992 && n < 9007199254740992)
        return n.toString(radix);
    return numberToBigInteger(n).toString(radix);
}

DISP.Flonum.SN_numberToString = function(radix, precision) {
    if (radix && radix != 10 && isFinite(this))
        return "#i" + this.SN_toExact().SN_numberToString(radix);

    if (!isFinite(this)) {
        if (isNaN(this))
            return("+nan.0");
        return (this > 0 ? "+inf.0" : "-inf.0");
    }

    var s = this.toString();

    if (s.indexOf('.') === -1) {
        // Force the result to contain a decimal point as per R6RS.
        var e = s.indexOf('e');
        if (e === -1)
            s += ".";
        else
            s = s.substring(0, e) + "." + s.substring(e);
    }

    if (precision != undefined) {
        var p = toInteger(precision);
        if (!p.SN_isExact() || !p.SN_isPositive())
            raise("&assertion",
                  "precision is not an exact positive integer", p);

        p = p.SN_numberToString();
        if (p < 53) {
            var bits = numberToBinary(this).replace(/[-+.]/g, "")
                .replace(/^0+/, "").length;
            if (p < bits)
                p = bits;
        }
        s += "|" + p;
    }

    return s;
};

DISP.Flonum.SN_realPart = retThis;

DISP.Flonum.SN_imagPart = function() {
    return ZERO;
};

DISP.Flonum.SN_denominator = function() {
    return nativeDenominator(assertRational(this));
};

DISP.Flonum.SN_numerator = function() {
    return this * nativeDenominator(assertRational(this));
};

DISP.Flonum.SN_isInteger = function() {
    return isFinite(this) && this == floor(this);
};

DISP.Flonum.SN_isFinite = function() {
    return isFinite(this);
};
DISP.Flonum.SN_isRational = DISP.Flonum.SN_isFinite;

DISP.Flonum.SN_isZero = function() {
    return this == 0;
};

DISP.Flonum.SN_isPositive = function() {
    return this > 0;
};

DISP.Flonum.SN_isNegative = function() {
    return this < 0;
};

DISP.Flonum.SN_sign = function() {
    return (this == 0 ? 0 : (this > 0 ? 1 : -1));
};

DISP.Flonum.SN_isUnit = function() {
    return this == 1 || this == -1;
};

DISP.Flonum.SN_isInfinite = function() {
    return !isFinite(this) && !isNaN(this);
};

DISP.Flonum.SN_isNaN = function() {
    return isNaN(this);
};

DISP.Flonum.SN_isEven = function() {
    //assert(this == floor(this));
    return (this & 1) === 0;
};

DISP.Flonum.SN_isOdd = function() {
    //assert(this == floor(this));
    return (this & 1) === 1;
};

DISP.Flonum.SN_eq = function(z) { return SN(z).SN__eq_Flonum(this); };
DISP.Flonum.SN_ne = function(z) { return SN(z).SN__ne_Flonum(this); };
DISP.Flonum.SN_gt = function(x) { return toReal(x).SN__gt_Flonum(this); };
DISP.Flonum.SN_lt = function(x) { return toReal(x).SN__lt_Flonum(this); };
DISP.Flonum.SN_ge = function(x) { return toReal(x).SN__ge_Flonum(this); };
DISP.Flonum.SN_le = function(x) { return toReal(x).SN__le_Flonum(this); };

DISP.Flonum.SN_compare = function(x) {
    return toReal(x).SN__compare_Flonum(this);
};

// Note operand order!
DISP.Flonum.SN__eq_R = function(x) { return +x == this; };
DISP.Flonum.SN__ne_R = function(x) { return +x != this; };
DISP.Flonum.SN__gt_R = function(x) { return x > this; };
DISP.Flonum.SN__lt_R = function(x) { return x < this; };
DISP.Flonum.SN__ge_R = function(x) { return x >= this; };
DISP.Flonum.SN__le_R = function(x) { return x <= this; };

DISP.Flonum.SN__compare_R = function(x) {
    if (+x == this) return 0;
    if (x < this) return -1;
    if (x > this) return 1;
    return NaN;
};

function numberToEI(n) {
    if (n < 9007199254740992 && n > -9007199254740992)
        return toEINative(n);
    return new EIBig(numberToBigInteger(n));
}

function nativeToExact(x) {
    if (!isFinite(x))
        raise("&implementation-violation",
              "inexact argument has no reasonably close exact equivalent", x);

    var d = nativeDenominator(x);
    var n;

    if (d === 1)
        return numberToEI(x);

    if (isFinite(d)) {
        n = x * d;
        d = numberToEI(d);
    }
    else {
        // Denormal x.
        var dl2 = nativeDenominatorLog2(x);
        n = x * 9007199254740992;
        n *= pow(2, dl2 - 53);
        d = positiveIntegerExpt(TWO, dl2);
    }
    //assert(isFinite(n));
    return canonicalEQ(numberToEI(n), d);
}

DISP.Flonum.SN_toExact = function() {
    return nativeToExact(this);
};

DISP.Flonum.SN_toInexact = retThis;

DISP.Flonum.SN_add = function(z) {
    return SN(z).SN__add_Flonum(this);
};
DISP.Flonum.SN_subtract = function(z) {
    return SN(z).SN__subtract_Flonum(this);
};
DISP.Flonum.SN_multiply = function(z) {
    return SN(z).SN__multiply_Flonum(this);
};
DISP.Flonum.SN_divide = function(z) {
    return SN(z).SN__divide_Flonum(this);
};

DISP.Flonum.SN__add_R = function(x) {
    return x + this;
};
DISP.Flonum.SN__subtract_R = function(x) {
    return x - this;
};
DISP.Flonum.SN__multiply_R = function(x) {
    return x * this;
};
DISP.Flonum.SN__divide_R = function(x) {
    return x / this;
};

DISP.Flonum.SN_negate = function() {
    return -this;
};

DISP.Flonum.SN_abs = function() {
    return (this < 0 ? -this : this);
};

DISP.Flonum.SN_reciprocal = function() {
    return 1 / this;
};

function div_Flonum_R(x, y) {
    if (y > 0)
        return floor(x / y);
    if (y < 0)
        return ceil(x / y);
    if (y == 0)
        divModArg2Zero(toFlonum(y));
    return NaN;
}
DISP.Flonum.SN_divAndMod = function(x) {
    x = Number(toReal(x));
    var div = div_Flonum_R(this, x);
    return [toFlonum(div), toFlonum(this - (x * div))];
};
DISP.Flonum.SN_div = function(x) {
    return div_Flonum_R(this, toReal(x));
};
DISP.Flonum.SN_mod = function(x) {
    return this - x * div_Flonum_R(this, toReal(x));
};

DISP.Flonum.SN_square = function() {
    return this * this;
};

DISP.Flonum.SN_round = function() {
    var ret = floor(this);
    var diff = this - ret;
    if (diff < 0.5) return ret;
    if (diff > 0.5) return ret + 1;
    return 2 * round(this / 2);
};

DISP.Flonum.SN_truncate = function() {
    return (this < 0 ? ceil(this) : floor(this));
};

DISP.Flonum.SN_ceiling = function() {
    return ceil(this);
};

["abs", "atan", "cos", "exp", "floor", "sin", "tan"]
    .forEach(function(name) {
            var fn = Math[name];
            DISP.Flonum["SN_" + name] = function() {
                return fn(this);
            };
        });

["acos", "asin", "log"]
    .forEach(function(name) {
            var math = Math[name];
            var cplx = {acos:complexAcos, asin:complexAsin, log:complexLog}
                [name];
            DISP.Flonum["SN_" + name] = function() {
                var ret = math(this);
                if (isNaN(ret))
                    return cplx(this);
                return ret;
            };
        });

DISP.Flonum.SN_sqrt = function() {
    if (this >= 0)
        return toFlonum(sqrt(this));
    if (isNaN(this))
        return this;
    return inexactRectangular(INEXACT_ZERO, toFlonum(sqrt(-this)));
};

DISP.Flonum.SN_log = function() {
    if (this < 0)
        return complexLog(this);
    return floLog(this);
};

DISP.Flonum.SN_atan2 = function(x) {
    return atan2(this, toReal(x));
};

DISP.Flonum.SN_expt = function(z) {
    return SN(z).SN__expt_Flonum(this);
};

// Some famous flonums:

var INEXACT_ZERO = toFlonum(0);

var INFINITY     = toFlonum(Number.POSITIVE_INFINITY);
var M_INFINITY   = toFlonum(Number.NEGATIVE_INFINITY);
var NAN          = toFlonum(Number.NaN);

var PI           = toFlonum(Math.PI);

//
// C: Complex abstract base class.
//

function C() {}

C.prototype = new Flonum();  // See comment about internal class hierarchy.

DISP.C.SN_isReal     = retFalse;
DISP.C.SN_isRational = retFalse;
DISP.C.SN_isInteger  = retFalse;
DISP.C.SN_isZero     = retFalse;
DISP.C.SN_isUnit     = retFalse;

DISP.C.SN_isComplex  = retTrue;

DISP.C.toString = function(radix, precision) {  // XXX is this used?
    return this.SN_numberToString(radix, precision);
};
DISP.C.valueOf = DISP.C.toString;  // XXX is this used?
DISP.C.SN_numberToString = pureVirtual;

DISP.C.SN_debug = function() { return "C"; };

// vvvv You shouldn't need this if you use only real numbers. vvvv

DISP.C.SN_sqrt = function() {
    return makePolar(this.SN_magnitude().SN_sqrt(),
                     this.SN_angle().SN_divide(TWO));
};

// Complex transcendental functions here for completeness, not optimized.

function complexLog(z) {
    return makeRectangular(z.SN_magnitude().SN_log(), z.SN_angle());
};

function complexAsin(z) {
    return M_I.SN_multiply(I.SN_multiply(z)
                           .SN_add(ONE.SN_subtract(z.SN_square()).SN_sqrt())
                           .SN_log());
}

function complexAcos(z) {
    return PI.SN_divide(TWO).SN_subtract(complexAsin(z));
}

function complexAtan(z) {
    var iz = I.SN_multiply(z);
    return ONE.SN_add(iz).SN_log().SN_subtract(ONE.SN_subtract(iz).SN_log())
        .SN_divide(TWO).SN_divide(I);
}

DISP.C.SN_log  = function() { return complexLog (this); };
DISP.C.SN_asin = function() { return complexAsin(this); };
DISP.C.SN_acos = function() { return complexAcos(this); };
DISP.C.SN_atan = function() { return complexAtan(this); };

DISP.C.SN_sin = function() {
    var iz = I.SN_multiply(this);
    return iz.SN_exp().SN_subtract(iz.SN_negate().SN_exp())
        .SN_divide(TWO).SN_divide(I);
};

DISP.C.SN_cos = function() {
    var iz = I.SN_multiply(this);
    return iz.SN_exp().SN_add(iz.SN_negate().SN_exp()).SN_divide(TWO);
};

DISP.C.SN_tan = function() {
    return this.SN_sin().SN_divide(this.SN_cos());
};

// ^^^^ You shouldn't need this if you use only real numbers. ^^^^

//
// R: Real abstract base class.
//

function R() {}

R.prototype = new C();
DISP.R.SN_isReal = retTrue;

DISP.R.SN_debug = function() { return "R"; };

DISP.R.SN_realPart = retThis;

// Methods implemented generically using more basic operations.

DISP.R.SN_magnitude = function() {
    return this.SN_abs();
};

DISP.R.SN_angle = function() {
    return this.SN_isNegative() ? PI : ZERO;
};

// Commented because they are always overridden.
// DISP.R.SN_isPositive = function() {
//     return this.SN_sign() > 0;
// };
// DISP.R.SN_isNegative = function() {
//     return this.SN_sign() < 0;
// };
// DISP.R.SN_sign = function() {
//     return this.SN_compare(ZERO);
// };

// Dispatches.

DISP.R.SN__eq_Flonum = DISP.Flonum.SN__eq_R;
DISP.R.SN__ne_Flonum = DISP.Flonum.SN__ne_R;

DISP.R.SN__eq_Rectangular = function(z) {
    return z._y.SN_isZero() && z._x.SN_eq(this);
};
DISP.R.SN__ne_Rectangular = function(z) {
    return !z._y.SN_isZero() || z._x.SN_ne(this);
};

DISP.R.SN__gt_Flonum = DISP.Flonum.SN__gt_R;
DISP.R.SN__lt_Flonum = DISP.Flonum.SN__lt_R;
DISP.R.SN__ge_Flonum = DISP.Flonum.SN__ge_R;
DISP.R.SN__le_Flonum = DISP.Flonum.SN__le_R;
DISP.R.SN__compare_Flonum = DISP.Flonum.SN__compare_R;

DISP.R.SN_compare = pureVirtual;
DISP.R.SN_gt = function(x) { return this.SN_compare(x) > 0; };
DISP.R.SN_lt = function(x) { return this.SN_compare(x) < 0; };
DISP.R.SN_ge = function(x) { return this.SN_compare(x) >= 0; };
DISP.R.SN_le = function(x) { return this.SN_compare(x) <= 0; };

DISP.R.SN_add = function(z) {
    return SN(z).SN__add_R(this);
};
DISP.R.SN__add_Flonum = DISP.Flonum.SN__add_R;

DISP.R.SN_subtract = function(z) {
    return SN(z).SN__subtract_R(this);
};
DISP.R.SN__subtract_Flonum = DISP.Flonum.SN__subtract_R;

DISP.R.SN_multiply = function(z) {
    return SN(z).SN__multiply_R(this);
};
DISP.R.SN__multiply_Flonum = DISP.Flonum.SN__multiply_R;

DISP.R.SN_divide = function(z) {
    return SN(z).SN__divide_R(this);
};
DISP.R.SN__divide_Flonum = DISP.Flonum.SN__divide_R;

function complexExpt(b, p) {
    if (b.isZero()) {
        if (p.isZero())
            return toFlonum(1);
        if (p.realPart().isPositive())
            return INEXACT_ZERO;
        raise("&implementation-restriction", "invalid power for zero expt", p);
    }
    return b.SN_log().SN_multiply(p).SN_exp();
}

DISP.R.SN__expt_R = function(x) {
    // Return x to the power of this number.
    if (x.SN_isNegative())
        return complexExpt(x, this);
    return floPow(x, this);
};

DISP.R.SN__expt_EI = DISP.R.SN__expt_R;

DISP.R.SN__expt_EQ = function(q) {
    // Return q to the power of this number.
    if (q.SN_isNegative())
        return complexExpt(q, this);
    var num = q.SN_numerator().SN_expt(this);
    var den = q.SN_denominator().SN_expt(this);

    if (num.SN_isExact() && num.SN_isInteger() &&
        den.SN_isExact() && den.SN_isInteger())
        return new EQFraction(num, den);  // Known to be in lowest terms.

    return num.SN_divide(den);
};

function divAndMod_R_R(x, y) {
    var div = div_R_R(x, y);
    return [div, x.SN_subtract(div.SN_multiply(y))];
}
function div_R_R(x, y) {
    return (y.SN_isNegative()
            ? x.SN_divide(y).SN_ceiling()
            : x.SN_divide(y).SN_floor());
}
function mod_R_R(x, y) {
    return x.SN_subtract(div_R_R(x, y).SN_multiply(y));
}

DISP.R.SN_divAndMod = function(x) {
    return divAndMod_R_R(this, toReal(x));
};
DISP.R.SN_div = function(x) {
    return div_R_R(this, toReal(x));
};
DISP.R.SN_mod = function(x) {
    return mod_R_R(this, toReal(x));
};

DISP.R.SN__divAndMod_R = function(x) {
    return divAndMod_R_R(x, this);
};
DISP.R.SN__div_R = function(x) {
    return div_R_R(x, this);
};
DISP.R.SN__mod_R = function(x) {
    return mod_R_R(x, this);
};

// These functions are always allowed to return inexact.  We, however,
// override a few of these in ZERO and ONE.
["sqrt", "exp", "log", "sin", "cos", "tan", "asin", "acos", "atan", "atan2"]
.forEach(function(name) { DISP.R["SN_" + name] = DISP.Flonum["SN_" + name]; });

// vvvv You shouldn't need this if you use only real numbers. vvvv

//
// Rectangular: Complex numbers as xy-coordinate pairs.
//

function exactRectangular(x, y) {
    //assert(x.SN_isExact());
    //assert(y.SN_isExact());
    if (y.SN_isZero())
        return x;
    if (x.SN_isZero() && y.SN_isUnit())
        return (y.SN_isPositive() ? I : M_I);
    return new Rectangular(x, y);
}

function inexactRectangular(x, y) {
    //assert(x.SN_isInexact());
    //assert(y.SN_isInexact());
    return new Rectangular(x, y);
}

function toRectangular(x, y) {
    //assert(x.SN_isExact() === y.SN_isExact())
    if (x.SN_isExact())
        return exactRectangular(x, y);
    return new Rectangular(x, y);
}

function Rectangular(x, y) {
    this._x = x;
    this._y = y;
}

Rectangular.prototype = new C();

function xyToString(xString, yString) {
    if (yString[0] === '-' || yString[0] === '+')
        return xString + yString + "i";
    return xString + "+" + yString + "i";
}

DISP.Rectangular.SN_numberToString = function(radix, precision) {
    return xyToString(this._x.SN_numberToString(radix, precision),
                      this._y.SN_numberToString(radix, precision));
};

DISP.Rectangular.toString = function(radix) {
    radix = radix || 10;
    return xyToString(this._x.toString(radix), this._y.toString(radix));
};

DISP.Rectangular.SN_debug = function() {
    return "Rectangular(" + this._x.SN_debug()
        + ", " + this._y.SN_debug() + ")";
};

DISP.Rectangular.toFixed = function(dig) {
    return xyToString(this._x.toFixed(dig), this._y.toFixed(dig));
};
DISP.Rectangular.toExponential = function(dig) {
    return xyToString(this._x.toExponential(dig), this._y.toExponential(dig));
};
DISP.Rectangular.toPrecision = function(prec) {
    return xyToString(this._x.toPrecision(prec), this._y.toPrecision(prec));
};

DISP.Rectangular.SN_realPart = function() { return this._x; };
DISP.Rectangular.SN_imagPart = function() { return this._y; };

DISP.Rectangular.SN_isExact   = function() { return this._x.SN_isExact(); };
DISP.Rectangular.SN_isInexact = function() { return this._x.SN_isInexact(); };

DISP.Rectangular.SN_toInexact = function() {
    if (this._x.SN_isInexact())
        return this;
    return inexactRectangular(this._x.SN_toInexact(), this._y.SN_toInexact());
};

DISP.Rectangular.SN_toExact = function() {
    if (this._x.SN_isExact())
        return this;
    return exactRectangular(this._x.SN_toExact(), this._y.SN_toExact());
};

DISP.Rectangular.SN_isZero = function() {
    return this._x.SN_isZero() && this._y.SN_isZero();
};

function rectMagnitude2(z) {
    return z._x.SN_square().SN_add(z._y.SN_square());
}

DISP.Rectangular.SN_isUnit = function() {
    return rectMagnitude2(this).SN_eq(ONE);
};

DISP.Rectangular.SN_magnitude = function() {
    if (this._x.SN_isZero())
        return this._y.SN_abs();
    return rectMagnitude2(this).SN_sqrt();
};

DISP.Rectangular.SN_angle = function() {
    return this._y.SN_atan2(this._x);
};

DISP.C.SN__eq_Rectangular = pureVirtual;
DISP.Rectangular.SN_eq = function(z) {
    return SN(z).SN__eq_Rectangular(this);
};
DISP.Rectangular.SN__eq_Rectangular = function(z) {
    return z._x.SN_eq(this._x) && z._y.SN_eq(this._y);
};
DISP.Rectangular.SN__eq_R = function(x) {
    return this._y.SN_isZero() && x.SN_eq(this._x);
};

DISP.C.SN__ne_Rectangular = pureVirtual;
DISP.Rectangular.SN_ne = function(z) {
    return SN(z).SN__ne_Rectangular(this);
};
DISP.Rectangular.SN__ne_Rectangular = function(z) {
    return z._x.SN_ne(this._x) || z._y.SN_ne(this._y);
};
DISP.Rectangular.SN__ne_R = function(x) {
    return !this._y.SN_isZero() || x.SN_ne(this._x);
};

// Arithmetic where the left operand is Rectangular and the right is
// this Flonum.

DISP.Flonum.SN__add_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x + this), z._y.SN_toInexact());
};
DISP.Flonum.SN__subtract_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x - this), z._y.SN_toInexact());
};
DISP.Flonum.SN__multiply_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x * this), toFlonum(z._y * this));
};
DISP.Flonum.SN__divide_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x / this), toFlonum(z._y / this));
};
DISP.Flonum.SN__expt_Rectangular = function(z) {
    // XXX Is this any cheaper than complexExpt??
    return makePolar(floPow(rectMagnitude2(z), this / 2),
                     toFlonum(atan2(z._y, z._x) * this));
};

// Arithmetic where the left operand is Rectangular and the right is
// this real number.

DISP.R.SN__add_Rectangular = function(z) {
    return makeRectangular(z._x.SN_add(this), z._y);
};

DISP.R.SN__subtract_Rectangular = function(z) {
    return makeRectangular(z._x.SN_subtract(this), z._y);
};

DISP.R.SN__multiply_Rectangular = function(z) {
    return toRectangular(z._x.SN_multiply(this), z._y.SN_multiply(this));
};

DISP.R.SN__divide_Rectangular = function(z) {
    return toRectangular(z._x.SN_divide(this), z._y.SN_divide(this));
};

DISP.C.SN__add_Rectangular = pureVirtual;
DISP.Rectangular.SN_add = function(z) {
    return SN(z).SN__add_Rectangular(this);
};
DISP.Rectangular.SN__add_R = function(x) {
    return makeRectangular(x.SN_add(this._x), this._y);
};
DISP.Rectangular.SN__add_Rectangular = function(z) {
    var x = z._x.SN_add(this._x);
    var y = z._y.SN_add(this._y);
    return (x.SN_isExact() ? exactRectangular : inexactRectangular)(x, y);
};

DISP.Rectangular.SN_negate = function() {
    return toRectangular(this._x.SN_negate(), this._y.SN_negate());
};

DISP.C.SN__subtract_Rectangular = pureVirtual;
DISP.Rectangular.SN_subtract = function(z) {
    return SN(z).SN__subtract_Rectangular(this);
};
DISP.Rectangular.SN__subtract_R = function(x) {
    return makeRectangular(x.SN_subtract(this._x), this._y.SN_negate());
};
DISP.Rectangular.SN__subtract_Rectangular = function(z) {
    var x = z._x.SN_subtract(this._x);
    var y = z._y.SN_subtract(this._y);
    return (x.SN_isExact() ? exactRectangular : inexactRectangular)(x, y);
};

DISP.C.SN__multiply_Rectangular = pureVirtual;
DISP.Rectangular.SN_multiply = function(z) {
    return SN(z).SN__multiply_Rectangular(this);
};
DISP.Rectangular.SN__multiply_R = function(x) {
    return toRectangular(x.SN_multiply(this._x), x.SN_multiply(this._y));
};
function complexMultiply(ax, ay, bx, by) {
    return toRectangular(ax.SN_multiply(bx).SN_subtract(ay.SN_multiply(by)),
                         ax.SN_multiply(by).SN_add(ay.SN_multiply(bx)));
}
DISP.Rectangular.SN__multiply_Rectangular = function(z) {
    return complexMultiply(z._x, z._y, this._x, this._y);
};

DISP.Rectangular.SN_square = function() {
    return toRectangular(this._x.SN_square().SN_subtract(this._y.SN_square()),
                         this._x.SN_multiply(this._y).SN_multiply(TWO));
};

DISP.Rectangular.SN_reciprocal = function() {
    var m2 = rectMagnitude2(this);
    return toRectangular(this._x.SN_divide(m2),
                         this._y.SN_divide(m2).SN_negate());
};

DISP.C.SN__divide_Rectangular = pureVirtual;
DISP.Rectangular.SN_divide = function(z) {
    return SN(z).SN__divide_Rectangular(this);
};
function complexDivide(x, y, z) {  // returns (x + iy) / z
    var m2 = rectMagnitude2(z);
    return complexMultiply(x, y,
                           z._x.SN_divide(m2),
                           z._y.SN_divide(m2).SN_negate());
}
DISP.Rectangular.SN__divide_R = function(x) {
    return complexDivide(x, x.SN_isExact() ? ZERO : INEXACT_ZERO, this);
};
DISP.Rectangular.SN__divide_Rectangular = function(z) {
    return complexDivide(z._x, z._y, this);
};

DISP.Rectangular.SN_expt = function(z) {
    return SN(z).SN__expt_Rectangular(this);
};
DISP.Rectangular.SN__expt_C = function(z) {
    return complexExpt(z, this);
};
DISP.C.SN__expt_Rectangular = DISP.Rectangular.SN__expt_C;

DISP.Rectangular.SN_exp = function() {
    return makePolar(this._x.SN_exp(), this._y);
};

// ^^^^ You shouldn't need this if you use only real numbers. ^^^^

//
// ER: Exact real abstract base class.
//

function ER() {}

ER.prototype = new R();
DISP.ER.SN_isExact    = retTrue;
DISP.ER.SN_isInexact  = retFalse;

DISP.ER.SN_toExact    = retThis;
DISP.ER.SN_toInexact  = function() { return toFlonum(this); };

DISP.ER.SN_isNaN      = retFalse;
DISP.ER.SN_isFinite   = retTrue;
DISP.ER.SN_isInfinite = retFalse;

DISP.ER.SN_imagPart   = retZero;

//
// EQ: Exact rational abstract base class.
//

function EQ() {}

EQ.prototype = new ER();
DISP.EQ.SN_isRational = retTrue;

DISP.EQ.SN_eq = function(z) {
    return SN(z).SN__eq_EQ(this);
};
DISP.EQ.SN__eq_EQ = pureVirtual;

DISP.EQ.SN_ne = function(z) {
    return SN(z).SN__ne_EQ(this);
};
DISP.EQ.SN__ne_EQ = pureVirtual;

DISP.EQ.SN_compare = function(x) {
    return toReal(x).SN__compare_EQ(this);
};
DISP.EQ.SN__compare_EQ = pureVirtual;

DISP.EQ.SN_add = function(z) {
    return SN(z).SN__add_EQ(this);
};
DISP.EQ.SN__add_EQ = pureVirtual;

DISP.EQ.SN_subtract = function(z) {
    return SN(z).SN__subtract_EQ(this);
};
DISP.EQ.SN__subtract_EQ = pureVirtual;

DISP.EQ.SN_multiply = function(z) {
    return SN(z).SN__multiply_EQ(this);
};
DISP.EQ.SN__multiply_EQ = pureVirtual;

DISP.EQ.SN_divide = function(z) {
    return SN(z).SN__divide_EQ(this);
};
DISP.EQ.SN__divide_EQ = pureVirtual;

DISP.EQ.SN_expt = function(z) {
    return SN(z).SN__expt_EQ(this);
};

function reduceEQ(n, d) {
    if (d.SN_isZero())
        divisionByExactZero();

    var g = gcd(n.SN_abs(), d.SN_abs());

    n = n.SN_div(g);
    d = d.SN_div(g);

    if (d.SN_isNegative())
        return canonicalEQ(n.SN_negate(), d.SN_negate());
    return canonicalEQ(n, d);
}

function canonicalEQ(n, d) {
    return (d === ONE ? n : new EQFraction(n, d));
}

//
// EQFraction: Exact rational as numerator (exact integer) and
// denominator (exact positive integer) with no factors in common.
//

function EQFraction(n, d) {
    //assert(d.gt(ONE));
    //assert(gcd(n.abs(), d).eq(ONE));
    this._n = n;
    this._d = d;
}

EQFraction.prototype = new EQ();

DISP.EQFraction.SN_numberToString = function(radix, precision) {
    return (this._n.SN_numberToString(radix) +
            "/" + this._d.SN_numberToString(radix));
};

DISP.EQFraction.valueOf = function() {
    var n = this._n;
    var d = this._d;
    var ret = n / d;
    if (!isNaN(ret))
        return ret;
    if (n.SN_isNegative())
        return -exp(n.SN_negate().SN_log() - d.SN_log());
    return exp(n.SN_log() - d.SN_log());
};

DISP.EQFraction.SN_debug = function() {
    return "EQFraction(" + this._n.SN_debug()
        + " / " + this._d.SN_debug() + ")";
};

DISP.EQFraction.SN_numerator = function () {
    return this._n;
};

DISP.EQFraction.SN_denominator = function() {
    return this._d;
};

DISP.EQFraction.SN_isPositive = function() {
    return this._n.SN_isPositive();
};

DISP.EQFraction.SN_isNegative = function() {
    return this._n.SN_isNegative();
};

DISP.EQFraction.SN__eq_EQ = function(q) {
    return (q.SN_numerator().SN_eq(this._n) &&
            q.SN_denominator().SN_eq(this._d));
};

DISP.EQFraction.SN__ne_EQ = function(q) {
    return (q.SN_numerator().SN_ne(this._n) ||
            q.SN_denominator().SN_ne(this._d));
};

DISP.EQFraction.SN__compare_EQ = function(q) {
    var qn = q.SN_numerator();
    var signDiff = q.SN_sign() - this._n.SN_sign();
    if (signDiff !== 0)
        return (signDiff > 0 ? 1 : -1);
    var qd = q.SN_denominator();
    if (qd === this._d)
        return qn.SN_compare(this._n);
    return qn.SN_multiply(this._d).SN_compare(qd.SN_multiply(this._n));
};

DISP.EQFraction.SN_negate = function() {
    return new EQFraction(this._n.SN_negate(), this._d);
};

DISP.EQFraction.SN_square = function() {
    return new EQFraction(this._n.SN_square(), this._d.SN_square());
};

DISP.EQFraction.SN_reciprocal = function() {
    switch (this._n.SN_sign()) {
    case -1: return canonicalEQ(this._d.SN_negate(), this._n.SN_negate());
    case 1: return canonicalEQ(this._d, this._n);
    case 0: default: divisionByExactZero();
    }
};

DISP.EQFraction.SN_floor = function() {
    return this._n.SN_div(this._d);
};

DISP.EQFraction.SN_ceiling = function() {
    //assert(this._d.SN_gt(ONE));
    return this._n.SN_div(this._d).SN_add(ONE);
};

DISP.EQFraction.SN_round = function() {
    if (this._d.SN_eq(TWO)) {
        var ret = this._n.SN_div(TWO);
        return ret.SN_isEven() ? ret : ret.SN_add(ONE);
    }
    var dm = this._n.SN_divAndMod(this._d);
    var mod = dm[1];
    if (mod.SN_add(mod).SN_lt(this._d))
        return dm[0];
    return dm[0].SN_add(ONE);
};

DISP.EQFraction.SN_truncate = function() {
    if (this._n.SN_isPositive())
        return this._n.SN_div(this._d);
    return this._d.SN_isUnit() ? this._n : this._n.SN_div(this._d).SN_add(ONE);
};

DISP.EQFraction.SN_sign = function() {
    return this._n.SN_sign();
};

DISP.EQFraction.SN_abs = function() {
    if (this._n.SN_sign() >= 0)
        return this;
    return this.SN_negate();
};

DISP.EQFraction.SN__add_EQ = function(q) {
    var n1 = q.SN_numerator();
    var d1 = q.SN_denominator();
    var n2 = this._n;
    var d2 = this._d;
    return reduceEQ(n1.SN_multiply(d2).SN_add(n2.SN_multiply(d1)),
                    d1.SN_multiply(d2));
};

DISP.EQFraction.SN__subtract_EQ = function(q) {
    var n1 = q.SN_numerator();
    var d1 = q.SN_denominator();
    var n2 = this._n;
    var d2 = this._d;
    return reduceEQ(n1.SN_multiply(d2).SN_subtract(n2.SN_multiply(d1)),
                    d1.SN_multiply(d2));
};

DISP.EQFraction.SN__multiply_EQ = function(q) {
    return reduceEQ(q.SN_numerator().SN_multiply(this._n),
                    q.SN_denominator().SN_multiply(this._d));
};

DISP.EQFraction.SN__divide_EQ = function(q) {
    return reduceEQ(q.SN_numerator().SN_multiply(this._d),
                    q.SN_denominator().SN_multiply(this._n));
};

DISP.EQFraction.SN__add_EI = function(n) {
    return canonicalEQ(n.SN_multiply(this._d).SN_add(this._n), this._d);
};

DISP.EQFraction.SN__subtract_EI = function(n) {
    return canonicalEQ(n.SN_multiply(this._d).SN_subtract(this._n), this._d);
};

DISP.EQFraction.SN__multiply_EI = function(n) {
    return reduceEQ(n.SN_multiply(this._n), this._d);
};

DISP.EQFraction.SN__divide_EI = function(n) {
    return reduceEQ(n.SN_multiply(this._d), this._n);
};

DISP.EQFraction.SN_sqrt = function() {
    // This EQ may be too big for toValue(), but its square root may not be.
    return this._n.SN_sqrt().SN_divide(this._d.SN_sqrt());
};

DISP.EQFraction.SN_log = function() {
    return this._n.SN_log().SN_subtract(this._d.SN_log());
};

//
// EI: Exact integer abstract base class.
//

function EI() {}

EI.prototype = new EQ();
DISP.EI.SN_isInteger = retTrue;

DISP.EI.SN_debug = function() { return "EI"; };

DISP.EI.SN_numerator   = retThis;
DISP.EI.SN_denominator = function() { return ONE; };
DISP.EI.SN_floor       = retThis;
DISP.EI.SN_ceiling     = retThis;
DISP.EI.SN_round       = retThis;
DISP.EI.SN_truncate    = retThis;

DISP.EI.SN__toBigInteger = pureVirtual;

DISP.EI.SN_eq = function(z) {
    return SN(z).SN__eq_EI(this);
};
DISP.EI.SN__eq_EI = function(n) {
    return n.SN__toBigInteger().compare(this.SN__toBigInteger()) === 0;
};
DISP.EI.SN__eq_EQ = function(q) {
    return q.SN_numerator().SN_eq(this) && q.SN_denominator().SN_eq(ONE);
};

DISP.EI.SN_ne = function(z) {
    return SN(z).SN__ne_EI(this);
};
DISP.EI.SN__ne_EI = function(n) {
    return n.SN__toBigInteger().compare(this.SN__toBigInteger()) !== 0;
};
DISP.EI.SN__ne_EQ = function(q) {
    return q.SN_numerator().SN_ne(this) || q.SN_denominator().SN_ne(ONE);
};

DISP.EI.SN_compare = function(x) {
    return toReal(x).SN__compare_EI(this);
};
DISP.EI.SN__compare_EQ = function(q) {
    return q.SN_numerator().SN_compare(q.SN_denominator().SN_multiply(this));
};
DISP.EI.SN__compare_EI = function(n) {
    return n.SN__toBigInteger().compare(this.SN__toBigInteger());
};

DISP.EI.SN_add = function(z) {
    return SN(z).SN__add_EI(this);
};
DISP.EI.SN_subtract = function(z) {
    return SN(z).SN__subtract_EI(this);
};
DISP.EI.SN_multiply = function(z) {
    return SN(z).SN__multiply_EI(this);
};
//DISP.EI.SN_divide = function(z) {
//    return SN(z).SN__divide_EI(this);
//};

DISP.EI.SN_reciprocal = function() {
    if (this.SN_isNegative())
        return canonicalEQ(M_ONE, this.SN_negate());
    return canonicalEQ(ONE, this);
};

DISP.EI.SN_divAndMod = function(x) {
    return toReal(x).SN__divAndMod_EI(this);
};
DISP.EI.SN_div = function(x) {
    return toReal(x).SN__div_EI(this);
};
DISP.EI.SN_mod = function(x) {
    return toReal(x).SN__mod_EI(this);
};

DISP.EI.SN__add_EI = function(n) {
    return reduceBigInteger(n.SN__toBigInteger()
                            .add(this.SN__toBigInteger()));
};
DISP.EI.SN__subtract_EI = function(n) {
    return reduceBigInteger(n.SN__toBigInteger()
                            .subtract(this.SN__toBigInteger()));
};
DISP.EI.SN__multiply_EI = function(n) {
    return reduceBigInteger(n.SN__toBigInteger()
                            .multiply(this.SN__toBigInteger()));
};
DISP.EI.SN__divAndMod_EI = function(n) {
    var t = this.SN__toBigInteger();
    var dm = n.SN__toBigInteger().divRem(t);
    var div = dm[0];
    var mod = dm[1];

    if (mod.isNegative()) {
        mod = mod.add(t);
        div = div.prev();
    }
    return [reduceBigInteger(div), reduceBigInteger(mod)];
};
DISP.EI.SN__div_EI = function(n) {
    return this.SN__divAndMod_EI(n)[0];
};
DISP.EI.SN__mod_EI = function(n) {
    return this.SN__divAndMod_EI(n)[1];
};

DISP.EI.SN__add_EQ = function(q) {
    var d = q.SN_denominator();
    return canonicalEQ(q.SN_numerator().SN_add(d.SN_multiply(this)), d);
};

DISP.EI.SN__subtract_EQ = function(q) {
    var d = q.SN_denominator();
    return canonicalEQ(q.SN_numerator().SN_subtract(d.SN_multiply(this)), d);
};

DISP.EI.SN__multiply_EQ = function(q) {
    return reduceEQ(q.SN_numerator().SN_multiply(this), q.SN_denominator());
};

DISP.EI.SN__divide_EQ = function(q) {
    return reduceEQ(q.SN_numerator(), q.SN_denominator().SN_multiply(this));
};

function positiveIntegerExpt(b, p) {
    //assert(p > 0);
    //assert(p == round(p));
    var result = pow(b, p);
    if (result > -9007199254740992 && result < 9007199254740992)
        return toEINative(result);

    var newLog = b.SN_log() * p;
    if (newLog > SN.maxIntegerDigits * LN10)
        raise("&implementation-restriction",
              "exact integer would exceed limit of " + (+SN.maxIntegerDigits) +
              " digits; adjust SchemeNumber.maxIntegerDigits",
              newLog / LN10);

    return new EIBig(b.SN__toBigInteger().pow(p));
}

DISP.EI.SN_expt = function(z) {
    return SN(z).SN__expt_EI(this);
};

DISP.EI.SN__expt_EI = function(n) {
    // Return n to the power of this integer.
    var s = this.SN_sign();
    // Any inexactness is beyond the range that will fit in memory, we
    // assume.
    //assert(thisSN_.abs().SN_gt(ONE));
    var a = positiveIntegerExpt(n, this.SN_abs().valueOf());
    return (s > 0 ? a : a.SN_reciprocal());
};

function expt_E_EI(z, n) {
    // Return z raised to the power of this integer.
    // We don't get here if either z or this is 0, 1, or -1.
    var bits = n.SN_abs();
    var squarer = z;
    var ret = ONE;
    while (bits.SN_isPositive()) {
        if (bits.SN_isOdd())
            ret = ret.SN_multiply(squarer);
        squarer = squarer.SN_square();
        bits = bits.SN_div(TWO);
    }
    return (n.SN_isNegative() ? ret.SN_reciprocal() : ret);
}

DISP.EI.SN__expt_ER = function(x) {
    return expt_E_EI(x, this);
};

DISP.EI.SN__expt_C = function(z) {
    if (z.SN_isExact())
        return expt_E_EI(z, this);
    return complexExpt(z, this);
};

//
// EINative: Exact integers as native numbers.
//

function EINative(x) {
    //assert(x === floor(x));
    this._ = x;
}

EINative.prototype = new EI();

var ZERO  = SN.ZERO  = new EINative(0);
var ONE   = SN.ONE   = new EINative(1);
var M_ONE = SN.M_ONE = new EINative(-1);
var TWO   = SN.TWO   = new EINative(2);

var EINativeSmall    = [ ZERO, ONE, TWO ];

var I     = SN.I   = new Rectangular(ZERO, ONE);
var M_I   = SN.M_I = new Rectangular(ZERO, M_ONE);

function toEINative(n) {
    //assert(floor(n) === n);
    return EINativeSmall[n] || (n == -1 ? M_ONE : new EINative(n));
}

ZERO.SN_isZero     = retTrue;
ZERO.SN_isPositive = retFalse;
ZERO.SN_isNegative = retFalse;

ZERO.SN_compare = function(x) {
    return -x.SN_sign();
};

ZERO.SN_add        = SN;
ZERO.SN_negate     = retThis;
ZERO.SN_abs        = retThis;
ZERO.SN_multiply   = retThis;  // Should validate argument?  XXX
ZERO.SN_square     = retThis;
ZERO.SN_reciprocal = divisionByExactZero;

ZERO.SN_subtract = function(z) {
    return SN(z).SN_negate();
};

ZERO.SN_divide   = function(z) {
    z = SN(z);
    if (z.SN_isZero() && z.SN_isExact())
        divisionByExactZero();
    return this;
};

ZERO.SN_expt = function(z) {
    switch (SN(z).SN_realPart().SN_sign()) {
    case 1: return this;
    case 0: return ONE;
    case -1: default: divisionByExactZero();
    }
};

ZERO.SN_sqrt = retThis;
ZERO.SN_exp = retOne;
ZERO.SN_sin = retThis;
ZERO.SN_cos = retOne;
ZERO.SN_tan = retThis;
ZERO.SN_asin = retThis;
ZERO.SN_atan = retThis;

ONE.SN_isUnit     = retTrue;
ONE.SN_abs        = retThis;
ONE.SN_multiply   = SN;
ONE.SN_reciprocal = retThis;
ONE.SN_square     = retThis;
ONE.SN_expt       = retThis;  // Should validate argument?  XXX
ONE.SN_sqrt       = retThis;
ONE.SN_log        = retZero;
ONE.SN_acos       = retZero;

M_ONE.SN_isUnit     = retTrue;
M_ONE.SN_abs        = retOne;
M_ONE.SN_multiply   = ZERO.SN_subtract;
M_ONE.SN_reciprocal = retThis;
M_ONE.SN_square     = retOne;
M_ONE.SN_sqrt       = function() { return I; };

M_ONE.SN_expt = function(z) {
    z = SN(z);
    if (!z.SN_isInteger())
        return complexExpt(this, z);
    var ret = (z.SN_isEven() ? ONE : M_ONE);
    if (z.SN_isExact())
        return ret;
    return ret.SN_toInexact();
}

function negate(z) {
    return z.SN_negate();
}
function reciprocal(z) {
    return z.SN_reciprocal();
}

for (className in CLASSES) {
    ZERO["SN__add_"      + className] = retFirst;
    ZERO["SN__subtract_" + className] = retFirst;
    ZERO["SN__multiply_" + className] = retThis;
    ZERO["SN__divide_"   + className] = divisionByExactZero;
    ZERO["SN__expt_"     + className] = retOne;
    ONE["SN__multiply_" + className] = retFirst;
    ONE["SN__divide_"   + className] = retFirst;
    ONE["SN__expt_"     + className] = retFirst;
    M_ONE["SN__multiply_" + className] = negate;
    M_ONE["SN__divide_"   + className] = negate;
    M_ONE["SN__expt_"     + className] = reciprocal;
}

DISP.EINative.valueOf = function() {
    return this._;
};

DISP.EINative.SN_numberToString = function(radix, precision) {
    return this._.toString(radix || 10);
};

DISP.EINative.toFixed = function(dig) {
    return this._.toFixed(dig);
};
DISP.EINative.toExponential = function(dig) {
    return this._.toExponential(dig);
};
DISP.EINative.toPrecision = function(prec) {
    return this._.toPrecision(prec);
};

DISP.EINative.SN_debug = function() {
    return "EINative(" + this._ + ")";
};

DISP.EINative.SN__toBigInteger = function() {
    return BigInteger(this._);
};

DISP.EINative.SN_isPositive = function() {
    return this._ > 0;
};

DISP.EINative.SN_isNegative = function() {
    return this._ < 0;
};

DISP.EINative.SN_sign = function() {
    return (this._ > 0 ? 1 : (this._ == 0 ? 0 : -1));
};

DISP.EINative.SN_isEven = function() {
    return (this._ & 1) === 0;
};

DISP.EINative.SN_isOdd = function() {
    return (this._ & 1) === 1;
};

DISP.EINative.SN_eq = function(z) {
    return SN(z).SN__eq_EINative(this);
};
DISP.EINative.SN__eq_EINative = function(n) {
    return n._ === this._;
};

DISP.EINative.SN_ne = function(z) {
    return SN(z).SN__ne_EINative(this);
};
DISP.EINative.SN__ne_EINative = function(n) {
    return n._ !== this._;
};

DISP.EINative.SN_compare = function(x) {
    return toReal(x).SN__compare_EINative(this);
};
DISP.EINative.SN__compare_EINative = function(n) {
    return (n._ === this._ ? 0 : (n._ > this._ ? 1 : -1));
};

function add_EINative_EINative(a, b) {
    var ret = a + b;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger.add(a, b));
}

DISP.EINative.SN_add = function(z) {
    return SN(z).SN__add_EINative(this);
};
DISP.EINative.SN__add_EINative = function(n) {
    return add_EINative_EINative(n._, this._);
};

DISP.EINative.SN_negate = function() {
    return toEINative(-this._);
};

DISP.EINative.SN_abs = function() {
    return (this._ < 0 ? toEINative(-this._) : this);
};

DISP.EINative.SN_subtract = function(z) {
    return SN(z).SN__subtract_EINative(this);
};
DISP.EINative.SN__subtract_EINative = function(n) {
    return add_EINative_EINative(n._, -this._);
};

DISP.EINative.SN_multiply = function(z) {
    return SN(z).SN__multiply_EINative(this);
};
DISP.EINative.SN__multiply_EINative = function(n) {
    var ret = n._ * this._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger(n._).multiply(this._));
};

DISP.EINative.SN_square = function() {
    var ret = this._ * this._;
    if (ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger(this._).square());
};

DISP.EINative.SN_reciprocal = function() {
    var x = this._;
    /*
    if (x === 0)  // Removed this check, since ZERO overrides.
        throw divisionByExactZero();
    if (x === 1 || x === -1)  // Removed this optimization, similar reason.
        return this;
    */
    if (x < 0)
        return canonicalEQ(M_ONE, toEINative(-x));
    return canonicalEQ(ONE, this);
};

function divAndMod_EINative(t, x, which) {
    if (x === 0)
        divisionByExactZero();

    var div = (x > 0 ? floor(t / x) : ceil(t / x));
    if (which === 0)
        return toEINative(div);

    var tmp = x * div;
    var mod;

    if (tmp > -9007199254740992)
        mod = t - tmp;
    // XXX I'd like a nice test suite for this.
    else if (div > 0)
        mod = (t - x) - (x * (div - 1));
    else
        mod = (t + x) - (x * (div + 1));
    mod = toEINative(mod);

    if (which === 1)
        return mod;
    return [toEINative(div), mod];
};

DISP.EINative.SN_div = function(x) {
    return toReal(x).SN__div_EINative(this);
};
DISP.EINative.SN__div_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 0);
};

DISP.EINative.SN_mod = function(x) {
    return toReal(x).SN__mod_EINative(this);
};
DISP.EINative.SN__mod_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 1);
};

DISP.EINative.SN_divAndMod = function(x) {
    return toReal(x).SN__divAndMod_EINative(this);
};
DISP.EINative.SN__divAndMod_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 2);
};

DISP.EINative.SN__exp10 = function(n) {
    if (this._ === 0 || n === 0)
        return this;

    if (n < 0) {
        var num = String(this._);
        var i = num.length - 1;

        if (num[i] === '0') {
            while (num[i] === '0' && n < 0) {
                n += 1;
                i -= 1;
            }
            num = toEINative(Number(num.substring(0, i + 1)));
            if (n === 0)
                return num;
        }
        else {
            num = this;
        }

        var den;
        if (n < -15)
            den = new EIBig(BigInteger.ONE.exp10(-n));
        else
            // Could make this an array lookup.
            den = toEINative(Number("1000000000000000".substring(0, 1 - n)));
        return reduceEQ(num, den);
    }
    if (n < 16) {
        // Could make substring+parseInt an array lookup.
        var result = parseInt("1000000000000000".substring(0, n + 1)) * this._;
        if (result > -9007199254740992 && result < 9007199254740992)
            return toEINative(result);
    }
    return new EIBig(BigInteger(this._).exp10(n));
};

DISP.EINative.SN_exactIntegerSqrt = function() {
    var n = floor(sqrt(assertNonNegative(this)._));
    return [toEINative(n), toEINative(this._ - n * n)];
};

//
// EIBig: Exact integer as a BigInteger.
//

// 2 to the power 53, top of the range of consecutive integers
// representable exactly as native numbers.
var FIRST_BIG_INTEGER = BigInteger(9007199254740992);

function reduceBigInteger(n) {
    if (n.compareAbs(FIRST_BIG_INTEGER) >= 0)
        return new EIBig(n);
    return toEINative(n.toJSValue());
}

function EIBig(n) {
    this._ = n;
}

EIBig.prototype = new EI();

DISP.EIBig.SN_numberToString = function(radix) {
    return this._.toString(radix);
};

DISP.EIBig.valueOf = function() {
    return this._.valueOf();
};

["isZero", "isEven", "isOdd", "sign", "isUnit", "isPositive", "isNegative"]
    .forEach(function(fn) {
            DISP.EIBig["SN_" + fn] = function() {
                return this._[fn]();
            };
        });

DISP.EIBig.SN_log = function() {
    var x = this._.abs().log();
    return this._.isPositive() ? x : makeRectangular(x, PI);
};

DISP.EIBig.SN_debug = function() {
    return "EIBig(" + this._.toString() + ")";
};

DISP.EIBig.SN__toBigInteger = function() {
    return this._;
};

DISP.EIBig.SN_add = function(z) {
    return SN(z).SN__add_EIBig(this);
};

DISP.EIBig.SN_negate = function() {
    return new EIBig(this._.negate());
};

DISP.EIBig.SN_abs = function() {
    return new EIBig(this._.abs());
};

DISP.EIBig.SN_subtract = function(z) {
    return SN(z).SN__subtract_EIBig(this);
};

DISP.EIBig.SN_multiply = function(z) {
    return SN(z).SN__multiply_EIBig(this);
};

DISP.EIBig.SN_square = function() {
    return new EIBig(this._.square());
};

DISP.EIBig.SN__exp10 = function(n) {
    //assert(n === floor(n));
    if (n === 0)
        return this;
    if (n > 0)
        return new EIBig(this._.exp10(n));
    return reduceEQ(this, ONE._exp10(-n));
};

DISP.EIBig.SN_sqrt = function() {
    //assert(!this.SN_isZero());
    var mag = toFlonum(exp(this._.abs().log() / 2));
    return (this._.isNegative() ? inexactRectangular(INEXACT_ZERO, mag) : mag);
};

DISP.EIBig.SN_exactIntegerSqrt = function() {

    // I know of no use cases for this.  Be stupid.  Be correct.

    //assert(this._.compareAbs(FIRST_BIG_INTEGER) >= 0);

    function doit(n, a) {
        while (true) {
            var dm = n.divRem(a);
            var b = dm[0];
            var diff = a.subtract(b); // n == b*b + b*diff + dm[1], dm[1] < b+1

            if (diff.isZero())
                return [ b, dm[1] ]; // n == b*b + dm[1]

            if (diff.isUnit()) {
                if (diff.isPositive())
                    // n == b*b + b + dm[1], dm[1] < b+1
                    return [ b, b.add(dm[1]) ];

                // n == b*b - b + dm[1] == (b-1)^2 + b - 1 + dm[1]
                return [ a, a.add(dm[1]) ];
            }

            a = b.add(diff.quotient(2));
        }
    }

    var l = assertNonNegative(this)._.log() / 2 / LN10;
    var a = BigInteger(pow(10, l - floor(l)).toString()
                       + "e" + floor(l));
    return doit(this._, a).map(reduceBigInteger);
};

function gcdNative(a, b) {
    //assert(a >= 0 && b >= 0)
    var c;
    while (a !== 0) {
        c = a;
        a = b % a;
        b = c;
    }
    return toEINative(b);
}

function gcdBig(a, b) {
    var c;
    while (!a.isZero()) {
        c = a;
        a = b.remainder(a);
        b = c;
    }
    return reduceBigInteger(b);
}

function numberToBigInteger(n) {
    return BigInteger.parse(n.toString(16), 16);
}

// a and b must be nonnegative, either EIBig or EINative.
function gcd(a, b) {
    //assert(!a.SN_isNegative());
    //assert(!b.SN_isNegative());
    //assert(a instanceof EIBig || a instanceof EINative);
    //assert(b instanceof EIBig || b instanceof EINative);
    if (a instanceof EIBig)
        return gcdBig(a._, b.SN__toBigInteger());
    if (b instanceof EIBig)
        return gcdBig(numberToBigInteger(a._), b._);
    return gcdNative(a._, b._);
}

//
// Inheritance plumbing.
//

/*
function showMethodClasses() {
    var map = {};
    for (var className in DISP)
        for (var methName in DISP[className])
            (map[methName] = map[methName] || {})[className] = DISP[className][methName];
    for (var methName in map)
        for (var className in map[methName])
            print(className + "." + methName + (map[methName][className] === pureVirtual ? " =0" : ""));
}
showMethodClasses();
*/

function resolveOverload(className) {
    var proto = DISP[className];
    var newMethods = {};

    function resolve(subclasses, prefix, method) {
        function resolveSub(subclass) {
            if (proto[prefix + subclass])
                return;
            //print(className + "." + prefix + subclass + " -> " + oldName);
            newMethods[prefix + subclass] = method;
            resolve(HIERARCHY[subclass], prefix, method);
        }
        if (subclasses)
            subclasses.forEach(resolveSub);
    }

    for (var oldName in proto) {
        if (!/^SN_/.test(oldName))
            continue;

        var underscore = oldName.lastIndexOf("_");
        if (underscore === -1)
            continue;

        var oldMethod = proto[oldName];
        if (!oldMethod) {
            //print("Bogus " + className + ".prototype." + oldName);
            continue;
        }

        var oldClass = oldName.substring(underscore + 1);

        resolve(HIERARCHY[oldClass],
                oldName.substring(0, underscore + 1),
                oldMethod);
    }

    for (var methodName in newMethods) {
        proto[methodName] = newMethods[methodName];
    }
}

for (var className in CLASSES)
    resolveOverload(className);

// Workaround for Flonum not inheriting from R.
for (var methodName in DISP.R) {
    if (/^SN_/.test(methodName) && !DISP.Flonum[methodName])
        DISP.Flonum[methodName] = DISP.R[methodName];
}

// Workaround for Flonum not inheriting from C.
for (var methodName in DISP.C) {
    if (/^SN_/.test(methodName) && !DISP.Flonum[methodName])
        DISP.Flonum[methodName] = DISP.C[methodName];
}

// Workaround for C inheriting from Flonum.
for (var methodName in DISP.Flonum) {
    //if (!DISP.C[methodName]) print("Nuking C." + methodName);
    if (!DISP.C[methodName])
        DISP.C[methodName] = unimpl;
}

// Install methods.
for (var className in CLASSES) {
    for (var methodName in DISP[className]) {
        CLASSES[className].prototype[methodName] = DISP[className][methodName];
    }
}

function checkPureVirtual() {
    for (var className in CLASSES) {
        if (!/[a-z]/.test(className)) {
            // Not a concrete class.
            continue;
        }
        var proto = CLASSES[className].prototype;
        for (methodName in proto) {
            if (proto[methodName] === pureVirtual)
                print("Pure virtual: " + className + "." + methodName);
        }
    }
}
checkPureVirtual();

return SN;

})();

if (typeof exports !== "undefined") {
    exports.SchemeNumber = SchemeNumber;
    for (var name in SchemeNumber.fn)
        exports[name] = SchemeNumber.fn[name];
}
