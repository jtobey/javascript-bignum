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

function retFalse() { return false; }
function retTrue()  { return true;  }
function retFalse1(x) { return false; }
function retTrue1(x)  { return true;  }
function retThis(x) { return this; }

var integerRegex = /^[-+]?[0-9]+$/;

function toSchemeNumber(x) {
    if (x instanceof SN)
        return x;
    if (typeof x === "number")
        return toFlonum(x);
    if (x instanceof Number)
        return toFlonum(Number(x));
    return parseComplex(x);
}

function SN(x) {
    if (!(this instanceof SN)) {
        if (arguments.length === 1)
            return toSchemeNumber(x);
        throw new TypeError("Usage: SchemeNumber(x)");
    }
    if (arguments.length !== 0)
        throw new Error('Use "SchemeNumber(x)", not "new SchemeNumber(x)"');
}

SN.prototype = new Number();
SN.prototype.isComplex  = retFalse;
SN.prototype.isReal     = retFalse;
SN.prototype.isRational = retFalse;
SN.prototype.isInteger  = retFalse;
SN.prototype.isExact    = retFalse;
SN.prototype.isFlonum   = retFalse;
SN.prototype.isFixnum   = retFalse;

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

SN.prototype.toExact = function() {
    throw new RangeError("No exact representation for " + this);
};

SN.prototype.toInexact = function() {
    throw new RangeError("No inexact representation for " + this);
};

SN.prototype.eq = retFalse1;

SN.prototype.ne = function(z) {
    return !this.eq(z);
};

SN.prototype.square = function() {
    return this.multiply(this);
};

SN.isComplex  = function(x) { return (x instanceof SN) && x.isComplex();  };
SN.isReal     = function(x) { return (x instanceof SN) && x.isReal();     };
SN.isRational = function(x) { return (x instanceof SN) && x.isRational(); };
SN.isInteger  = function(x) { return (x instanceof SN) && x.isInteger();  };
SN.isFlonum   = function(x) { return (x instanceof SN) && x.isFlonum();   };
SN.isFixnum   = function(x) { return (x instanceof SN) && x.isFixnum();   };

SN.makeRectangular = function(x, y) {
    if (arguments.length !== 2)
        throw new TypeError("Usage: makeRectangular(x, y)");
    return toRectangular(toReal(x), toReal(y));
};

SN.parse = parseComplex;

SN.exact = function(x) {
    if (arguments.length !== 1)
        throw new TypeError("Usage: SchemeNumber.exact(x)");
    if (x instanceof Number)
        x = Number(x);
    if (typeof x === "number")
        return numberToER(x);
    return toSchemeNumber(x).toExact(); // XXX
}

function parseComplex(s) {
    // XXX should support Scheme number syntaxes, e.g. #e1.1@2, 2/3
    if (s[s.length - 1] !== "i")
        return parseReal(s);
    var match = /(.*[0-9.])([-+].*)i/.exec(s);
    if (match)
        return toRectangular(parseReal(match[1]),
                             match[2] ? parseReal(match[2]) : ONE);
    throw new SyntaxError("Invalid number: " + s);
}

function C() {}

C.prototype = new SN();
C.prototype.isComplex = retTrue;

