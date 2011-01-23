// Incomplete, undocumented support for the Scheme numerical tower in
// JavaScript.

// Copyright (c) 2011 by John Tobey <John.Tobey@gmail.com>

// Grab the BigInteger library.
var BigInteger;
if (typeof require !== "undefined")
    BigInteger = require("biginteger").BigInteger;
else
    BigInteger = this.BigInteger;

if (typeof BigInteger === "undefined") {
    if (typeof load !== "undefined")
        load("biginteger.js");
    else if (this.readFile)
        eval(this.readFile("biginteger.js"));
    else
        throw new Error("BigInteger is not defined.");
}

var SchemeNumber;

(function() {

var DEBUG = true;

function retFalse() { return false; }
function retTrue()  { return true;  }
function retFalse1(x) { return false; }
function retTrue1(x)  { return true;  }
function retThis()  { return this; }

// SN: public interface, exported as SchemeNumber.
// Abstract base class of all numbers.

function SN(x) {
    if (!(this instanceof SN)) {
        if (arguments.length === 1)
            return toSN(x);
        throw new TypeError("Usage: SchemeNumber(x)");
    }
    if (arguments.length !== 0)
        throw new Error('Use "SchemeNumber(x)", not "new SchemeNumber(x)"');
}

function toSN(x) {
    if (x instanceof SN)
        return x;
    if (typeof x === "number")
        return toFlonum(x);
    if (x instanceof Number)
        return toFlonum(Number(x));
    return parseNumber(x);
}

function toReal(x) {
    x = toSN(x);
    if (x.isReal())
        return x;
    throw new TypeError("Not a real number: " + x);
}

function toInteger(n) {
    n = toSN(n);
    if (n.isInteger())
        return n;
    throw new TypeError("Not an integer: " + n);
}

function exactDivisionByZero() {
    return new RangeError("Exact division by zero");
}

SN.prototype = new Number();

// Override methods of Number, which won't work if inherited.

SN.prototype.toString = function(radix) {
    return "[generic SchemeNumber]";
};
SN.prototype.toLocaleString = function() {
    return this.toString();
};
SN.prototype.valueOf = function() {
    throw new RangeError("Not a real number");
};
SN.prototype.toFixed = function(fractionDigits) {
    return this.toString();
};
SN.prototype.toExponential = function(fractionDigits) {
    return this.toString();
};
SN.prototype.toPrecision = function(precision) {
    return this.toString();
};

// Default method implementations.

SN.prototype.isComplex  = retFalse;
SN.prototype.isReal     = retFalse;
SN.prototype.isRational = retFalse;
SN.prototype.isInteger  = retFalse;
SN.prototype.isFlonum   = retFalse;
SN.prototype.isFixnum   = retFalse;
SN.prototype.isExact    = retFalse;

SN.prototype.isInexact = function() {
    return !this.isExact();
};

SN.prototype.ne = function(z) {
    return !this.eq(z);
};

SN.prototype.square = function() {
    return this.multiply(this);
};

SN.prototype.divide = function(z) {
    return this.multiply(toSN(z).reciprocal());
};

if (DEBUG) SN.prototype.debug = function() { return "SchemeNumber"; };

SN.isComplex  = function(x) { return (x instanceof SN) && x.isComplex();  };
SN.isReal     = function(x) { return (x instanceof SN) && x.isReal();     };
SN.isRational = function(x) { return (x instanceof SN) && x.isRational(); };
SN.isInteger  = function(x) { return (x instanceof SN) && x.isInteger();  };
SN.isFlonum   = function(x) { return (x instanceof SN) && x.isFlonum();   };
SN.isFixnum   = function(x) { return (x instanceof SN) && x.isFixnum();   };

function makeRectangular(x, y) {
    if (x.isExact() !== y.isExact()) {
        x = x.toInexact();
        y = y.toInexact();
    }
    return toRectangular(x, y);
}

SN.makeRectangular = function(x, y) {
    if (arguments.length !== 2)
        throw new TypeError("Usage: makeRectangular(x, y)");
    return makeRectangular(toReal(x), toReal(y));
};

SN.makePolar = function(r, th) {
    return toRectangular(r.multiply(th.cos()), r.multiply(th.sin()));
};

SN.parse = parseNumber;

SN.exact = function(x) {
    if (arguments.length !== 1)
        throw new TypeError("Usage: SchemeNumber.exact(x)");
    if (x instanceof SN)
        return x.toExact();
    if (x instanceof Number)
        x = Number(x);
    if (typeof x === "number")
        return numberToER(x);
    return parseNumber(x, true);
};

function maxMin(cmp, a, arguments) {
    var len = arguments.length;
    if (len === 0)
        throw new TypeError("SchemeNumber.max needs at least one argument");

    var ret = toReal(a);
    var exact = ret.isExact();

    for (var i = 1; i < len; i++) {
        var x = toReal(arguments[i]);
        if (exact) {
            exact = x.isExact();
            if (!exact)
                ret = ret.toInexact();
        }
        if (x[cmp](ret))
            ret = x;
    }
    return exact ? ret : ret.toInexact();
}

SN.max = function(a) {
    return maxMin("gt", a, arguments);
};

SN.min = function(a) {
    return maxMin("lt", a, arguments);
};

SN.gcd = function() {
    var ret = ZERO;
    var len = arguments.length;
    var exact = true;
    for (var i = 0; i < len; i++) {
        var arg = toInteger(arguments[i]);
        exact = exact && arg.isExact();
        ret = gcd(ret, arg.abs());
    }
    return (exact ? ret : ret.toInexact());
};

SN.lcm = function() {
    var ret = ONE;
    var len = arguments.length;
    var exact = true;
    for (var i = 0; i < len; i++) {
        var arg = toInteger(arguments[i]);
        exact = exact && arg.isExact();
        ret = ret.multiply(arg).divide(gcd(ret, arg.abs()));
    }
    return (exact ? ret : ret.toInexact());
};

["add", "subtract", "multiply", "divide", "ne", "compare",
 "pow", "divAndMod", "div", "mod", "atan2", "expt"]
    .forEach(function(fn) {
            SN[fn] = function(a, b) { return toSN(a)[fn](b); };
        });

["eq", "gt", "lt", "ge", "le"]
    .forEach(function(fn) {
            SN[fn] = function(a, b) {
                var len = arguments.length;
                b = toReal(b);
                if (!toReal(a)[fn](b))
                    return false;
                for (var i = 2; i < len; i++) {
                    var c = toReal(arguments[i]);
                    if (!b[fn](c))
                        return false;
                    b = c;
                }
                return true;
            };
        });

["toJSValue", "reciprocal", "magnitude",
 "sqrt", "square", "isFinite", "isInfinite", "isNaN",
 "isZero", "isUnit", "isPositive", "isNegative", "negate", "abs",
 "toExact", "toInexact", "isExact",
 "floor", "ceiling", "truncate", "round",
 "realPart", "imagPart",
 "abs", "acos", "asin", "atan", "ceil", "cos", "exp", "floor", "log",
 "round", "sin", "sqrt", "tan", "numerator", "denominator",
 "isEven", "isOdd", "exactIntegerSqrt"]
    .forEach(function(fn) {
            SN[fn] = function(a) { return toSN(a)[fn](); };
        });

// C: Complex abstract base class.

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

// Scheme number syntaxes, e.g. #e1.1@-2d19, 2/3
function parseNumber(s, exact, radix) {
    var i = 0;

    function barf() {
        throw new SyntaxError("Invalid number: " + s);
    }
    function setExact(value) {
        if (exact !== undefined) barf();
        exact = value; i += 2;
    }
    function setRadix(value) {
        if (radix) barf();
        radix = value; i += 2;
    }
    function parseUinteger(s, sign) {
        if (!uintegerPattern[radix].test(s))
            barf();

        var n = parseInt(s, radix);

        if (exact === false)
            return toFlonum(sign * n);

        if (n < 9007199254740992)
            return toEI_Native(sign * n);

        return toEI_Big(BigInteger.parse(s, radix));
    }
    function parseReal(s) {
        if (nanInfPattern.test(s)) {
            if (exact)
                throw new RangeError("No exact representation for " + s);
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
            barf();

        // We have only one floating point width.
        s = s.replace(mantissaWidthPattern, '')
            .replace(exponentMarkerPattern, 'e');

        var dot = s.indexOf('.');
        var e = s.indexOf('e');
        if (dot === -1 && e === -1)
            return parseUinteger(s, sign);

        if (!decimal10Pattern.test(s))
            barf();

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
                return toRectangular(INEXACT_ZERO, toFlonum(1));
            return I;
        }

        var match = (radix === 10 ? decimalComplex : radixComplex).exec(s);
        if (!match)
            barf();

        return toRectangular(parseReal(match[1] || '0'),
                             parseReal(match[2] || '1'));
    }

    while (s[i] === "#") {
        switch (s[i+1]) {
        case 'i': case 'I': setExact(false); break;
        case 'e': case 'E': setExact(true ); break;
        case 'b': case 'B': setRadix( 2); break;
        case 'o': case 'O': setRadix( 8); break;
        case 'd': case 'D': setRadix(10); break;
        case 'x': case 'X': setRadix(16); break;
        default: barf();
        }
    }

    radix = radix || 10;
    return parseComplex(s.substring(i));
}

function C() {}

C.prototype = new SN();
C.prototype.isComplex = retTrue;

if (DEBUG) C.prototype.debug = function() { return "C"; };

if (this.WANT_COMPLEX_NUMBERS) {  // Incomplete.

// Rectangular: Complex numbers as xy-coordinate pairs.

function toRectangular(x, y) {
    if (y.isZero())
        return x;
    if (x.isZero() && x.isExact() && y.isUnit())
        return (y.isPositive() ? I : M_I);
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

Rectangular.prototype.toString = function(radix) {
    return xyToString(this._x.toString(radix), this._y.toString(radix));
};

if (DEBUG)
    Rectangular.prototype.debug = function() {
        return "Rectangular(" + this._x.debug() + ", " + this._y.debug() + ")";
    };

Rectangular.prototype.toFixed = function(dig) {
    return xyToString(this._x.toFixed(dig), this._y.toFixed(dig));
};
Rectangular.prototype.toExponential = function(dig) {
    return xyToString(this._x.toExponential(dig), this._y.toExponential(dig));
};
Rectangular.prototype.toPrecision = function(prec) {
    return xyToString(this._x.toPrecision(prec), this._y.toPrecision(prec));
};

Rectangular.prototype.realPart = function() { return this._x; };
Rectangular.prototype.imagPart = function() { return this._y; };

Rectangular.prototype.isExact = function() {
    return this._x.isExact() && this._y.isExact();
};

Rectangular.prototype.toInexact = function() {
    if (!this.isExact())
        return this;
    return toRectangular(this.realPart().toInexact(),
                         this.imagPart().toInexact());
};

Rectangular.prototype.toExact = function() {
    if (this.isExact())
        return this;
    return toRectangular(this._x.toExact(), this._y.toExact());
};

Rectangular.prototype._upgrade = function(z) {
    if (z.isReal())
        return new Rectangular(z, ZERO);
    throw new TypeError("Can't coerce to Rectangular: " + z);
}

Rectangular.prototype.isZero = retFalse;  // zero is Flonum or EI_Native.

function rectMagnitude2(z) {
    return z._x.square().add(z._y.square());
}

Rectangular.prototype.isUnit = function() {
    return rectMagnitude2(this).eq(ONE);
};

Rectangular.prototype.magnitude = function() {
    if (z._x.isZero())
        return z._y.abs();
    return rectMagnitude2(this).sqrt();
};

Rectangular.prototype.angle = function() {
    return this._y.atan2(this._x);
};

Rectangular.prototype.eq = function(z) {
    z = toSN(z);
    if (z === this)
        return true;
    if (!(z instanceof C))
        return z.eq(this);
    return (this._x.eq(z.realPart()) && this._y.eq(z.imagPart()));
};

Rectangular.prototype.add = function(z) {
    z = toSN(z);
    if (!(z instanceof C))
        return z.add(this);
    if (z.isZero() && (z.isExact() || !this.isExact()))
        return this;
    return toRectangular(this._x.add(z.realPart()),
                         this._y.add(z.imagPart()));
};

Rectangular.prototype.negate = function() {
    return toRectangular(this._x.negate(), this._y.negate());
};

Rectangular.prototype.subtract = function(z) {
    z = toSN(z);
    if (!(z instanceof C))
        return z._upgrade(this).subtract(z);
    if (z.isZero() && (z.isExact() || !this.isExact()))
        return this;
    return toRectangular(this._x.subtract(z.realPart()),
                         this._y.subtract(z.imagPart()));
};

Rectangular.prototype.multiply = function(z) {
    z = toSN(z);
    if (!(z instanceof C))
        return z._upgrade(this).multiply(z);
    if (z.isZero())
        return z;
    if (z.isReal() && z.isUnit() && (z.isExact() || !this.isExact()))
        return z.isPositive() ? this : this.negate();
    var zx = z.realPart();
    var zy = z.imagPart();
    return toRectangular(this._x.multiply(zx).subtract(this._y.multiply(zy)),
                         this._x.multiply(zy).add(this._y.multiply(zx)));
};

Rectangular.prototype.reciprocal = function() {
    var m2 = rectMagnitude2(this);
    return toRectangular(this._x.divide(m2), this._y.divide(m2).negate());
};

["sqrt", "exp", "log", "sin", "cos", "tan", "asin",
 "acos", "atan", "expt"]
    .forEach(function(fn) {
            Rectangular.prototype[fn] = function() {
                throw new Error("Unimplemented: " + fn + " for complex");
            };
        });

var I   = SN.I   = new Rectangular(ZERO, ONE);
var M_I = SN.M_I = new Rectangular(ZERO, M_ONE);
}

// R: Real abstract base class.

function R() {}

R.prototype = new C();
R.prototype.isReal = retTrue;

if (DEBUG) R.prototype.debug = function() { return "R"; };

R.prototype.realPart = retThis;
R.prototype.imagPart = function() { return ZERO; };

R.prototype.toFixed = function(dig) {
    return this.toJSValue().toFixed(dig);
};
R.prototype.toExponential = function(dig) {
    return this.toJSValue().toExponential(dig);
};
R.prototype.toPrecision = function(prec) {
    return this.toJSValue().toPrecision(prec);
};

// Method implementations appropriate for subclasses other than Flonum.

R.prototype.isNaN      = retFalse;
R.prototype.isFinite   = retTrue;
R.prototype.isInfinite = retFalse;

// Methods implemented using simpler operations.

R.prototype.valueOf = function() {
    return this.toJSValue();
};

R.prototype.isPositive = function() {
    return this.sign() > 0;
};
R.prototype.isNegative = function() {
    return this.sign() < 0;
};
R.prototype.isZero = function() {
    return this.sign() === 0;
};
R.prototype.sign = function() {
    return this.compare(ZERO);
};

R.prototype.magnitude = function() {
    return this.abs();
};

R.prototype.angle = function() {
    return this.isNegative() ? SN.PI : ZERO;
};

R.prototype.eq = function(z) {
    z = toSN(z);
    if (!z.isReal())
        return false;
    return this.compare(z) === 0;
};

R.prototype.gt = function(x) { return this.compare(toReal(x)) > 0; };
R.prototype.lt = function(x) { return this.compare(toReal(x)) < 0; };
R.prototype.ge = function(x) { return this.compare(toReal(x)) >= 0; };
R.prototype.le = function(x) { return this.compare(toReal(x)) <= 0; };

R.prototype.div = function(x) {
    //if (!this.divAndMod) alert("no divAndMod: " + this.debug());
    return this.divAndMod(x)[0];
};

R.prototype.mod = function(x) {
    return this.divAndMod(x)[1];
};

R.prototype.rationalize = function(delta) {
    throw new Error("Unimplemented broken-by-design function: rationalize");
};

function toFlonum(x) {
    if (x === 0)
        return INEXACT_ZERO;
    return new Flonum(x);
}

function Flonum(x) {
    this._ = x;
}

Flonum.prototype = new R();
Flonum.prototype.isFlonum = retTrue;

Flonum.prototype.toJSValue = function() {
    return this._;
};
Flonum.prototype.valueOf = Flonum.prototype.toJSValue;

// Flonum toString.  XXX I'd like to make this more like Scheme's
// number->string.
Flonum.prototype.toString = function(radix, precision) {
    if (!isFinite(this._)) {
        if (isNaN(this._))
            return("+nan.0");
        return (this._ > 0 ? "+inf.0" : "-inf.0");
    }
    radix = radix || 10;

    var s = new Number(this.toJSValue()).toString(radix);
    if (s.indexOf('.') === -1)
        s += ".";  // Force inexact.
    if (typeof precision !== "undefined")
        s += "|" + precision;  // XXX
    return s;
};

if (DEBUG)
    Flonum.prototype.debug = function() {
        return "Flonum(" + this._ + ")";
    };

Flonum.prototype.imagPart = function() {
    return INEXACT_ZERO;
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
    // multiplying by 2 until x === Math.floor(x).
    var s = x.toString(2);
    var i = s.indexOf(".");
    if (i == -1)
        return 1;
    return Math.pow(2, s.length - i - 1);
}

Flonum.prototype.denominator = function() {
    if (!this.isRational())
        throw new TypeError("Can't coerce to rational: " + this);
    return toFlonum(nativeDenominator(this._));
};

Flonum.prototype.numerator = function() {
    return toFlonum(this._ * nativeDenominator(this._));
};

Flonum.prototype.isInteger = function() {
    return this._ === Math.floor(this._);
};

Flonum.prototype.isFinite = function() {
    return isFinite(this._);
};
Flonum.prototype.isRational = Flonum.prototype.isFinite;

Flonum.prototype.isZero = function() {
    return this._ === 0;
};

Flonum.prototype.isPositive = function() {
    return this._ > 0;
};

Flonum.prototype.isNegative = function() {
    return this._ < 0;
};

Flonum.prototype.sign = function() {
    if (this._ === 0)
        return 0;
    return (this._ > 0 ? 1 : -1);
};

Flonum.prototype.isUnit = function() {
    return this._ === 1 || this._ === -1;
};

Flonum.prototype.isInfinite = function() {
    return !isFinite(this._) && !isNaN(this._);
};

Flonum.prototype.isNaN = function() {
    return isNaN(this._);
};

Flonum.prototype._upgrade = function(x) {
    if (!(x instanceof Flonum))
        throw new TypeError("Can't coerce to Flonum: " + x);
    return toFlonum(x._);
};

Flonum.prototype.toExact = function() {
    if (!isFinite(this._))
        throw new RangeError("No exact representation for " + this);
    return numberToER(this._);
};

Flonum.prototype.toInexact = retThis;

Flonum.prototype.add = function(z) {
    if (typeof z === "number")
        return toFlonum(this._ + z);
    z = toSN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ + z._);
    return z.add(this);
};

Flonum.prototype.negate = function() {
    return toFlonum(-this._);
};

Flonum.prototype.abs = function() {
    return (this._ < 0 ? toFlonum(-this._) : this);
};

Flonum.prototype.subtract = function(z) {
    if (typeof z === "number")
        return toFlonum(this._ - z);
    z = toSN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ - z._);
    return z._upgrade(this).subtract(z);
};

Flonum.prototype.multiply = function(z) {
    if (typeof z === "number")
        return toFlonum(this._ * z);
    z = toSN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ * z._);
    return z.multiply(this);
};

