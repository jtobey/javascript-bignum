// Scheme numerical tower in JavaScript.  Described in README.
// Copyright (c) 2011 by John Tobey <John.Tobey@gmail.com>

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

var SchemeNumber = (function(SN_IS_NUMBER) {

if (SN_IS_NUMBER === undefined)
    SN_IS_NUMBER = true;  // Modify Number.prototype by default.

var call     = Function.prototype.call;
var apply    = Function.prototype.apply;
var floor    = Math.floor;
var ceil     = Math.ceil;
var round    = Math.round;
var pow      = Math.pow;
var sqrt     = Math.sqrt;
var atan2    = Math.atan2;
var log      = Math.log;
var exp      = Math.exp;
var isFinite = this.isFinite;
var isNaN    = this.isNaN;

function retFalse()   { return false; }
function retTrue()    { return true;  }
function retFirst(a)  { return a; }
function retThis()    { return this; }
function retZero()    { return ZERO; }
function retOne()     { return ONE; }

function divisionByExactZero() {
    throw new RangeError("Division by exact zero");
}
function unimpl() {
    throw new Error("Unimplemented");
}
function pureVirtual() {
    throw new Error("BUG: Pure virtual function not overridden");
}

/* Internal class hierarchy:

   SN  <----  C  <----  Rectangular
                   |
                   `--  R  <----  Flonum[1]
                             |
                             `--  ER  <---  EQ  <----  EQFraction
                                                  |
                                                  `--  EI  <----  EINative
                                                             |
                                                             `--  EIBig

   [1] The Flonum class actually equals SN for reasons of efficiency
   and interoperability with native numbers.  Logically, Flonum should
   be a direct subclass of R.  Code at the bottom of this file
   populates missing slots in Flonum.prototype as if that were the
   case.

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


// Abstract over whether the user lets us add to the standard
// Number.prototype.  XXX This doesn't work yet, you have to let me
// add methods to Number.prototype.

var SN;            // private alias for the public SchemeNumber constructor.
var toSN;          // returns its argument if already an SN, else converts it.
var toFlonum;      // converts its argument to number and returns inexact real.
var isNumber;      // returns true if its argument is a Scheme number.
var INEXACT_ZERO;  // Flonum zero.
var floPow;        // Math.pow, with result converted to Flonum.
var floLog;        // Math.log, with result converted to Flonum.

if (SN_IS_NUMBER) {

    SN = Number;

    toSN = function(obj) {
        if (obj instanceof SN || typeof obj === "number")
            return obj;
        if (obj && obj.toSchemeNumber)
            return obj.toSchemeNumber();
        return parseNumber(obj);
    };
    String.prototype.toSchemeNumber = function() {
        return parseNumber(this);
    };

    isNumber = function(x) {
        return x instanceof SN || typeof x === "number";
    };

    toFlonum = Number;

    INEXACT_ZERO = 0;

    floPow = pow;
    floLog = log;
}
else {

    function wrapUnderscoreMethod(f) {
        switch (f.length) {
        case 0: return function() {
                return call.call(f, this._);
            };
        case 1: return function(a) {
                return call.call(f, this._, a);
            };
        case 2: return function(a, b) {
                return call.call(f, this._, a, b);
            };
        default: return function() {
                var len = arguments.length;
                var args = Array(len);
                while (len--)
                    args[len] = arguments[len];
                return apply.call(f, this._, args);
            };
        }
    }

    // Make SN imitate the standard Number object for most purposes.

    SN = function(x) {
        if (arguments.length === 0)
            x = 0;
        if (!(this instanceof SN))
            return Number(x);
        this._ = Number(x);
    };
    SN.prototype = new Number();
    SN.prototype.constructor = SN;
    SN.prototype.valueOf = function() { return this._; };
    ["toString", "toLocaleString", "toFixed", "toExponential", "toPrecision"]
        .forEach(function(name) {
                SN.prototype[name]
                    = wrapUnderscoreMethod(Number.prototype[name]);
            });
    ["MAX_VALUE", "MIN_VALUE", "NaN", "NEGATIVE_INFINITY", "POSITIVE_INFINITY"]
        .forEach(function(name) {
                SN[name] = new SN(Number[name]);
            });

    toSN = function(obj) {
        if (obj instanceof SN)
            return obj;
        if (typeof obj === "number")
            return toFlonum(obj);
        if (obj instanceof Number)
            return toFlonum(Number(obj));
        if (obj && obj.toSchemeNumber)
            return obj.toSchemeNumber();
        return parseNumber(obj);
    };

    isNumber = function(x) {
        return x instanceof SN;
    };

    toFlonum = function(x) {
        x = Number(x);
        if (x === 0)
            return INEXACT_ZERO;
        return new SN(x);
    };

    INEXACT_ZERO = new SN(0);

    floPow = function(x, y) { return toFlonum(pow(x, y)); };
    floLog = function(x)    { return toFlonum(log(x)); };
}

var Flonum = SN;

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
var mantissaWidthPattern = /\|[0-9]+$/;
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
        exact = value; i += 2;
    }
    function setRadix(value) {
        if (radix) lose();
        radix = value; i += 2;
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
                .divide(parseUinteger(s.substring(slash + 1), 1));

        if (radix !== 10)
            lose();

        // We have only one floating point width.
        s = s.replace(mantissaWidthPattern, '')
            .replace(exponentMarkerPattern, 'e');

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
            ._exp10(exponent - fraction.length);
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
        }
        return parseComplex(s.toString().substring(i));
    }
    catch (e) {
        if (e === PARSE_ERROR)
            return false;
        if (s == undefined)
            throw new TypeError("Missing argument");
        throw e;
    }
}

function parseNumber(s, exact, radix) {
    var ret = stringToNumber(s, radix, exact);
    if (ret === false)
        throw new SyntaxError("Not a number: " + s);
    return ret;
}

function makeRectangular(x, y) {
    if (x.isExact() && y.isExact())
        return exactRectangular(x, y);
    return inexactRectangular(x.toInexact(), y.toInexact());
}

function makePolar(r, theta) {
    return inexactRectangular(r.multiply(theta.cos()), r.multiply(theta.sin()));
}

function toReal(x) {
    x = toSN(x);
    if (!x.isReal())
        throw new TypeError("Not a real number: " + x);
    return x;
}

function toInteger(n) {
    n = toSN(n);
    if (!n.isInteger())
        throw new TypeError("Not an integer: " + n);
    return n;
}

// Configurable maximum integer magnitude.
var MAX_LOG = 1e8 * Math.LN10;  // 100 million digits.

SN.getMaxIntegerDigits = function() {
    return MAX_LOG / Math.LN10;
};
SN.setMaxIntegerDigits = function(max) {
    MAX_LOG = max * Math.LN10;
};

//
// Scheme functions.
//

SN.fn = {

    "eqv?" : function(a, b) {
        if (a === b)
            return true;
        a = toSN(a);
        b = toSN(b);
        return (a.isExact() === b.isExact() && a.eq(b));
    },

    "number?"   : isNumber,
    "complex?"  : isComplex,
    "real?"     : function(x) { return isNumber(x) && x.isReal();     },
    "rational?" : function(x) { return isNumber(x) && x.isRational(); },
    "integer?"  : function(x) { return isNumber(x) && x.isInteger();  },

    "real-valued?" : isRealValued,

    "rational-valued?" : function(x) {
        return isRealValued(x) && x.realPart().isRational();
    },

    "integer-valued?" : function(x) {
        return isRealValued(x) && x.realPart().isInteger();
    },

    "exact?"   : makeUnary("isExact"),
    "inexact?" : makeUnary("isInexact"),

    inexact : function(z) {
        if (typeof z === "number")
            return toFlonum(z);
        if (z instanceof SN)
            return z.toInexact();
        if (z instanceof Number)
            return toFlonum(Number(z));
        return parseNumber(z, false);
    },

    exact : function(z) {
        if (typeof z === "number")
            return nativeToExact(z);
        if (z instanceof SN)
            return z.toExact();
        if (z instanceof Number)
            return nativeToExact(Number(z));
        return parseNumber(z, true);
    },

    "=" : function(a, b) {
        var len = arguments.length;
        a = toSN(a);
        for (var i = 1; i < len; i++) {
            if (!a.eq(arguments[i]))
                return false;
        }
        return true;
    },

    "<"  : makeComparator("lt"),
    ">"  : makeComparator("gt"),
    "<=" : makeComparator("le"),
    ">=" : makeComparator("ge"),

    "zero?"     : makeUnary("isZero"),
    "positive?" : makeUnary("isPositive"),
    "negative?" : makeUnary("isNegative"),
    "odd?"      : makeUnary("isOdd"),
    "even?"     : makeUnary("isEven"),
    "finite?"   : makeUnary("isFinite"),
    "infinite?" : makeUnary("isInfinite"),
    "nan?"      : makeUnary("isNaN"),

    max : makeMaxMin("gt"),
    min : makeMaxMin("lt"),

    "+" : function() {
        var ret = ZERO;
        var i = arguments.length;
        while (i--)
            ret = ret.add(toSN(arguments[i]));
        return ret;
    },

    "*" : function() {
        var ret = ONE;
        var i = arguments.length;
        while (i--)
            ret = ret.multiply(toSN(arguments[i]));
        return ret;
    },

    "-" : function(a) {
        var ret = toSN(a);
        var i = arguments.length;
        if (i < 2)
            return ret.negate();
        while (i > 1)
            ret = ret.subtract(toSN(arguments[--i]));
        return ret;
    },

    "/" : function(a) {
        var first = toSN(a);
        var i = arguments.length;
        if (i < 2)
            return first.reciprocal();
        if (i === 2)
            return first.divide(arguments[1]);
        var product = ONE;
        while (i > 1)
            product = product.multiply(toSN(arguments[--i]));
        return first.divide(product);
    },

    abs             : makeUnary("abs"),
    "div-and-mod"   : makeBinary("divAndMod"),
    div             : makeBinary("div"),
    mod             : makeBinary("mod"),
    "div0-and-mod0" : function(x, y) { return div0AndOrMod0(x, y, 2); },
    div0            : function(x, y) { return div0AndOrMod0(x, y, 0); },
    mod0            : function(x, y) { return div0AndOrMod0(x, y, 1); },

    gcd : function() {
        var ret = ZERO;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && arg.isExact();
            ret = gcd(ret, arg.abs().toExact());
        }
        ret = ret.abs();
        return (exact ? ret : ret.toInexact());
    },

    lcm : function() {
        var ret = ONE;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && arg.isExact();
            arg = arg.toExact();
            ret = ret.multiply(arg).divide(gcd(ret, arg.abs()));
        }
        ret = ret.abs();
        return (exact ? ret : ret.toInexact());
    },

    numerator   : makeUnary("numerator"),
    denominator : makeUnary("denominator"),
    floor       : makeUnary("floor"),
    ceiling     : makeUnary("ceiling"),
    truncate    : makeUnary("truncate"),
    round       : makeUnary("round"),
    rationalize : rationalize,
    exp         : makeUnary("exp"),

    log : function(z, base) {
        var ret = toSN(z).log();
        if (typeof base !== "undefined")
            ret = ret.divide(toSN(base).log());
        return ret;
    },

    sin  : makeUnary("sin"),
    cos  : makeUnary("cos"),
    tan  : makeUnary("tan"),
    asin : makeUnary("asin"),
    acos : makeUnary("acos"),

    atan : function(y, x) {
        switch (arguments.length) {
        case 1: return toSN(y).atan();
        case 2: return toSN(y).atan2(x);
        default: throw new TypeError("atan expects 1 to 2 arguments, given "
                                     + arguments.length);
        }
    },

    sqrt : makeUnary("sqrt"),
    "exact-integer-sqrt" : makeUnary("exactIntegerSqrt"),
    expt : makeBinary("expt"),

    "make-rectangular" : function(x, y) {
        return makeRectangular(toReal(x), toReal(y));
    },

    "make-polar" : function(r, theta) {
        return makePolar(toReal(r), toReal(theta));
    },

    "real-part" : makeUnary("realPart"),
    "imag-part" : makeUnary("imagPart"),
    magnitude   : makeUnary("magnitude"),
    angle       : makeUnary("angle"),

    "number->string" : function(z, radix, precision) {
        return toSN(z).numberToString(radix, precision);
    },

    "string->number" : stringToNumber
};

// Scheme function helpers.

function isComplex(x) {
    return isNumber(x) && x.isComplex();
}
function isRealValued(x) {
    return isComplex(x) && x.imagPart().isZero();
}

function makeUnary(methodName) {
    return function(a) {
        return toSN(a)[methodName]();
    };
}
function makeBinary(methodName) {
    return function(a, b) {
        return toSN(a)[methodName](b);
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
            throw new TypeError("max/min needs at least one argument");

        var ret = toReal(a);
        var exact = ret.isExact();

        for (var i = 1; i < len; i++) {
            var x = toReal(arguments[i]);
            if (x.isNaN())
                return x;
            if (exact) {
                exact = x.isExact();
                if (!exact)
                    ret = ret.toInexact();  // XXX Avoid expensive comparisons?
            }
            if (x[cmp](ret) !== false) {
                ret = x;
            }
        }
        return exact ? ret : ret.toInexact();
    };
}

function div0AndOrMod0(x, y, which) {
    x = toReal(x);
    y = toReal(y);
    var dm = x.divAndMod(y);
    var m = dm[1];
    var yabs = y.abs();

    if (m.add(m).ge(yabs)) {
        switch (which) {
        case 0: return dm[0].add(y.isNegative() ? M_ONE : ONE);
        case 1: return m.subtract(yabs);
        case 2: default: return [dm[0].add(y.isNegative() ? M_ONE : ONE),
                                 m.subtract(yabs)];
        }
    }
    switch (which) {
    case 0: return dm[0];
    case 1: return m;
    case 2: default: return dm;
    }
}

function rationalize(x, delta) {
    x = toSN(x);
    delta = toSN(delta);

    // Handle weird cases first.
    if (!x.isFinite() || !delta.isFinite()) {
        toReal(x);
        toReal(delta);
        if (delta.isInfinite())
            return (x.isFinite() ? INEXACT_ZERO : NAN);
        if (delta.isNaN())
            return delta;
        return x;
    }

    delta = delta.abs();  // It's what PLT and Mosh seem to do.

    var x0 = x.subtract(delta);
    var x1 = x.add(delta);
    var a = x0.floor();
    var b = x1.floor();

    if (a.ne(b)) {
        var negative = a.isNegative();
        if (b.isNegative() != negative)
            return (a.isExact() ? ZERO : INEXACT_ZERO);
        return (negative ? b : x0.ceiling());
    }
    var cf = [];  // Continued fraction, b implied.

    while (true) {
        x0 = x0.subtract(a);
        if (x0.isZero())
            break;
        x1 = x1.subtract(a);
        if (x1.isZero())
            break;

        x0 = x0.reciprocal();
        x1 = x1.reciprocal();
        a = x0.floor();

        switch (a.compare(x1.floor())) {
        case -1: cf.push(x0.ceiling()); break;
        case  1: cf.push(x1.ceiling()); break;
        case 0: default:
            cf.push(a);
            continue;
        }
        break;
    }
    var ret = ZERO;
    var i = cf.length;
    while (i--)
        ret = ret.add(cf[i]).reciprocal();
    return ret.add(b);
}

//
// Flonum: Inexact real as a native number, wrapped if configured with
// SchemeNumber_is_Number=false.
//

DISP.Flonum.toJSValue = SN.prototype.valueOf;

DISP.Flonum.isExact    = retFalse;
DISP.Flonum.isInexact  = retTrue;
DISP.Flonum.isComplex  = retTrue;
DISP.Flonum.isReal     = retTrue;

DISP.Flonum.debug = function() {
    return "Flonum(" + this.numberToString() + ")";
};

function nativeDenominator(x) {
    // Get the "denominator" of a floating point value.
    // The result will be a power of 2.
    // This works by calling Number.prototype.toString with a radix of 2
    // and assuming the result will be a sequence of "0" and "1" characters,
    // possibly including a "." and possibly a leading "-".
    // Specification ECMA-262 Edition 5 (December 2009) does not strongly
    // support this assumption.  As an alternative, should this assumption
    // prove non-portable (i.e., if it doesn't work in IE), we could try
    // for (var d = 1; x !== floor(x); d *= 2) { x *= 2; } return d;

    //assert(isFinite(x));
    var s = x.toString(2);
    var i = s.indexOf(".");
    if (i === -1)
        return 1;
    return pow(2, s.length - i - 1);
}

function exactNativeIntegerToString(n, radix) {
    if (n > -9007199254740992 && n < 9007199254740992)
        return n.toString(radix);
    return numberToBigInteger(n).toString(radix);
}

function nativeToRationalString(q, radix) {
    //assert(isFinite(q));
    var d = nativeDenominator(q);
    var ns = exactNativeIntegerToString(q * d, radix);
    if (d === 1)
        return ns;
    return (ns + "/" +
            exactNativeIntegerToString(d, radix));
}

DISP.Flonum.numberToString = function(radix, precision) {
    // XXX Handle precision?
    if (radix && radix != 10 && isFinite(this))
        return "#i" + nativeToRationalString(this, radix);

    if (!isFinite(this)) {
        if (isNaN(this))
            return("+nan.0");
        return (this > 0 ? "+inf.0" : "-inf.0");
    }

    // XXX ECMAScript starts substituting zeroes for final digits before
    // it goes to exponential notation (11111111111111111111 .toString()
    // is "11111111111111110000") and I am not sure this is allowed in
    // Scheme.
    var s = this.toString();

    if (s.indexOf('.') === -1) {
        // Force the result to contain a decimal point as per R6RS.
        var e = s.indexOf('e');
        if (e === -1)
            return s + ".0"; // Could use "." but ".0" diffs better for testing.
        return s.substring(0, e) + "." + s.substring(e);
    }
    return s;
};

DISP.Flonum.realPart = retThis;

DISP.Flonum.imagPart = function() {
    return 0;
};

DISP.Flonum.denominator = function() {
    if (isFinite(this))
        return nativeDenominator(this);
    throw new TypeError("Can't coerce " + this + " to rational");
};

DISP.Flonum.numerator = function() {
    if (isFinite(this))
        return this * nativeDenominator(this);
    throw new TypeError("Can't coerce " + this + " to rational");
};

DISP.Flonum.isInteger = function() {
    return isFinite(this) && this == floor(this);
};

DISP.Flonum.isFinite = function() {
    return isFinite(this);
};
DISP.Flonum.isRational = DISP.Flonum.isFinite;

DISP.Flonum.isZero = function() {
    return this == 0;
};

DISP.Flonum.isPositive = function() {
    return this > 0;
};

DISP.Flonum.isNegative = function() {
    return this < 0;
};

DISP.Flonum.sign = function() {
    return (this == 0 ? 0 : (this > 0 ? 1 : -1));
};

DISP.Flonum.isUnit = function() {
    return this == 1 || this == -1;
};

DISP.Flonum.isInfinite = function() {
    return !isFinite(this) && !isNaN(this);
};

DISP.Flonum.isNaN = function() {
    return isNaN(this);
};

function numberToEI(n) {
    if (n < 9007199254740992 && n > -9007199254740992)
        return toEINative(n);
    return new EIBig(numberToBigInteger(n));
}

function nativeToExact(x) {
    if (!isFinite(x))
        throw new RangeError("No exact representation for " + x);
    var d = nativeDenominator(x);
    if (d === 1)
        return toEINative(x);
    var n = x * d;
    if (!isFinite(n))
        throw new RangeError("No exact representation for " + x);
    return canonicalEQ(numberToEI(n), numberToEI(d));
}

DISP.Flonum.toExact = function() {
    return nativeToExact(this);
};

DISP.Flonum.toInexact = retThis;

DISP.Flonum.negate = function() {
    return -this;
};

DISP.Flonum.abs = function() {
    return (this < 0 ? -this : this);
};

DISP.Flonum.reciprocal = function() {
    return 1 / this;
};

function div_Flonum_R(x, y) {
    if (y > 0)
        return floor(x / y);
    if (y < 0)
        return ceil(x / y);
    if (y == 0)
        throw new RangeError("div/mod by zero");
    return NaN;
}
DISP.Flonum.divAndMod = function(x) {
    x = Number(toReal(x));
    var div = div_Flonum_R(this, x);
    return [toFlonum(div), toFlonum(this - (x * div))];
};
DISP.Flonum.div = function(x) {
    return div_Flonum_R(this, toReal(x));
};
DISP.Flonum.mod = function(x) {
    return this - x * div_Flonum_R(this, toReal(x));
};

DISP.Flonum.square = function() {
    return this * this;
};

DISP.Flonum.eq = function(z) { return toSN(z)._eq_Flonum(this); };
DISP.Flonum.ne = function(z) { return toSN(z)._ne_Flonum(this); };
DISP.Flonum.gt = function(x) { return toReal(x)._gt_Flonum(this); };
DISP.Flonum.lt = function(x) { return toReal(x)._lt_Flonum(this); };
DISP.Flonum.ge = function(x) { return toReal(x)._ge_Flonum(this); };
DISP.Flonum.le = function(x) { return toReal(x)._le_Flonum(this); };

// Note operand order!
DISP.Flonum._gt_R = function(x) { return x > this; };
DISP.Flonum._lt_R = function(x) { return x < this; };
DISP.Flonum._ge_R = function(x) { return x >= this; };
DISP.Flonum._le_R = function(x) { return x <= this; };

DISP.Flonum.compare = function(x) {
    return toReal(x)._compare_Flonum(this);
};

DISP.Flonum.isEven = function() {
    //assert(this == floor(this));
    return (this & 1) === 0;
};

DISP.Flonum.isOdd = function() {
    //assert(this == floor(this));
    return (this & 1) === 1;
};

DISP.Flonum.round = function() {
    var ret = floor(this);
    var diff = this - ret;
    if (diff < 0.5) return ret;
    if (diff > 0.5) return ret + 1;
    return 2 * round(this / 2);
};

DISP.Flonum.truncate = function() {
    return (this < 0 ? ceil(this) : floor(this));
};

DISP.Flonum.ceiling = function() {
    return ceil(this);
};

["abs", "atan", "cos", "exp", "floor", "sin", "tan"]
    .forEach(function(name) {
            var fn = Math[name];
            DISP.Flonum[name] = function() {
                return fn(this);
            };
        });

["acos", "asin", "log"]
    .forEach(function(name) {
            var math = Math[name];
            var cplx = {acos:complexAcos, asin:complexAsin, log:complexLog}
                [name];
            DISP.Flonum[name] = function() {
                var ret = math(this);
                if (isNaN(ret))
                    return cplx(this);
                return ret;
            };
        });

DISP.Flonum.sqrt = function() {
    if (this >= 0)
        return toFlonum(sqrt(this));
    if (isNaN(this))
        return this;
    return inexactRectangular(INEXACT_ZERO, toFlonum(sqrt(-this)));
};

DISP.Flonum.log = function() {
    if (this < 0)
        return complexLog(this);
    return floLog(this);
};

DISP.Flonum.atan2 = function(x) {
    return atan2(this, toReal(x));
};

DISP.Flonum.expt = function(z) {
    return toSN(z)._expt_Flonum(this);
};

["E", "LN10", "LN2", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2"]
    .forEach(function(name) {
            SN[name] = toFlonum(Math[name]);
        });

var INFINITY     = SN.POSITIVE_INFINITY;
var M_INFINITY   = SN.NEGATIVE_INFINITY;
var NAN          = SN.NaN;
var PI           = SN.PI;

//
// C: Complex abstract base class.
//

function C() {}

C.prototype = new SN();

DISP.C.isReal     = retFalse;
DISP.C.isRational = retFalse;
DISP.C.isInteger  = retFalse;
DISP.C.isZero     = retFalse;
DISP.C.isUnit     = retFalse;

DISP.C.isComplex  = retTrue;

DISP.C.toString = function(radix, precision) {
    return this.numberToString(radix, precision);
};
DISP.C.valueOf = DISP.C.toString;
DISP.C.numberToString = pureVirtual;

DISP.C.debug = function() { return "C"; };

// vvvv You don't need this if you use only real numbers. vvvv

DISP.C.sqrt = function() {
    return makePolar(this.magnitude().sqrt(), this.angle().divide(TWO));
};

// Complex transcendental functions here for completeness, not optimized.

function complexLog(z) {
    return makeRectangular(z.magnitude().log(), z.angle());
};

function complexAsin(z) {
    return M_I.multiply(I.multiply(z)
                        .add(ONE.subtract(z.square()).sqrt()).log());
}

function complexAcos(z) {
    return PI.divide(TWO).subtract(complexAsin(z));
}

function complexAtan(z) {
    var iz = I.multiply(z);
    return ONE.add(iz).log().subtract(ONE.subtract(iz).log()).divide(TWO)
        .divide(I);
}

DISP.C.log  = function() { return complexLog (this); };
DISP.C.asin = function() { return complexAsin(this); };
DISP.C.acos = function() { return complexAcos(this); };
DISP.C.atan = function() { return complexAtan(this); };

DISP.C.sin = function() {
    var iz = I.multiply(this);
    return iz.exp().subtract(iz.negate().exp()).divide(TWO).divide(I);
};

DISP.C.cos = function() {
    var iz = I.multiply(this);
    return iz.exp().add(iz.negate().exp()).divide(TWO);
};

DISP.C.tan = function() {
    return this.sin().divide(this.cos());
};

// ^^^^ You don't need this if you use only real numbers. ^^^^

//
// R: Real abstract base class.
//

function R() {}

R.prototype = new C();
DISP.R.isReal = retTrue;

DISP.R.debug = function() { return "R"; };

DISP.R.realPart = retThis;

DISP.R.toJSValue = function() {
    return Number(this);
};

// Methods implemented generically using more basic operations.

DISP.R.isPositive = function() {
    return this.sign() > 0;
};
DISP.R.isNegative = function() {
    return this.sign() < 0;
};
DISP.R.sign = function() {
    return this.compare(ZERO);
};

DISP.R.magnitude = function() {
    return this.abs();
};

DISP.R.angle = function() {
    return this.isNegative() ? PI : ZERO;
};

// Dispatches.

DISP.R._eq_Flonum = function(x) { return +x == this; };
DISP.R._ne_Flonum = function(x) { return +x != this; };
DISP.Flonum._eq_R = DISP.R._eq_Flonum;
DISP.Flonum._ne_R = DISP.R._ne_Flonum;

DISP.R._eq_Rectangular = function(z) {
    return z._y.isZero() && z._x.eq(this);
};
DISP.R._ne_Rectangular = function(z) {
    return !z._y.isZero() || z._x.ne(this);
};

// Note operand order!
DISP.R._gt_Flonum = DISP.Flonum._gt_R;
DISP.R._lt_Flonum = DISP.Flonum._lt_R;
DISP.R._ge_Flonum = DISP.Flonum._ge_R;
DISP.R._le_Flonum = DISP.Flonum._le_R;

DISP.R._compare_Flonum = function(x) {
    if (x == this) return 0;
    if (x < this) return -1;
    if (x > this) return 1;
    return NaN;
};

DISP.R.gt = function(x) { return toReal(x)._gt_R(this); };
DISP.R.lt = function(x) { return toReal(x)._lt_R(this); };
DISP.R.ge = function(x) { return toReal(x)._ge_R(this); };
DISP.R.le = function(x) { return toReal(x)._le_R(this); };

DISP.R.add = function(z) {
    return toSN(z)._add_R(this);
};
DISP.Flonum._add_R = function(x) {
    return x + this;
};

DISP.R.subtract = function(z) {
    return toSN(z)._subtract_R(this);
};
DISP.Flonum._subtract_R = function(x) {
    return x - this;
};

DISP.R.multiply = function(z) {
    return toSN(z)._multiply_R(this);
};
DISP.Flonum._multiply_R = function(x) {
    return x * this;
};

DISP.R.divide = function(z) {
    return toSN(z)._divide_R(this);
};
DISP.Flonum._divide_R = function(x) {
    return x / this;
};

function complexExpt(b, p) {
    return b.log().multiply(p).exp();
}

DISP.R._expt_R = function(x) {
    // Return x to the power of this number.
    if (x.isNegative())
        return complexExpt(x, this);
    return floPow(x, this);
};

DISP.R._expt_EI = DISP.R._expt_R;

DISP.R._expt_EQ = function(q) {
    // Return q to the power of this number.
    if (q.isNegative())
        return complexExpt(q, this);
    var num = q.numerator().expt(this);
    var den = q.denominator().expt(this);
    if (num.isExact() && num.isInteger() && den.isExact() && den.isInteger())
        return new EQFraction(num, den);  // Known to be in lowest terms.
    return num.divide(den);
};

function divAndMod_R_R(x, y) {
    var div = div_R_R(x, y);
    return [div, x.subtract(div.multiply(y))];
}
function div_R_R(x, y) {
    return (y.isNegative() ? x.divide(y).ceiling() : x.divide(y).floor());
}
function mod_R_R(x, y) {
    return x.subtract(div_R_R(x, y).multiply(y));
}

DISP.R.divAndMod = function(x) {
    return divAndMod_R_R(this, toReal(x));
};
DISP.R.div = function(x) {
    return div_R_R(this, toReal(x));
};
DISP.R.mod = function(x) {
    return mod_R_R(this, toReal(x));
};

DISP.R._divAndMod_R = function(x) {
    return divAndMod_R_R(x, this);
};
DISP.R._div_R = function(x) {
    return div_R_R(x, this);
};
DISP.R._mod_R = function(x) {
    return mod_R_R(x, this);
};

// These functions are always allowed to return inexact.  We, however,
// override a few of these in ZERO and ONE.
["sqrt", "exp", "log", "sin", "cos", "tan", "asin", "acos", "atan", "atan2"]
.forEach(function(name) { DISP.R[name] = DISP.Flonum[name]; });

// vvvv You don't need this if you use only real numbers. vvvv

//
// Rectangular: Complex numbers as xy-coordinate pairs.
//

function exactRectangular(x, y) {
    //assert(x.isExact());
    //assert(y.isExact());
    if (y.isZero())
        return x;
    if (x.isZero() && y.isUnit())
        return (y.isPositive() ? I : M_I);
    return new Rectangular(x, y);
}

function inexactRectangular(x, y) {
    //assert(x.isInexact());
    //assert(y.isInexact());
    return new Rectangular(x, y);
}

function toRectangular(x, y) {
    //assert(x.isExact() === y.isExact())
    if (x.isExact())
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

DISP.Rectangular.numberToString = function(radix, precision) {
    return xyToString(this._x.numberToString(radix, precision),
                      this._y.numberToString(radix, precision));
};

DISP.Rectangular.toString = function(radix) {
    radix = radix || 10;
    return xyToString(this._x.toString(radix), this._y.toString(radix));
};

DISP.Rectangular.debug = function() {
    return "Rectangular(" + this._x.debug() + ", " + this._y.debug() + ")";
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

DISP.Rectangular.realPart = function() { return this._x; };
DISP.Rectangular.imagPart = function() { return this._y; };

DISP.Rectangular.isExact   = function() { return this._x.isExact(); };
DISP.Rectangular.isInexact = function() { return this._x.isInexact(); };

DISP.Rectangular.toInexact = function() {
    if (this._x.isInexact())
        return this;
    return inexactRectangular(this._x.toInexact(), this._y.toInexact());
};

DISP.Rectangular.toExact = function() {
    if (this._x.isExact())
        return this;
    return exactRectangular(this._x.toExact(), this._y.toExact());
};

DISP.Rectangular.isZero = function() {
    return this._x.isZero() && this._y.isZero();
};

function rectMagnitude2(z) {
    return z._x.square().add(z._y.square());
}

DISP.Rectangular.isUnit = function() {
    return rectMagnitude2(this).eq(ONE);
};

DISP.Rectangular.magnitude = function() {
    if (this._x.isZero())
        return this._y.abs();
    return rectMagnitude2(this).sqrt();
};

DISP.Rectangular.angle = function() {
    return this._y.atan2(this._x);
};

DISP.C._eq_Rectangular = pureVirtual;
DISP.Rectangular.eq = function(z) {
    return toSN(z)._eq_Rectangular(this);
};
DISP.Rectangular._eq_Rectangular = function(z) {
    return z._x.eq(this._x) && z._y.eq(this._y);
};
DISP.Rectangular._eq_R = function(x) {
    return this._y.isZero() && x.eq(this._x);
};

DISP.C._ne_Rectangular = pureVirtual;
DISP.Rectangular.ne = function(z) {
    return toSN(z)._ne_Rectangular(this);
};
DISP.Rectangular._ne_Rectangular = function(z) {
    return z._x.ne(this._x) || z._y.ne(this._y);
};
DISP.Rectangular._ne_R = function(x) {
    return !this._y.isZero() || x.ne(this._x);
};

// Arithmetic where the left operand is Rectangular and the right is
// this Flonum.

DISP.Flonum._add_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x + this), z._y.toInexact());
};
DISP.Flonum._subtract_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x - this), z._y.toInexact());
};
DISP.Flonum._multiply_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x * this), toFlonum(z._y * this));
};
DISP.Flonum._divide_Rectangular = function(z) {
    return inexactRectangular(toFlonum(z._x / this), toFlonum(z._y / this));
};
DISP.Flonum._expt_Rectangular = function(z) {
    // XXX Is this any cheaper than complexExpt??
    return makePolar(floPow(rectMagnitude2(z), this / 2),
                     toFlonum(atan2(z._y, z._x) * this));
};

// Mitigate the effects of inheriting from Flonum.
for (var methodName in DISP.Flonum) {
    if (methodName.indexOf("_Rectangular") !== -1 && !DISP.C[methodName])
        DISP.C[methodName] = unimpl;
}

// Arithmetic where the left operand is Rectangular and the right is
// this real number.

DISP.R._add_Rectangular = function(z) {
    return makeRectangular(z._x.add(this), z._y);
};

DISP.R._subtract_Rectangular = function(z) {
    return makeRectangular(z._x.subtract(this), z._y);
};

DISP.R._multiply_Rectangular = function(z) {
    return toRectangular(z._x.multiply(this), z._y.multiply(this));
};

DISP.R._divide_Rectangular = function(z) {
    return toRectangular(z._x.divide(this), z._y.divide(this));
};

DISP.C._add_Rectangular = pureVirtual;
DISP.Rectangular.add = function(z) {
    return toSN(z)._add_Rectangular(this);
};
DISP.Rectangular._add_R = function(x) {
    return makeRectangular(x.add(this._x), this._y);
};
DISP.Rectangular._add_Rectangular = function(z) {
    var x = z._x.add(this._x);
    var y = z._y.add(this._y);
    return (x.isExact() ? exactRectangular : inexactRectangular)(x, y);
};

DISP.Rectangular.negate = function() {
    return toRectangular(this._x.negate(), this._y.negate());
};

DISP.C._subtract_Rectangular = pureVirtual;
DISP.Rectangular.subtract = function(z) {
    return toSN(z)._subtract_Rectangular(this);
};
DISP.Rectangular._subtract_R = function(x) {
    return makeRectangular(x.subtract(this._x), this._y.negate());
};
DISP.Rectangular._subtract_Rectangular = function(z) {
    var x = z._x.subtract(this._x);
    var y = z._y.subtract(this._y);
    return (x.isExact() ? exactRectangular : inexactRectangular)(x, y);
};

DISP.C._multiply_Rectangular = pureVirtual;
DISP.Rectangular.multiply = function(z) {
    return toSN(z)._multiply_Rectangular(this);
};
DISP.Rectangular._multiply_R = function(x) {
    return toRectangular(x.multiply(this._x), x.multiply(this._y));
};
function complexMultiply(ax, ay, bx, by) {
    return toRectangular(ax.multiply(bx).subtract(ay.multiply(by)),
                         ax.multiply(by).add(ay.multiply(bx)));
}
DISP.Rectangular._multiply_Rectangular = function(z) {
    return complexMultiply(z._x, z._y, this._x, this._y);
};

DISP.Rectangular.square = function() {
    return toRectangular(this._x.square().subtract(this._y.square()),
                         this._x.multiply(this._y).multiply(TWO));
};

DISP.Rectangular.reciprocal = function() {
    var m2 = rectMagnitude2(this);
    return toRectangular(this._x.divide(m2), this._y.divide(m2).negate());
};

DISP.C._divide_Rectangular = pureVirtual;
DISP.Rectangular.divide = function(z) {
    return toSN(z)._divide_Rectangular(this);
};
function complexDivide(x, y, z) {  // returns (x + iy) / z
    var m2 = rectMagnitude2(z);
    return complexMultiply(x, y, z._x.divide(m2), z._y.divide(m2).negate());
}
DISP.Rectangular._divide_R = function(x) {
    return complexDivide(x, x.isExact() ? ZERO : INEXACT_ZERO, this);
};
DISP.Rectangular._divide_Rectangular = function(z) {
    return complexDivide(z._x, z._y, this);
};

DISP.Rectangular.expt = function(z) {
    return toSN(z)._expt_Rectangular(this);
};
DISP.Rectangular._expt_C = function(z) {
    return complexExpt(z, this);
};
DISP.C._expt_Rectangular = DISP.Rectangular._expt_C;

DISP.Rectangular.exp = function() {
    return makePolar(this._x.exp(), this._y);
};

// ^^^^ You don't need this if you use only real numbers. ^^^^

//
// ER: Exact real abstract base class.
//

function ER() {}

ER.prototype = new R();
DISP.ER.isExact    = retTrue;
DISP.ER.isInexact  = retFalse;

DISP.ER.toExact    = retThis;
DISP.ER.toInexact  = function() { return toFlonum(this); };

DISP.ER.isNaN      = retFalse;
DISP.ER.isFinite   = retTrue;
DISP.ER.isInfinite = retFalse;

DISP.ER.imagPart   = retZero;

//
// EQ: Exact rational abstract base class.
//

function EQ() {}

EQ.prototype = new ER();
DISP.EQ.isRational = retTrue;

DISP.EQ.eq = function(z) {
    return toSN(z)._eq_EQ(this);
};
DISP.EQ._eq_EQ = pureVirtual;

DISP.EQ.ne = function(z) {
    return toSN(z)._ne_EQ(this);
};
DISP.EQ._ne_EQ = pureVirtual;

DISP.EQ.compare = function(z) {
    return toReal(z)._compare_EQ(this);
};
DISP.EQ._compare_EQ = pureVirtual;

DISP.EQ.add = function(z) {
    return toSN(z)._add_EQ(this);
};
DISP.EQ._add_EQ = pureVirtual;

DISP.EQ.subtract = function(z) {
    return toSN(z)._subtract_EQ(this);
};
DISP.EQ._subtract_EQ = pureVirtual;

DISP.EQ.multiply = function(z) {
    return toSN(z)._multiply_EQ(this);
};
DISP.EQ._multiply_EQ = pureVirtual;

DISP.EQ.divide = function(z) {
    return toSN(z)._divide_EQ(this);
};
DISP.EQ._divide_EQ = pureVirtual;

DISP.EQ.expt = function(z) {
    return toSN(z)._expt_EQ(this);
};

function reduceEQ(n, d) {
    if (d.isZero())
        divisionByExactZero();

    var g = gcd(n.abs(), d.abs());

    n = n.div(g);
    d = d.div(g);

    if (d.isNegative())
        return canonicalEQ(n.negate(), d.negate());
    return canonicalEQ(n, d);
}

function canonicalEQ(n, d) {
    return (d === ONE ? n : new EQFraction(n, d));
}

//
// EQFraction: Exact rational as numerator and positive denominator
// with no factors in common.
//

function EQFraction(n, d) {
    //assert(d.gt(ONE));
    //assert(gcd(n.abs(), d).eq(ONE));
    this._n = n;
    this._d = d;
}

EQFraction.prototype = new EQ();

DISP.EQFraction.numberToString = function(radix, precision) {
    return (this._n.numberToString(radix) +
            "/" + this._d.numberToString(radix));
};

DISP.EQFraction.valueOf = function() {
    var n = this._n;
    var d = this._d;
    var ret = n / d;
    if (!isNaN(ret))
        return ret;
    if (n.isNegative())
        return -exp(n.negate().log() - d.log());
    return exp(n.log() - d.log());
};

DISP.EQFraction.debug = function() {
    return "EQFraction(" + this._n.debug() + " / " + this._d.debug() + ")";
};

DISP.EQFraction.numerator = function () {
    return this._n;
};

DISP.EQFraction.denominator = function() {
    return this._d;
};

DISP.EQFraction.isPositive = function() {
    return this._n.isPositive();
};

DISP.EQFraction.isNegative = function() {
    return this._n.isNegative();
};

DISP.EQFraction._eq_EQ = function(q) {
    return (q.numerator().eq(this._n) && q.denominator().eq(this._d));
};

DISP.EQFraction._ne_EQ = function(q) {
    return (q.numerator().ne(this._n) || q.denominator().ne(this._d));
};

DISP.EQFraction._compare_EQ = function(q) {
    var qn = q.numerator();
    var signDiff = q.sign() - this._n.sign();
    if (signDiff !== 0)
        return (signDiff > 0 ? 1 : -1);
    var qd = q.denominator();
    if (qd === this._d)
        return qn.compare(this._n);
    return qn.multiply(this._d).compare(qd.multiply(this._n));
};

DISP.EQFraction.negate = function() {
    return new EQFraction(this._n.negate(), this._d);
};

DISP.EQFraction.square = function() {
    return new EQFraction(this._n.square(), this._d.square());
};

DISP.EQFraction.reciprocal = function() {
    switch (this._n.sign()) {
    case -1: return canonicalEQ(this._d.negate(), this._n.negate());
    case 1: return canonicalEQ(this._d, this._n);
    case 0: default: divisionByExactZero();
    }
};

DISP.EQFraction.floor = function() {
    return this._n.div(this._d);
};

DISP.EQFraction.ceiling = function() {
    //assert(this._d.gt(ONE));
    return this._n.div(this._d).add(ONE);
};

DISP.EQFraction.round = function() {
    if (this._d.eq(TWO)) {
        var ret = this._n.div(TWO);
        return ret.isEven() ? ret : ret.add(ONE);
    }
    var dm = this._n.divAndMod(this._d);
    var mod = dm[1];
    if (mod.add(mod).lt(this._d))
        return dm[0];
    return dm[0].add(ONE);
};

DISP.EQFraction.truncate = function() {
    if (this._n.isPositive())
        return this._n.div(this._d);
    return this._d.isUnit() ? this._n : this._n.div(this._d).add(ONE);
};

DISP.EQFraction.sign = function() {
    return this._n.sign();
};

DISP.EQFraction.abs = function() {
    if (this._n.sign() >= 0)
        return this;
    return this.negate();
};

DISP.EQFraction._add_EQ = function(q) {
    var n1 = q.numerator();
    var d1 = q.denominator();
    var n2 = this._n;
    var d2 = this._d;
    return reduceEQ(n1.multiply(d2).add(n2.multiply(d1)), d1.multiply(d2));
};

DISP.EQFraction._subtract_EQ = function(q) {
    var n1 = q.numerator();
    var d1 = q.denominator();
    var n2 = this._n;
    var d2 = this._d;
    return reduceEQ(n1.multiply(d2).subtract(n2.multiply(d1)), d1.multiply(d2));
};

DISP.EQFraction._multiply_EQ = function(q) {
    return reduceEQ(q.numerator().multiply(this._n),
                    q.denominator().multiply(this._d));
};

DISP.EQFraction._divide_EQ = function(q) {
    return reduceEQ(q.numerator().multiply(this._d),
                    q.denominator().multiply(this._n));
};

DISP.EQFraction._add_EI = function(n) {
    return canonicalEQ(n.multiply(this._d).add(this._n), this._d);
};

DISP.EQFraction._subtract_EI = function(n) {
    return canonicalEQ(n.multiply(this._d).subtract(this._n), this._d);
};

DISP.EQFraction._multiply_EI = function(n) {
    return reduceEQ(n.multiply(this._n), this._d);
};

DISP.EQFraction._divide_EI = function(n) {
    return reduceEQ(n.multiply(this._d), this._n);
};

DISP.EQFraction.sqrt = function() {
    // This EQ may be too big for toValue(), but its square root may not be.
    return this._n.sqrt().divide(this._d.sqrt());
};

//
// EI: Exact integer abstract base class.
//

function EI() {}

EI.prototype = new EQ();
DISP.EI.isInteger = retTrue;

DISP.EI.debug = function() { return "EI"; };

DISP.EI.numerator   = retThis;
DISP.EI.denominator = function() { return ONE; };
DISP.EI.floor       = retThis;
DISP.EI.ceiling     = retThis;
DISP.EI.round       = retThis;
DISP.EI.truncate    = retThis;

DISP.EI._toBigInteger = pureVirtual;

DISP.EI.eq = function(x) {
    return x._eq_EI(this);
};
DISP.EI._eq_EI = function(n) {
    return n._toBigInteger().compare(this._toBigInteger()) === 0;
};
DISP.EI._eq_EQ = function(q) {
    return q.numerator().eq(this) && q.denominator().eq(ONE);
};

DISP.EI.ne = function(x) {
    return x._ne_EI(this);
};
DISP.EI._ne_EI = function(n) {
    return n._toBigInteger().compare(this._toBigInteger()) !== 0;
};
DISP.EI._ne_EQ = function(q) {
    return q.numerator().ne(this) || q.denominator().ne(ONE);
};

DISP.EI._compare_EQ = function(q) {
    return q.numerator().compare(q.denominator().multiply(this));
};

DISP.EI.add = function(z) {
    return toSN(z)._add_EI(this);
};
DISP.EI.subtract = function(z) {
    return toSN(z)._subtract_EI(this);
};
DISP.EI.multiply = function(z) {
    return toSN(z)._multiply_EI(this);
};
//DISP.EI.divide = function(z) {
//    return toSN(z)._divide_EI(this);
//};

DISP.EI.reciprocal = function() {
    if (this.isNegative())
        return canonicalEQ(M_ONE, this.negate());
    return canonicalEQ(ONE, this);
};

DISP.EI.divAndMod = function(x) {
    return toReal(x)._divAndMod_EI(this);
};
DISP.EI.div = function(x) {
    return toReal(x)._div_EI(this);
};
DISP.EI.mod = function(x) {
    return toReal(x)._mod_EI(this);
};

DISP.EI._add_EI = function(n) {
    return reduceBigInteger(n._toBigInteger().add(this._toBigInteger()));
};
DISP.EI._subtract_EI = function(n) {
    return reduceBigInteger(n._toBigInteger().subtract(this._toBigInteger()));
};
DISP.EI._multiply_EI = function(n) {
    return reduceBigInteger(n._toBigInteger().multiply(this._toBigInteger()));
};
DISP.EI._divAndMod_EI = function(n) {
    var t = this._toBigInteger();
    var dm = n._toBigInteger().divRem(t);
    var div = dm[0];
    var mod = dm[1];

    if (mod.isNegative()) {
        mod = mod.add(t);
        div = div.prev();
    }
    return [reduceBigInteger(div), reduceBigInteger(mod)];
};
DISP.EI._div_EI = function(n) {
    return this._divAndMod_EI(n)[0];
};
DISP.EI._mod_EI = function(n) {
    return this._divAndMod_EI(n)[1];
};

DISP.EI._add_EQ = function(q) {
    var d = q.denominator();
    return canonicalEQ(q.numerator().add(d.multiply(this)), d);
};

DISP.EI._subtract_EQ = function(q) {
    var d = q.denominator();
    return canonicalEQ(q.numerator().subtract(d.multiply(this)), d);
};

DISP.EI._multiply_EQ = function(q) {
    return reduceEQ(q.numerator().multiply(this), q.denominator());
};

DISP.EI._divide_EQ = function(q) {
    return reduceEQ(q.numerator(), q.denominator().multiply(this));
};

function positiveIntegerExpt(b, p) {
    //assert(p > 0); assert(p == Math.round(p));
    var result = pow(b, p);
    if (result > -9007199254740992 && result < 9007199254740992)
        return toEINative(result);
    if (b.log() * p > MAX_LOG)
        throw new Error("expt: integer exceeds limit of " +
                        (MAX_LOG / Math.LN10) + " digits; adjust with " +
                        "SchemeNumber.setMaxIntegerDigits(...)");
    return new EIBig(b._toBigInteger().pow(p));
}

DISP.EI.expt = function(z) {
    return toSN(z)._expt_EI(this);
};

DISP.EI._expt_EI = function(n) {
    // Return n to the power of this integer.
    var s = this.sign();
    // Any inexactness is beyond the range that will fit in memory, we
    // assume.
    //assert(this.abs().gt(ONE));
    var a = positiveIntegerExpt(n, this.abs().valueOf());
    return (s > 0 ? a : a.reciprocal());
};

function expt_E_EI(z, n) {
    // Return z raised to the power of this integer.
    // We don't get here if either z or this is 0, 1, or -1.
    var bits = n.abs();
    var squarer = z;
    var ret = ONE;
    while (bits.isPositive()) {
        if (bits.isOdd())
            ret = ret.multiply(squarer);
        squarer = squarer.square();
        bits = bits.div(TWO);
    }
    return (n.isNegative() ? ret.reciprocal() : ret);
}

DISP.EI._expt_ER = function(x) {
    return expt_E_EI(x, this);
};

DISP.EI._expt_C = function(z) {
    if (z.isExact())
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

var EINativeSmall = { 0:ZERO, 1:ONE, "-1":M_ONE, 2:TWO };

var I     = SN.I   = new Rectangular(ZERO, ONE);
var M_I   = SN.M_I = new Rectangular(ZERO, M_ONE);

function toEINative(n) {
    //assert(floor(n) === n);
    return EINativeSmall[n] || new EINative(n);
}

ZERO.isZero     = retTrue;
ZERO.isPositive = retFalse;
ZERO.isNegative = retFalse;

ZERO.compare = function(x) {
    return -x.sign();
};

ZERO.add        = toSN;
ZERO.negate     = retThis;
ZERO.abs        = retThis;
ZERO.multiply   = retThis;  // Should validate argument?  XXX
ZERO.square     = retThis;
ZERO.reciprocal = divisionByExactZero;

ZERO.subtract = function(z) {
    return toSN(z).negate();
};

ZERO.divide   = function(z) {
    z = toSN(z);
    if (z.isZero() && z.isExact())
        divisionByExactZero();
    return this;
};

ZERO.expt = function(z) {
    switch (toSN(z).realPart().sign()) {
    case 1: return this;
    case 0: return ONE;
    case -1: default: divisionByExactZero();
    }
};

ZERO.sqrt = retThis;
ZERO.exp = retOne;
ZERO.sin = retThis;
ZERO.cos = retOne;
ZERO.tan = retThis;
ZERO.asin = retThis;
ZERO.atan = retThis;

ONE.isUnit     = retTrue;
ONE.abs        = retThis;
ONE.multiply   = toSN;
ONE.reciprocal = retThis;
ONE.square     = retThis;
ONE.expt       = retThis;  // Should validate argument?  XXX
ONE.sqrt       = retThis;
ONE.log        = retZero;
ONE.acos       = retZero;

M_ONE.isUnit     = retTrue;
M_ONE.abs        = retOne;
M_ONE.multiply   = ZERO.subtract;
M_ONE.reciprocal = retThis;
M_ONE.square     = retOne;
M_ONE.sqrt       = function() { return I; };

M_ONE.expt = function(z) {
    z = toSN(z);
    if (!z.isInteger())
        return complexExpt(this, z);
    var ret = (z.isEven() ? ONE : M_ONE);
    if (z.isExact())
        return ret;
    return ret.toInexact();
}

function negate(z) {
    return z.negate();
}
function reciprocal(z) {
    return z.reciprocal();
}

for (className in CLASSES) {
    ZERO["_add_"      + className] = retFirst;
    ZERO["_subtract_" + className] = retFirst;
    ZERO["_multiply_" + className] = retThis;
    ZERO["_divide_"   + className] = divisionByExactZero;
    ZERO["_expt_"     + className] = retOne;
    ONE["_multiply_" + className] = retFirst;
    ONE["_divide_"   + className] = retFirst;
    ONE["_expt_"     + className] = retFirst;
    M_ONE["_multiply_" + className] = negate;
    M_ONE["_divide_"   + className] = negate;
    M_ONE["_expt_"     + className] = reciprocal;
}

DISP.EINative.valueOf = function() {
    return this._;
};

DISP.EINative.numberToString = function(radix, precision) {
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

DISP.EINative.debug = function() {
    return "EINative(" + this._ + ")";
};

DISP.EINative._toBigInteger = function() {
    return BigInteger(this._);
};

DISP.EINative.isPositive = function() {
    return this._ > 0;
};

DISP.EINative.isNegative = function() {
    return this._ < 0;
};

DISP.EINative.eq = function(z) {
    return toSN(z)._eq_EINative(this);
};
DISP.EINative._eq_EINative = function(n) {
    return n._ === this._;
};

DISP.EINative.ne = function(z) {
    return toSN(z)._ne_EINative(this);
};
DISP.EINative._ne_EINative = function(n) {
    return n._ !== this._;
};

DISP.EINative.compare = function(x) {
    return toReal(x)._compare_EINative(this);
};
DISP.EINative._compare_EINative = function(n) {
    return (n._ === this._ ? 0 : (n._ > this._ ? 1 : -1));
};

function add_EINative_EINative(a, b) {
    var ret = a + b;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger.add(a, b));
}

DISP.EINative.add = function(z) {
    return toSN(z)._add_EINative(this);
};
DISP.EINative._add_EINative = function(n) {
    return add_EINative_EINative(n._, this._);
};

DISP.EINative.negate = function() {
    return toEINative(-this._);
};

DISP.EINative.abs = function() {
    return (this._ < 0 ? toEINative(-this._) : this);
};

DISP.EINative.subtract = function(z) {
    return toSN(z)._subtract_EINative(this);
};
DISP.EINative._subtract_EINative = function(n) {
    return add_EINative_EINative(n._, -this._);
};

DISP.EINative.multiply = function(z) {
    return toSN(z)._multiply_EINative(this);
};
DISP.EINative._multiply_EINative = function(n) {
    var ret = n._ * this._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger(n._).multiply(this._));
};

DISP.EINative.square = function() {
    var ret = this._ * this._;
    if (ret < 9007199254740992)
        return toEINative(ret);
    return new EIBig(BigInteger(this._).square());
};

DISP.EINative.reciprocal = function() {
    var x = this._;
    /*
    if (x === 0)  // XXX Could remove this check, since ZERO overrides.
        throw divisionByExactZero();
    if (x === 1 || x === -1)  // Could remove this too, same reason.
        return this;
    */
    if (x < 0)
        return canonicalEQ(M_ONE, toEINative(-x));
    return canonicalEQ(ONE, this);
};

function divAndMod_EINative(t, x, which) {
    if (x === 0)
        throw divisionByExactZero();

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

DISP.EINative.div = function(x) {
    return toReal(x)._div_EINative(this);
};
DISP.EINative._div_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 0);
};