if (!this.NO_COMPLEX_NUMBERS) {

// Rectangular: Complex numbers as xy-coordinate pairs.

function toRectangular(x, y) {
    if (y.isZero())
        return x;
    if (x.isZero() && y.isUnit())
        return (y.isPositive() ? I : M_I);
    return new Rectangular(x, y);
}

function Rectangular(x, y) {
    this._x = x;
    this._y = y;
}

Rectangular.prototype = new C();

Rectangular.prototype.toString = function() {
    var y = this._y;
    if (y.isNegative())
        return this._x.toString() + y.toString() + "i";
    return this._x.toString() + "+" + y.toString() + "i";
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

Rectangular.prototype.upgrade = function(z) {
    if (z.isReal())
        return new Rectangular(z, ZERO);
    throw new TypeError("Can't coerce to Rectangular: " + z);
}

Rectangular.prototype.isZero = retFalse;

function rectMagnitude(z) {
    if (z._x.isZero())
        return z._y.abs();
    return z._x.square().add(z._y.square()).sqrt();
}

Rectangular.prototype.isUnit = function() {
    return rectMagnitude(this).eq(ONE);
};

Rectangular.prototype.magnitude = function() {
    return rectMagnitude(this);
};

Rectangular.prototype.eq = function(z) {
    z = SN(z);
    if (z === this)
        return true;
    if (!(z instanceof C))
        return z.eq(this);
    return (this._x.eq(z.realPart()) && this._y.eq(z.imagPart()));
};

Rectangular.prototype.add = function(z) {
    z = SN(z);
    if (!(z instanceof C))
        return z.add(this);
    if (z.isZero() && (z.isExact() || !this.isExact()))
        return this;
    return toRectangular(this._x.add(z.realPart()),
                         this._y.add(z.imagPart()));
};

var I   = SN.I   = new Rectangular(ZERO, ONE);
var M_I = SN.M_I = new Rectangular(ZERO, M_ONE);
}

function toReal(x) {
    if (x instanceof R)
        return x;
    if (typeof x === "number")
        return toFlonum(x);
    if (x instanceof Number)
        return toFlonum(Number(x));
    return parseReal(x);
}

function parseReal(s) {
    if (integerRegex.test(s))
        return parseEI(s);
    return toFlonum(parseFloat(s));   // XXX
}

function R() {}

R.prototype = new C();
R.prototype.isReal = retTrue;

R.prototype.isNaN      = retTrue;
R.prototype.isFinite   = retFalse;
R.prototype.isInfinite = retFalse;
R.prototype.isPositive = retFalse;
R.prototype.isNegative = retFalse;

R.prototype.toJSValue = function() { return NaN; };
R.prototype.valueOf = R.prototype.toJSValue;

R.prototype.toInexact = function() {
    if (this.isExact())
        return toFlonum(this.toJSValue());
    return this;
};

R.prototype.abs = retThis;
R.prototype.sqrt = retThis;

R.prototype.magnitude = function() {
    return this.abs();
};

R.prototype.gt = retFalse1;
R.prototype.lt = retFalse1;
R.prototype.ge = retFalse1;
R.prototype.le = retFalse1;
R.prototype.compare = function(x) { return undefined; };

var NAN = SN.NAN = new R();

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

Flonum.prototype.toString = function() {
    var s = "" + this.toJSValue();
    if (integerRegex.test(s))
        s += ".0";  // Force inexact.
    return s;
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

Flonum.prototype.isUnit = function() {
    return this._ === 1 || this._ === -1;
};

Flonum.prototype.isInfinite = function() {
    return !isFinite(this._);
};

Flonum.prototype.isNaN = function() {
    return isNaN(this._);
};

Flonum.prototype.upgrade = function(x) {
    if (!(x instanceof Flonum))
        throw new TypeError("Can't coerce to Flonum: " + x);
    return toFlonum(x._);
};

Flonum.prototype.toExact = function() {
    return numberToER(this._);
};

Flonum.prototype.add = function(z) {
    z = SN(z);
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
    z = SN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ - z._);
    return z.upgrade(this).subtract(z);
};

Flonum.prototype.multiply = function(z) {
    z = SN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ * z._);
    return z.multiply(this);
};

Flonum.prototype.reciprocal = function() {
    return toFlonum(1 / this._);
};

Flonum.prototype.divide = function(z) {
    z = SN(z);
    if (z instanceof Flonum)
        return toFlonum(this._ / z._);
    return z.upgrade(this).subtract(z);
};

Flonum.prototype.divAndMod = function(x) {
    x = toReal(x);
    if (!(x instanceof Flonum))
        return x.upgrade(this).divAndMod(x);
    var t = this._;
    x = x._;
    if (x === 0)
        throw new RangeError("Division by zero");

    var div = Math.floor(t / x);
    return [div, t - (x * div)];
};

Flonum.prototype.square = function() {
    return toFlonum(this._ * this._);
};

Flonum.prototype.eq = function(z) {
    z = SN(z);
    if (z instanceof Flonum)
        return this._ === z._;
    return z.eq(this);
};

Flonum.prototype.gt = function(x) {
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ > x._;
    return x.lt(this);
};

Flonum.prototype.lt = function(x) {
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ < x._;
    return x.gt(this);
};

Flonum.prototype.ge = function(x) {
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ >= x._;
    return x.le(this);
};

Flonum.prototype.le = function(x) {
    x = toReal(x);
    if (x instanceof Flonum)
        return this._ <= x._;
    return x.ge(this);
};