Flonum.prototype.reciprocal = function() {
    return toFlonum(1 / this._);
};

Flonum.prototype.divide = function(z) {
    if (typeof z === "number")
        return toFlonum(this._ / z);
    z = toSN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ / z._);
    return z._upgrade(this).divide(z);
};

Flonum.prototype.divAndMod = function(x) {
    if (typeof x !== "number")
        x = toReal(x).toJSValue();
    if (x === 0)
        throw new RangeError("div/mod by zero");

    var t = this._;
    var div = Math.floor(t / x);
    return [div, t - (x * div)];
};

Flonum.prototype.square = function() {
    return toFlonum(this._ * this._);
};

Flonum.prototype.eq = function(z) {
    if (typeof z === "number")
        return this._ === z;
    z = toSN(z);
    if (z instanceof Flonum)
        return this._ === z._;
    return z.eq(this);
};

Flonum.prototype.gt = function(x) {
    if (typeof x === "number")
        return this._ > x;
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ > x._;
    return x.lt(this);
};

Flonum.prototype.lt = function(x) {
    if (typeof x === "number")
        return this._ < x;
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ < x._;
    return x.gt(this);
};

Flonum.prototype.ge = function(x) {
    if (typeof x === "number")
        return this._ >= x;
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ >= x._;
    return x.le(this);
};