DISP.EINative.mod = function(x) {
    return toReal(x)._mod_EINative(this);
};
DISP.EINative._mod_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 1);
};

DISP.EINative.divAndMod = function(x) {
    return toReal(x)._divAndMod_EINative(this);
};
DISP.EINative._divAndMod_EINative = function(n) {
    return divAndMod_EINative(n._, this._, 2);
};

DISP.EINative._exp10 = function(n) {
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

DISP.EINative.exactIntegerSqrt = function() {
    if (this._ < 0)
        throw new RangeError("exactIntegerSqrt requires a positive argument");
    var n = Math.floor(Math.sqrt(this._));
    return [toEINative(n), toEINative(this._ - n * n)];
};

//
// EIBig: Exact integer as a BigInteger.
//

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

DISP.EIBig.numberToString = function(radix) {
    return this._.toString(radix);
};

["toJSValue", "isZero", "isEven", "isOdd", "sign", "isUnit",
 "isPositive", "isNegative"]
    .forEach(function(fn) {
            DISP.EIBig[fn] = function() {
                return this._[fn]();
            };
        });

DISP.EIBig.log = function() {
    var x = this._.abs().log();
    return this._.isPositive() ? x : makeRectangular(x, PI);
};

DISP.EIBig.valueOf = DISP.EIBig.toJSValue;

DISP.EIBig.debug = function() {
    return "EIBig(" + this._.toString() + ")";
};

DISP.EIBig._toBigInteger = function() {
    return this._;
};

DISP.EIBig.add = function(z) {
    return toSN(z)._add_EIBig(this);
};

DISP.EIBig.negate = function() {
    return new EIBig(this._.negate());
};

DISP.EIBig.abs = function() {
    return new EIBig(this._.abs());
};

DISP.EIBig.subtract = function(z) {
    return toSN(z)._subtract_EIBig(this);
};

DISP.EIBig.multiply = function(z) {
    return toSN(z)._multiply_EIBig(this);
};

DISP.EIBig.square = function() {
    return new EIBig(this._.square());
};

DISP.EIBig._compare_EI = function(n) {
    return n._.compare(this._);
};

DISP.EIBig._exp10 = function(n) {
    //assert(n === floor(n));
    if (n === 0)
        return this;
    if (n > 0)
        return new EIBig(this._.exp10(n));
    return reduceEQ(this, ONE._exp10(-n));
};

DISP.EIBig.sqrt = function() {
    return toFlonum(Math.exp(this._.log() / 2));
};

DISP.EIBig.exactIntegerSqrt = function() {

    // I know of no use cases for this.  Be stupid.  Be correct.

    //assert(this._.compareAbs(FIRST_BIG_INTEGER) >= 0);
    if (this._.isNegative())
        throw new RangeError("exactIntegerSqrt requires a positive argument");

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

    var l = this._.log() / 2 / Math.LN10;
    var a = BigInteger(Math.pow(10, l - Math.floor(l)).toString()
                       + "e" + Math.floor(l));
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
    //assert(!a.isNegative());
    //assert(!b.isNegative());
    //assert(a instanceof EIBig || a instanceof EINative);
    //assert(b instanceof EIBig || b instanceof EINative);
    if (a instanceof EIBig)
        return gcdBig(a._, b._toBigInteger());
    if (b instanceof EIBig)
        return gcdBig(numberToBigInteger(a._), b._);
    return gcdNative(a._, b._);
}

function showMethodClasses() {
    var map = {};
    for (var className in DISP)
        for (var methName in DISP[className])
            (map[methName] = map[methName] || {})[className] = DISP[className][methName];
    for (var methName in map)
        for (var className in map[methName])
            print(className + "." + methName + (map[methName][className] === pureVirtual ? " =0" : ""));
}
//showMethodClasses();

// Workarounds for Number/SN not inheriting from C and R.
for (var methodName in DISP.R) {
    if (!DISP.Flonum[methodName]) {
        DISP.Flonum[methodName] = DISP.R[methodName];
        if (!DISP.C[methodName])
            DISP.C[methodName] = undefined;
    }
}
for (var methodName in DISP.C) {
    if (!DISP.Flonum[methodName])
        DISP.Flonum[methodName] = DISP.C[methodName];
}

function resolveOverload() {
    for (var className in CLASSES) {
        //print(className);
        var proto = DISP[className];
        var newMethods = {};
        function resolve(subclasses, prefix, method) {
            if (!subclasses)
                return;
            function resolveSub(subclass) {
                if (proto[prefix + subclass])
                    return;
                //print(className + "." + prefix + subclass + " -> " + oldName);
                newMethods[prefix + subclass] = method;
                resolve(HIERARCHY[subclass], prefix, method);
            }
            subclasses.forEach(resolveSub);
        }
        for (var oldName in proto) {
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
        for (var methodName in proto) {
            CLASSES[className].prototype[methodName] = proto[methodName];
        }
    }
}
resolveOverload();

function checkPureVirtual() {
    for (var className in CLASSES) {
        if (!/[a-z]/.test(className)) {
            //print(className + " does not look like a concrete class.");
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

modifyString = function(string) {
    if (!string)
        string = String;
    var seen = {  // Don't override these built-in String methods.
        "toString": true,
        "valueOf": true
    };
    function doClass(cl) {
        if (!cl)
            return;
        function make(fname) {
            switch (cl.prototype[fname].length) {
            case 0: return function() {
                    return parseNumber(this)[fname]();
                };
            case 1: return function(a) {
                    return parseNumber(this)[fname](a);
                };
            case 2: return function(a, b) {
                    return parseNumber(this)[fname](a, b);
                };
            default:
                wow();
            }
        }
        for (var fname in cl.prototype) {
            if (fname[0] !== '_' && !seen[fname]) {
                seen[fname] = true;
                string.prototype[fname] = make(fname);
            }
        }
    }
    [SN, C, Rectangular, R, EQ, EQFraction, EI, EINative, EIBig]
    .forEach(doClass);
};

SN._ = {};
SN._.modifyString = modifyString;

return SN;

// Set this.SchemeNumber_is_Number = false if you do *not* want this
// library to add methods to Number.prototype and create
// String.prototype.toSchemeNumber.
// XXX This doesn't work yet, you must leave this.SchemeNumber_is_Number
// undefined or set it true.
})(this.SchemeNumber_is_Number);

if (typeof exports !== "undefined") {
    exports._ = SchemeNumber._;
    for (var name in SchemeNumber.fn)
        exports[name] = SchemeNumber.fn[name];
}