Flonum.prototype.ne = function(z) {
    z = SN(z);
    if (z instanceof Flonum)
        return this._ !== z._;
    return z.ne(this);
};

Flonum.prototype.compare = function(x) {
    x = toReal(x);
    if (x instanceof Flonum) {
        var t = this._;
        x = x._;
        if (t === x) return 0;
        if (t  <  x) return -1;
        if (t  >  x) return 1;
        return undefined;
    }
    return -x.compare(this);
};

['abs', 'acos', 'asin', 'atan', 'ceil', 'cos', 'exp', 'floor', 'log',
 'round', 'sin', 'sqrt', 'tan'].forEach(function(fn) {
         var mathFn = Math[fn];
         Flonum.prototype[fn] = function() {
             return toFlonum(mathFn(this._));
         };
     });

Flonum.prototype.atan2 = function(x) {
    return toFlonum(Math.atan2(this._, toReal(x).toJSValue()));
};

Flonum.prototype.expt = function(z) {
    z = SN(z);
    if (z instanceof Flonum)
        return toFlonum(Math.pow(this._, z._));
    return z.upgrade(this).expt(z);
};

var INEXACT_ZERO                   = new Flonum(0);
var INFINITY     = SN.INFINITY     = new Flonum(Infinity);
var M_INFINITY   = SN.M_INFINITY   = new Flonum(-Infinity);

// ER_Native: Exact rational represented as a native number.

function ER_Native(x) {
    this._ = x;
}

ER_Native.prototype = new Flonum(0);
ER_Native.prototype.isExact = retTrue;
ER_Native.prototype.isRational = retTrue;
ER_Native.prototype.isFlonum = retFalse;

function rationalToString(r) {
    return r.numerator().toString() + "/" + r.denominator().toString();
}

ER_Native.prototype.toString = function() {
    return rationalToString(this);
};

ER_Native.prototype.denominator = function() {
    return numberToEI(nativeDenominator(this._));
};

ER_Native.prototype.numerator = function() {
    return numberToEI(this._ * nativeDenominator(this._));
};

ER_Native.prototype.add = function(z) {
    z = SN(z);
    if (!(z instanceof ER_Native))
        return z.add(this);
    if (z._ === 0)
        return this;
    return upgradeER(this._).add(z);
};

ER_Native.prototype.negate = function() {
    return new ER_Native(-this._);
};

ER_Native.prototype.abs = function() {
    return (this._ < 0 ? new ER_Native(-this._) : this);
};

ER_Native.prototype.subtract = function(z) {
    z = SN(z);
    if (!(z instanceof ER_Native))
        return z.upgrade(this).add(z);
    if (z._ === 0)
        return this;
    return upgradeER(this._).subtract(z);
};

ER_Native.prototype.multiply = function(z) {
    z = SN(z);
    if (!(z instanceof ER_Native))
        return z.multiply(this);
    if (z._ === 0)
        return ZERO;
    if (z._ === 1)
        return this;
    if (z._ === -1)
        return new ER_Native(-this._);
    return upgradeER(this._).multiply(z);
};

ER_Native.prototype.divide = function(z) {
    z = SN(z);
    if (!(z instanceof ER_Native))
        return z.upgrade(this).multiply(z);
    if (z._ === 0)
        throw new RangeError("Division by zero");
    if (z._ === 1)
        return this;
    if (z._ === -1)
        return new ER_Native(-this._);
    return upgradeER(this._).divide(z);
}

// EI_Native: Exact integers as native numbers.

function toEI_Native(x) {
    if (x === 0) return ZERO;
    if (x === 1) return ONE;
    if (x === -1) return M_ONE;
    return new EI_Native(x);
}

function EI_Native(x) {
    this._ = x;
}

EI_Native.prototype = new ER_Native(0);
EI_Native.prototype.isInteger = retTrue;

EI_Native.prototype.toString = function() {
    return "" + this._;
};

EI_Native.prototype.add = function(z) {
    z = SN(z);
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
    z = SN(z);
    if (!(z instanceof EI_Native))
        return z.negate().add(this);
    var ret = this._ - z._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEI_Native(ret);
    return toEI_Big(this._).subtract(z);
};