Flonum.prototype.le = function(x) {
    if (typeof x === "number")
        return this._ <= x;
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ <= x._;
    return x.ge(this);
};

Flonum.prototype.ne = function(z) {
    if (typeof x === "number")
        return this._ !== z;
    z = toSN(z);
    if (z instanceof Flonum)
        return this._ !== z._;
    return z.ne(this);
};

Flonum.prototype.compare = function(x) {
    if (x instanceof Flonum)
        x = x._;
    if (typeof x === "number") {
        var t = this._;
        if (t === x) return 0;
        if (t  <  x) return -1;
        if (t  >  x) return 1;
        return NaN;
    }
    return -toReal(x).compare(this);
};

Flonum.prototype.isEven = function() {
    return (this._ & 1) === 0;
};

Flonum.prototype.isOdd = function() {
    return (this._ & 1) === 1;
};

function round(x) {
    return (x < 0 ? -Math.round(-x) : Math.round(x));
}

function truncate(x) {
    return (x < 0 ? Math.ceil(x) : Math.floor(x));
};

Flonum.prototype.round = function() {
    return toFlonum(round(this._));
};

Flonum.prototype.truncate = function() {
    return toFlonum(truncate(this._));
};

Flonum.prototype.ceiling = function() {
    return toFlonum(Math.ceil(this._));
};

['abs', 'acos', 'asin', 'atan', 'cos', 'exp', 'floor', 'log',
 'sin', 'sqrt', 'tan']
    .forEach(function(fn) {
            var mathFn = Math[fn];
            Flonum.prototype[fn] = function() {
                return toFlonum(mathFn(this._));
            };
        });

Flonum.prototype.atan2 = function(x) {
    return toFlonum(Math.atan2(this._, toReal(x).toJSValue()));
};

Flonum.prototype.expt = function(z) {
    if (typeof z !== "number")
        z = toSN(z).toJSValue();
    return toFlonum(Math.pow(this._, z));
};

['E', 'LN10', 'LN2', 'LOG2E', 'LOG10E', 'PI', 'SQRT1_2', 'SQRT2']
    .forEach(function(name) {
            SN[name] = new Flonum(Math[name]);
        });

var INEXACT_ZERO                   = new Flonum(0);
var INFINITY     = SN.INFINITY     = new Flonum(Infinity);
var M_INFINITY   = SN.M_INFINITY   = new Flonum(-Infinity);
var NAN          = SN.NAN          = new Flonum(NaN);

// ER_Native: Exact rational represented as a native number.

function ER_Native(x) {
    this._ = x;
}

ER_Native.prototype = new Flonum(0);
ER_Native.prototype.isExact = retTrue;
ER_Native.prototype.isRational = retTrue;
ER_Native.prototype.isFlonum = retFalse;