EI_Native.prototype.multiply = function(z) {
    z = SN(z);
    if (!(z instanceof EI_Native))
        return z.multiply(this);
    var ret = this._ * z._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEI_Native(ret);
    return toEI_Big(this._).multiply(z);
};

EI_Native.prototype.divAndMod = function(x) {
    x = toReal(x);
    if (!(x instanceof EI_Native))
        return x.upgrade(this).divAndMod(x);
    var t = this._;
    x = x._;
    if (x === 0)
        throw new RangeError("Division by zero");

    var div = Math.floor(t / x);
    var tmp = x * div;

    if (tmp > -9007199254740992)
        return [div, t - tmp];

    // Oooh, I'd like a nice test suite for this.
    if (div > 0)
        return [div, (t - x) - (x * (div - 1))];
    return [div, (t + x) - (x * (div + 1))];
};

EI_Native.prototype.quotient = function(x) {
    return this.divAndMod(x)[0];
};

EI_Native.prototype.remainder = function(x) {
    return this.divAndMod(x)[1];
};

EI_Native.prototype.isEven = function() {
    return (this._ & 1) === 0;
};

EI_Native.prototype.isOdd = function() {
    return (this._ & 1) === 1;
};

//EI_Native.prototype.exp10 = function XXX;

//EI_Native.prototype.expt = function XXX;

var ZERO  = SN.ZERO  = new EI_Native(0);
var ONE   = SN.ONE   = new EI_Native(1);
var M_ONE = SN.M_ONE = new EI_Native(-1);

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

function gcdNative(a, b) {
    //assert(a >= 0 && b >= 0)
    var c;
    while (a !== 0) {
        c = a;
        a = b % a;
        b = c;
    }
    return b;
}

function gcdBig(a, b) {
    var c;
    while (!a.isZero()) {
        c = a;
        a = b.remainder(a);
        b = c;
    }
    return b;
}

function numberToBigInteger(n) {
    return BigInteger(n.toFixed(0));
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

function reduce(n, d) {
    if (d.isZero()) {
        throw new Error("Divide by zero");
    }

    var g = gcd(n.abs(), d.abs());

    n = n.quotient(g);
    d = d.quotient(g);

    if (d.isNegative()) {
        return [n.negate(), d.negate()];
    }
    return [n, d];
}

// ER_General: Exact rational as two exact integers in lowest terms.

function upgradeER(x) {
    return new ER_General(x.numerator(), x.denominator());
}

function ER_General(n, d) {
    this._n = n;
    this._d = d;
}

ER_General.prototype = new ER();

ER_General.prototype.toString = ER_Native.prototype.toString;

ER_General.prototype.numerator = function () {
    return this._n;
};

ER_General.prototype.denominator = function() {
    return this._d;
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

EI.prototype.numerator = retThis;
EI.prototype.denominator = function() { return ONE; };
EI.prototype.floor    = retThis;
EI.prototype.ceiling  = retThis;
EI.prototype.round    = retThis;
EI.prototype.truncate = retThis;

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

EI_Big.prototype.toJSValue = function() {
    return this._.toJSValue();
};
EI_Big.prototype.valueOf = EI_Big.prototype.toJSValue;

EI_Big.prototype.toString = function() {
    return this._.toString();
};

EI_Big.prototype.isZero = function() {
    return this._.isZero();
};

EI_Big.prototype.add = function(z) {
    z = SN(z);
    if (!z.isExact())
        return z.add(this.toJSValue());
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
    z = SN(z);
    if (!z.isExact())
        return z.subtract(this.toJSValue());
    if (z.isZero())
        return this;
    if (z instanceof EI_Big || z instanceof EI_Native)
        return reduceEI_Big(this._.subtract(z._));
    if (z instanceof ER_Native)
        z = upgradeER(z);
    return z.upgrade(this).subtract(z);
};

EI_Big.prototype.multiply = function(z) {
    z = SN(z);
    if (!z.isExact())
        return z.multiply(this.toJSValue());
    if (z.isZero())
        return z;
    if (z.eq(ONE))
        return this;
    if (z instanceof EI_Big || z instanceof EI_Native)
        return new EI_Big(this._.multiply(z._));
    if (z instanceof ER_Native)
        return upgradeER(z).add(this);
    return z.multiply(this);
}

SchemeNumber = SN;
if (typeof exports !== "undefined") {
    exports.SchemeNumber = SN;
}
})();