function exactNativeToString(n) {
    if (n > -9007199254740992 && n < 9007199254740992)
        return n.toString();
    return numberToBigInteger(n).toString();
}

ER_Native.prototype.toString = function(radix) {
    if (typeof radix !== "undefined" && radix !== 10)
        throw new Error("Unimplemented: toString radix");
    var d = nativeDenominator(this._);
    return exactNativeToString(this._ * d) + "/" + exactNativeToString(d);
};

if (DEBUG)
    ER_Native.prototype.debug = function() {
        return "ER_Native(" + this._ + ")";
    };

ER_Native.prototype.toExact = retThis;

ER_Native.prototype.toInexact = function() {
    return toFlonum(this._);
};

ER_Native.prototype.denominator = function() {
    return numberToEI(nativeDenominator(this._));
};

ER_Native.prototype.numerator = function() {
    return numberToEI(this._ * nativeDenominator(this._));
};

ER_Native.prototype.add = function(z) {
    z = toSN(z);
    if (!(z instanceof ER_Native))
        return z.add(this);
    if (z._ === 0)
        return this;
    return upgradeER(this).add(z);
};

ER_Native.prototype.negate = function() {
    return new ER_Native(-this._);
};

ER_Native.prototype.abs = function() {
    return (this._ < 0 ? new ER_Native(-this._) : this);
};

ER_Native.prototype.subtract = function(z) {
    z = toSN(z);
    if (!(z instanceof ER_Native))
        return z._upgrade(this).subtract(z);
    if (z._ === 0)
        return this;
    return upgradeER(this).subtract(z);
};

ER_Native.prototype.multiply = function(z) {
    z = toSN(z);
    if (!(z instanceof ER_Native))
        return z.multiply(this);
    if (z._ === 0)
        return ZERO;
    if (z._ === 1)
        return this;
    if (z._ === -1)
        return new ER_Native(-this._);
    return upgradeER(this).multiply(z);
};

ER_Native.prototype.reciprocal = function() {
    return upgradeER(this).reciprocal();
};

ER_Native.prototype.divide = function(z) {
    z = toSN(z);
    if (!(z instanceof ER_Native))
        return z._upgrade(this).divide(z);
    if (z._ === 0)
        throw exactDivisionByZero();
    if (z._ === 1)
        return this;
    if (z._ === -1)
        return new ER_Native(-this._);
    return upgradeER(this).divide(z);
};

ER_Native.prototype.divAndMod = function(x) {
    return upgradeER(this).divAndMod(x);
};

ER_Native.prototype.floor = function() {
    return numberToEI(Math.floor(this._));
};

ER_Native.prototype.ceiling = function() {
    return numberToEI(Math.ceil(this._));
};

ER_Native.prototype.round = function() {
    return numberToEI(round(this._));
};

ER_Native.prototype.truncate = function() {
    return numberToEI(truncate(this._));
};

// EI_Native: Exact integers as native numbers.

function toEI_Native(x) {
    switch (x) {
    case -1: return M_ONE;
    case 0: return ZERO;
    case 1: return ONE;
    case 2: return TWO;
    default: return new EI_Native(x);
    }
}

function EI_Native(x) {
    this._ = x;
}

EI_Native.prototype = new ER_Native(0);
EI_Native.prototype.isInteger = retTrue;
EI_Native.prototype.isFixnum = retTrue;

EI_Native.prototype.toString = function(radix) {
    return this._.toString(radix || 10);
};

if (DEBUG)
    EI_Native.prototype.debug = function() {
        return "EI_Native(" + this._ + ")";
    };

EI_Native.prototype.add = function(z) {
    z = toSN(z);
    if (!(z instanceof EI_Native))
        return z.add(this);
    var ret = this._ + z._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEI_Native(ret);
    return toEI_Big(this._).add(z);
};

EI_Native.prototype.negate = function() {
    return toEI_Native(-this._);
};

EI_Native.prototype.abs = function() {
    return (this._ < 0 ? toEI_Native(-this._) : this);
};

EI_Native.prototype.subtract = function(z) {
    z = toSN(z);
    if (!(z instanceof EI_Native)) {
        return z._upgrade(this).subtract(z);
    }
    var ret = this._ - z._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEI_Native(ret);
    return toEI_Big(this._).subtract(z);
};

EI_Native.prototype.multiply = function(z) {
    z = toSN(z);
    if (!(z instanceof EI_Native))
        return z.multiply(this);
    var ret = this._ * z._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEI_Native(ret);
    return toEI_Big(this._).multiply(z);
};

EI_Native.prototype.reciprocal = function() {
    var x = this._;
    if (x === 0)
        throw exactDivisionByZero();
    if (x === 1 || x === -1)
        return this;
    if (x < 0)
        return canonicalER(M_ONE, toEI_Native(-x));
    return canonicalER(ONE, this);
};

EI_Native.prototype.divide = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().divide(z);
    if (!z.isInteger())
        return z._upgrade(this).divide(z);
    return reduceER(this, z);
};

function divAndModEI_Native(t, x, which) {
    if (x === 0)
        throw exactDivisionByZero();

    var div = Math.floor(t / x);
    if (which === 0)
        return toEI_Native(div);

    var tmp = x * div;
    var mod;

    if (tmp > -9007199254740992)
        mod = t - tmp;
    // Oooh, I'd like a nice test suite for this.
    else if (div > 0)
        mod = (t - x) - (x * (div - 1));
    else
        mod = (t + x) - (x * (div + 1));
    mod = toEI_Native(mod);

    if (which === 1)
        return mod;
    return [toEI_Native(div), mod];
};

EI_Native.prototype.div = function(x) {
    x = toReal(x);
    if (!(x instanceof EI_Native))
        return x._upgrade(this).div(x);
    return divAndModEI_Native(this._, x._, 0);
};

EI_Native.prototype.mod = function(x) {
    x = toReal(x);
    if (!(x instanceof EI_Native))
        return x._upgrade(this).mod(x);
    return divAndModEI_Native(this._, x._, 1);
};

EI_Native.prototype.divAndMod = function(x) {
    x = toReal(x);
    if (!(x instanceof EI_Native))
        return x._upgrade(this).divAndMod(x);
    return divAndModEI_Native(this._, x._, 2);
};

EI_Native.prototype.floor    = retThis;
EI_Native.prototype.ceiling  = retThis;
EI_Native.prototype.round    = retThis;
EI_Native.prototype.truncate = retThis;

EI_Native.prototype._exp10 = function(n) {
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
            num = toEI_Native(Number(num.substring(0, i + 1)));
            if (n === 0)
                return num
        }
        else {
            num = this;
        }

        var den;
        if (n < -15)
            den = toEI_Big(BigInteger.ONE.exp10(-n));
        else
            den = toEI_Native(Number("1000000000000000".substring(0, 1 - n)));
        return reduceER(num, den);
    }
    if (n < 16) {
        var result = parseInt("1000000000000000".substring(0, n + 1)) * this._;
        if (result > -9007199254740992 && result < 9007199254740992)
            return toEI_Native(result);
    }
    return toEI_Big(this._)._exp10(n);
};

var MAX_LOG = 1e8 * Math.log(10);  // 100 million digits.

SN.getMaxIntDigits = function() {
    return MAX_LOG / Math.log(10);
};
SN.setMaxIntDigits = function(max) {
    MAX_LOG = max * Math.log(10);
};

function positiveIntegerExpt(b, p) {
    //assert(p > 0); assert(p == Math.round(p));
    print("positiveIntegerExpt(" + b + "," + p + ")");
    var result = Math.pow(b, p);
    if (result > -9007199254740992 && result < 9007199254740992)
        return toEI_Native(result);
    if (Math.log(b) * p > MAX_LOG)
        throw new Error("expt: integer exceeds limit of " +
                        (MAX_LOG / Math.log(10)) + " digits; adjust with " +
                        "SchemeNumber.setMaxIntDigits(...)");
    return new EI_Big(BigInteger(b).pow(p));
}

EI_Native.prototype.expt = function(p) {
    p = toSN(p);

    if (!p.isReal())
        return p._upgrade(this).expt(p);

    if (!p.isExact())
        return toFlonum(Math.pow(this._, p.toJSValue()));

    if (p.isZero())
        return ONE;

    if (this._ === 1)
        return this;

    if (this._ === 0) {
        if (p.isPositive())
            return this;
        if (p.isZero())
            return ONE;
        throw exactDivisionByZero();
    }

    if (this._ === -1 && p.isInteger())
        return p.isEven() ? ONE : this;

    if (p.isInteger()) {
        var s = p.sign();
        // Any inexactness is beyond the range that will fit in
        // memory, we hope.
        var a = positiveIntegerExpt(this._, p.abs().toJSValue());
        return (s > 0 ? a : a.reciprocal());
    }

    if (this._ > 0)
        return toFlonum(Math.pow(this._, p.toJSValue()));

    return new Rectangular(this, ZERO).expt(p);
};

EI_Native.prototype.exactIntegerSqrt = function() {
    var n = Math.floor(Math.sqrt(this._));
    return [toEI_Native(n), toEI_Native(this._ - n * n)];
};

var ZERO  = SN.ZERO  = new EI_Native(0);
var ONE   = SN.ONE   = new EI_Native(1);
var M_ONE = SN.M_ONE = new EI_Native(-1);
var TWO   = SN.TWO   = new EI_Native(2);

// ER: Exact rational abstract base class.

function numberToER(x) {
    if (x === Math.floor(x))
        return numberToEI(x);
    return new ER_Native(x);
}

function ER() {}

ER.prototype = new R();
ER.prototype.isRational = retTrue;
ER.prototype.isExact = retTrue;

if (DEBUG) ER.prototype.debug = function() { return "ER"; };

ER.prototype.toExact = retThis;

ER.prototype.toInexact = function() {
    return toFlonum(this.toJSValue());
};

ER.prototype.divAndMod = function(x) {
    x = toReal(x);
    if (!x.isExact())
        return this.toInexact().divAndMod(x);
    if (!x.isRational())
        return x._upgrade(this).divAndMod(x);
    var q = this.divide(x);
    var div = q.floor();
    return [div, q.subtract(div)];
};

function gcdNative(a, b) {
    //assert(a >= 0 && b >= 0)
    var c;
    while (a !== 0) {
        c = a;
        a = b % a;
        b = c;
    }
    return toEI_Native(b);
}

function gcdBig(a, b) {
    var c;
    while (!a.isZero()) {
        c = a;
        a = b.remainder(a);
        b = c;
    }
    return reduceEI_Big(b);
}

function numberToBigInteger(n) {
    return BigInteger.parse(n.toString(16), 16);
}

function toBigInteger(n) {
    return (n instanceof EI_Big ? n._ : numberToBigInteger(n._));
}

// a and b must be nonnegative, either EI_Big or EI_Native.
function gcd(a, b) {
    if (a instanceof EI_Big)
        return gcdBig(a._, toBigInteger(b));
    if (b instanceof EI_Big)
        return gcdBig(numberToBigInteger(a._), b._);
    return gcdNative(a._, b._);
}

function reduceER(n, d) {
    if (d.isZero())
        throw exactDivisionByZero();

    var g = gcd(n.abs(), d.abs());

    n = n.div(g);
    d = d.div(g);

    if (d.isNegative())
        return canonicalER(n.negate(), d.negate());
    return canonicalER(n, d);
}

function canonicalER(n, d) {
    if (d.isUnit())
        return n;
    return new ER_General(n, d);
}

function upgradeER(x) {
    return new ER_General(x.numerator(), x.denominator());
}

// ER_General: Exact rational as two exact integers in lowest terms,
// positive denominator.

function ER_General(n, d) {
    this._n = n;
    this._d = d;
}

ER_General.prototype = new ER();

ER_General.prototype.toString = function() {
    return this._n.toString() + "/" + this._d.toString();
};

ER_General.prototype.toJSValue = function() {
    var n = this._n;
    var d = this._d;
    if (n.isZero())
        return ZERO;
    if (!n.toJSValue)
        alert("No toJSValue: " + this.debug());
    var ret = n.toJSValue() / d.toJSValue();
    if (!isNaN(ret))
        return ret;
    var s = 1;
    if (n.isNegative()) {
        s = -1;
        n = n.negate();
    }
    return s * Math.exp(n.log() - d.log());
};

if (DEBUG)
    ER_General.prototype.debug = function() {
        return "ER_General(" + this._n.debug() + " / " + this._d.debug() + ")";
    };

ER_General.prototype.numerator = function () {
    return this._n;
};

ER_General.prototype.denominator = function() {
    return this._d;
};

ER_General.prototype._upgrade = upgradeER;

ER_General.prototype.add = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().add(z);
    if (!z.isRational())
        return z._upgrade(this).add(z);
    var n = z.numerator();
    var d = z.denominator();
    return reduceER(this._n.multiply(d).add(this._d.multiply(n)),
                    this._d.multiply(d));
};

ER_General.prototype.negate = function() {
    return new ER_General(this._n.negate(), this._d);
};

ER_General.prototype.isZero = function() {
    return this._n.isZero();
};

ER_General.prototype.isPositive = function() {
    return this._n.isPositive();
};

ER_General.prototype.isNegative = function() {
    return this._n.isNegative();
};

ER_General.prototype.subtract = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().subtract(z);
    if (!z.isRational())
        return z._upgrade(this).subtract(z);
    var n = z.numerator();
    var d = z.denominator();
    return reduceER(this._n.multiply(d).subtract(this._d.multiply(n)),
                    this._d.multiply(d));
};

ER_General.prototype.multiply = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().multiply(z);
    if (!z.isRational())
        return z._upgrade(this).multiply(z);
    return reduceER(this._n.multiply(z.numerator()),
                    this._d.multiply(z.denominator()));
};

ER_General.prototype.reciprocal = function() {
    if (this._n.isNegative())
        return canonicalER(this._d.negate(), this._n.negate());
    return canonicalER(this._d, this._n);
};

ER_General.prototype.divide = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().divide(z);
    if (!z.isRational())
        return z._upgrade(this).divide(z);
    return reduceER(this._n.multiply(z.denominator()),
                    this._d.multiply(z.numerator()));
};

ER_General.prototype.floor = function() {
    return this._n.div(this._d);
};

ER_General.prototype.ceiling = function() {
    return this._d.isUnit() ? this._n : this._n.div(this._d).add(ONE);
};

ER_General.prototype.round = function() {
    if (this._d.eq(TWO)) {
        var ret = this._n.div(this._d);
        return ret.isEven() ? ret : ret.add(ONE);
    }
    var dm = this._n.divAndMod(this._d);
    var mod = dm[1];
    if (mod.add(mod).lt(this._d))
        return dm[0];
    return dm[0].add(ONE);
};

ER_General.prototype.truncate = function() {
    if (this._n.isPositive())
        return this._n.div(this._d);
    return this._d.isUnit() ? this._n : this._n.div(this._d).add(ONE);
};

ER_General.prototype.sign = function() {
    return this._n.sign();
};

ER_General.prototype.abs = function() {
    if (this._n.sign() >= 0)
        return this;
    return this.negate();
};

ER_General.prototype.compare = function(x) {
    x = toReal(x);
    var s = x.sign();
    var this_s = this._n.sign();
    if (s === 0)
        return this_s;
    if (s !== this_s)
        return -s;
    if (x instanceof Flonum)
        return this._n.compare(this._d.multiply(x));
    if (!x.isRational())
        return -x.compare(this);
    return this._n.multiply(x.denominator())
        .compare(this._d.multiply(x.numerator()));
};

ER_General.prototype.eq = function(z) {
    if (z === this)
        return true;
    z = toSN(z);
    return (z.isRational() &&
            this._n.eq(z.numerator()) &&
            this._d.eq(z.denominator()));
};

ER_General.prototype.ne = function(z) {
    if (z === this)
        return false;
    z = toSN(z);
    return (!z.isRational() ||
            this._n.ne(z.numerator()) &&
            this._d.ne(z.denominator()));
};

// EI: Exact integer abstract base class.

function numberToEI(n) {
    if (n < 9007199254740992 && n > -9007199254740992)
        return toEI_Native(n);
    return new EI_Big(numberToBigInteger(n));
}

function parseEI(s) {
    var len = s.length;
    if (len < 16)
        return toEI_Native(Number(s));
    var firstNonzero = 0;
    if (s[0] == '-')
        firstNonzero++;
    while (s[firstNonzero] == '0')
        firstNonzero++;
    len = len - firstNonzero;
    if (len < 16 ||
        (len === 16 && s.substring(firstNonzero) < "9007199254740992"))
        return toEI_Native(Number(s));
    return parseEI_Big(s);
}

function EI() {}

EI.prototype = new ER();
EI.prototype.isInteger = retTrue;

if (DEBUG) EI.prototype.debug = function() { return "EI"; };

EI.prototype.numerator = retThis;
EI.prototype.denominator = function() { return ONE; };
EI.prototype.floor    = retThis;
EI.prototype.ceiling  = retThis;
EI.prototype.round    = retThis;
EI.prototype.truncate = retThis;

EI.prototype.reciprocal = function() {
    if (this.isNegative())
        return canonicalER(M_ONE, this.negate());
    return canonicalER(ONE, this);
};

EI.prototype.divide = EI_Native.prototype.divide;

// EI_Big: Exact integer as a BigInteger.

var FIRST_BIG_INTEGER = BigInteger(9007199254740992);

function toEI_Big(n) {
    return new EI_Big(BigInteger(n));
}

function reduceEI_Big(n) {
    if (n.compareAbs(FIRST_BIG_INTEGER) >= 0)
        return new EI_Big(n);
    return toEI_Native(n.toJSValue());
}

function EI_Big(n) {
    this._ = n;
}

function parseEI_Big(s) {
    return new EI_Big(BigInteger.parse(s));
}

EI_Big.prototype = new EI();

["toString", "toJSValue", "isZero", "isEven", "isOdd", "sign", "isUnit"]
    .forEach(function(fn) {
            EI_Big.prototype[fn] = function() {
                return this._[fn]();
            };
        });

EI_Big.prototype.valueOf = EI_Big.prototype.toJSValue;

if (DEBUG)
    EI_Big.prototype.debug = function() {
        return "EI_Big(" + this._ + ")";
    };

EI_Big.prototype._upgrade = function(z) {
    return new EI_Big(toBigInteger(z));
};

EI_Big.prototype.add = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().add(z);
    if (z.isZero())
        return this;
    if (z instanceof EI_Big || z instanceof EI_Native)
        return reduceEI_Big(this._.add(z._));
    if (z instanceof ER_Native)
        return upgradeER(z).add(this);
    return z.add(this);
};

EI_Big.prototype.negate = function() {
    return new EI_Big(this._.negate());
};

EI_Big.prototype.abs = function() {
    return new EI_Big(this._.abs());
};

EI_Big.prototype.subtract = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().subtract(z);
    if (z.isZero())
        return this;
    if (z instanceof EI_Big || z instanceof EI_Native)
        return reduceEI_Big(this._.subtract(z._));
    if (z instanceof ER_Native)
        z = upgradeER(z);
    return z._upgrade(this).subtract(z);
};

EI_Big.prototype.multiply = function(z) {
    z = toSN(z);
    if (!z.isExact())
        return this.toInexact().multiply(z);
    if (z.isZero())
        return z;
    if (z.eq(ONE))
        return this;
    if (z instanceof EI_Big || z instanceof EI_Native)
        return new EI_Big(this._.multiply(z._));
    if (z instanceof ER_Native)
        return upgradeER(z).multiply(this);
    return z.multiply(this);
};

EI_Big.prototype.divAndMod = function(z) {
    z = toSN(z);
    if (!z.isInteger())
        return z._upgrade(this).divAndMod(z);

    z = toBigInteger(z);
    var dm = this._.divRem(z);
    var div = dm[0];
    var mod = dm[1];

    if (mod.isNegative()) {
        mod = mod.add(z);
        div = div.prev();
    }
    return [reduceEI_Big(div), reduceEI_Big(mod)]
};

EI_Big.prototype.compare = function(x) {
    x = toReal(x);
    if (x instanceof EI_Big)
        return this._.compare(x._);
    if (!(x instanceof Flonum))
        return -x.compare(this);

    var bi = this._;
    var s = bi.sign();
    if (s === 0)
        return -x.compare(ZERO);
    if ((s === 1) !== (x._ > 0))
        return s;

    var n = Math.floor(x._);
    switch (bi.compareAbs(n)) {
    case -1: return -s;
    case 1: return s;
    default: return (x._ === n ? 0 : -s);
    }
};

EI_Big.prototype.log = function(base) {
    if (typeof base !== "undefined")
        throw new Error("Unimplemented: 2-arg log for big integer");
    return toFlonum(this._.log());
};

EI_Big.prototype.expt = function(z) {
    z = SN(z);
    if (!z.isReal())
        return z._upgrade(this).expt(z);
    if (!z.isExact() || !z.isInteger())
        return toFlonum(Math.pow(this._.toJSValue(), z.toJSValue()));
    if (z.isZero())
        return ONE;
    if (z.isUnit() && z.isPositive())
        return this;
    var a = new EI_Big(this._.pow(toBigInteger(z.abs())));
    return z.isPositive() ? a : a.reciprocal();
};

EI_Big.prototype._exp10 = function(n) {
    return toEI_Big(this._.exp10(n));
};

["sqrt", "exactIntegerSqrt", "exp", "sin", "cos", "tan", "asin",
 "acos", "atan", "atan2"]
    .forEach(function(fn) {
            EI_Big.prototype[fn] = function() {
                throw new Error("Unimplemented: " + fn + " for big integer");
            };
        });

SN.enhanceNumber = function(number) {
    if (!number)
        number = Number;
    var seen = { "toString": true, "valueOf": true };
    function doClass(cl) {
        function make(fname) {
            switch (cl.prototype[fname].length) {
            case 0: return function() {
                    return toFlonum(Number(this))[fname]();
                };
            case 1: return function(a) {
                    return toFlonum(Number(this))[fname](a);
                };
            case 2: return function(a, b) {
                    return toFlonum(Number(this))[fname](a, b);
                };
            default:
                wow();
            }
        }
        for (var fname in cl.prototype) {
            if (fname[0] !== '_' && !seen[fname]) {
                seen[fname] = true;
                number.prototype[fname] = make(fname);
            }
        }
    }
    [SN, C, R, Flonum].forEach(doClass);
};

SN.enhanceString = function(string) {
    if (!string)
        string = String;
    var seen = { "toString": true, "valueOf": true };
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
    [SN, C, Rectangular, R, Flonum, ER_Native, EI_Native,
     ER, ER_General, EI, EI_Big]
    .forEach(doClass);
};

SN._ = function() {
    SN.enhanceNumber();
    SN.enhanceString();
}

SchemeNumber = SN;
if (typeof exports !== "undefined") {
    exports.SchemeNumber = SN;
    exports._ = SN._;
}
})();
