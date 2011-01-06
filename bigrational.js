/* BigRational JavaScript library version 0.6
   http://john-edwin-tobey.org/bigrational/bigrational.js
   Copyright (c) 2010,2011 by John Tobey <John.Tobey@gmail.com>
   Licensed under the MIT license.

   Dependency: Silent Matt Crumley's BigInteger library.
   http://silentmatt.com/biginteger/
*/

/*
    Class: BigRational
    A ratio of two arbitrarily large integers.

    <BigRational> objects should be considered immutable. None of the "built-in"
    methods modify *this* or their arguments. All properties should be
    considered private.

    All the methods of <BigRational> instances can be called "statically". The
    static versions are convenient if you don't already have a <BigRational>
    object.

    As an example, these calls are equivalent.

    > BigRational(0.4).multiply(5); // returns BigRational(2);
    > BigRational.multiply(0.4, 5); // returns BigRational(2);
*/

var BigInteger;
if (typeof require !== "undefined") {
    BigInteger = require("biginteger").BigInteger;
}
else {
    BigInteger = this.BigInteger;
}
if (typeof BigInteger === "undefined") {
    if (typeof load !== "undefined") {
        load("biginteger.js");
    }
    else if (this.readFile) {
        eval(this.readFile("biginteger.js"));
    }
    else {
        throw new Error("BigInteger is not defined.");
    }
}
if (typeof BigInteger === "undefined") {
    throw new Error("Can't find BigInteger!");
}

var BigRational;
var BigRationalInteger;

(function() {

var INTERNAL = new Object();
var ALREADY_REDUCED = new String("ALREADY_REDUCED");

function gcd(a, b) {
    var c;
    while (!a.isZero()) {
        c = a;
        a = b.remainder(a);
        b = c;
    }
    return b;
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

// Given two BigRationalInteger objects, d positive, return their
// quotient.  Use pre-allocated values when possible.
function canonicalize(n, d) {
    if (n.isZero()) {
        return BigRational.ZERO;
    }
    if (d.isUnit() && n.isUnit()) {
        return (n.isPositive() ? BigRational.ONE : BigRational.M_ONE);
    }
    return new BigRational(n, d, INTERNAL);
}

function divide(n, d) {
    var nd = reduce(n, d);
    return canonicalize(nd[0], nd[1]);
}

/*
    Function: BigRational()
    Convert a value to a <BigRational>.

    <BigRational()> converts its arguments to <BigInteger> objects and
    divides the first by the second.  If passed only one argument,
    <BigRational()> returns a <BigRational> argument as-is and passes
    anything else to <parse>.

    > var r0 = BigRational(1,2);   // Return a <BigRational> equal to one half.
    > var r1 = BigRational(BigInteger.ONE, "2"); // Equivalent to r0.
    > var r2 = BigRational("1/2"); // Equivalent to r0.
    > var r3 = BigRational(".5");  // Equivalent to r0.
    > var r4 = BigRational(r3);    // Return r3, unchanged

    A third argument, if equal to <BigRational.ALREADY_REDUCED>, tells
    the function not to reduce *n* and *d* to lowest terms.  In this
    case, the caller must ensure that *n* and *d* have no non-trivial
    factors in common.

    Parameters:

        n - Numerator or value to convert to a <BigRational>.
        d - Denominator, 1 by default.
        flags - Controls term reduction.

    Returns:

        A <BigRational> value.

    See Also:

        <parse>, <BigRational>, <BigInteger>
*/
BigRational = function(n, d, flags) {

    if (!(this instanceof BigRational)) {

        switch (arguments.length) {
        case 3:
            if (flags === ALREADY_REDUCED) {
                n = BigRationalInteger(n);
                d = BigRationalInteger(d);
                if (d.isNegative()) {
                    n = n.negate();
                    d = d.negate();
                }
                return canonicalize(n, d);
            }
            // Fall through.
        case 2:
            var ret = divide(BigRationalInteger(n), BigRationalInteger(d));
            return ret;

        case 1:
            if (n instanceof BigRational) {
                return n;
            }
            if (n instanceof BigInteger) {
                return canonicalize(BigRationalInteger(n),
                                    BigRationalInteger.ONE);
            }
            return BigRational.parse(n);
        }

        throw new Error("BigRational: Invalid number of arguments");
    }

    // Allow "new BigRational()" without arguments for use as a prototype.
    if (arguments.length === 0) {
        this._n = this._d = "";  // Help toString.
        return;
    }

    // Forbid other constructor use outside of this module.
    if (flags !== INTERNAL) {
        throw new Error('Use "BigRational(...)", not "new BigRational(...)"');
    }
    this._n = n;
    this._d = d;
};

BigRational.ALREADY_REDUCED = ALREADY_REDUCED;

function zeroes(n) {
    return new Array((n >> 4) + 1).join("0000000000000000")
        + "000000000000000".substring(0, n & 15);
}

var integerRegex = /^[-+]?[0-9]+$/;

BigRational.parse = function(s) {
    s = s.toString();

    var array = s.split("/");
    if (array.length === 2) {
        return BigRational(array[0], array[1]);
    }
    if (array.length !== 1) {
        throw new Error("Invalid BigRational format: " + s);
    }

    // "19.9" => 199/10
    array = s.split(".");

    if (array.length === 2) {
        var integer = array[0];

        // "2.3e1" => 23/1
        // "2.3e-1" => 23/100
        array = array[1].split(/e/i);
        var fraction = array[0];
        var exponent = 0;

        if (array.length === 2) {
            if (!integerRegex.test(array[1])) {
                throw new Error("Invalid BigRational format: " + s);
            }
            exponent = parseInt(array[1]);
        }
        else if (array.length !== 1) {
            throw new Error("Invalid BigRational format: " + s);
        }

        integer += fraction;

        if (!integerRegex.test(integer)) {
            throw new Error("Invalid BigRational format: " + s);
        }

        var tens = exponent - fraction.length;
        if (tens >= 0) {
            return BigRational(integer + zeroes(tens), BigRationalInteger.ONE);
        }
        return BigRational(integer, "1" + zeroes(-tens));
    }

    if (array.length !== 1) {
        throw new Error("Invalid BigRational format: " + s);
    }

    return canonicalize(BigRationalInteger(s), BigRationalInteger.ONE);
};

BigRational.prototype.toString = function() {
    return this._n.toString() + "/" + this._d.toString();
};

BigRational.prototype.valueOf = function() {
    return this._n / this._d;
};

BigRational.prototype.toJSValue = function() {
    return this._n / this._d;
};

BigRational.prototype.numerator = function() {
    return this._n;
};

BigRational.prototype.denominator = function() {
    return this._d;
};

BigRational.prototype.add = function(r) {
    r = BigRational(r);
    var g = gcd(this._d, r._d);
    var d_g = this._d.quotient(g);
    return canonicalize(r._d.quotient(g).multiply(this._n)
                        .add(d_g.multiply(r._n)), d_g.multiply(r._d));
};

BigRational.prototype.negate = function() {
    return canonicalize(this._n.negate(), this._d);
};

BigRational.prototype.subtract = function(r) {
    return this.add(BigRational(r).negate());
};

BigRational.prototype.multiply = function(r) {
    r = BigRational(r);
    return divide(this._n.multiply(r._n), this._d.multiply(r._d));
};

BigRational.prototype.reciprocal = function() {
    var n = this._d;
    var d = this._n;
    if (d.isZero()) {
        throw new Error("Divide by zero");
    }
    if (d.isNegative()) {
        d = d.negate();
        n = n.negate();
    }
    return canonicalize(n, d);
};

BigRational.prototype.divide = function(r) {
    return this.multiply(BigRational(r).reciprocal());
};

BigRational.prototype.isZero = function() {
    return this._n.isZero();
};

BigRational.prototype.isPositive = function() {
    return this._n.isPositive();
};

BigRational.prototype.isNegative = function() {
    return this._n.isNegative();
};

BigRational.prototype.isUnit = function() {
    return this._n.isUnit() && this._d.isUnit();
};

BigRational.prototype.abs = function() {
    return this.isNegative() ? this.negate() : this;
};

BigRational.prototype.sign = function() {
    return this._n.sign();
};

function compareAbsInternal(q, r) {
    if (q._d.compare(r._d) === 0) {
        return q._n.compareAbs(r._n);
    }

    return q._n.multiply(r._d).compareAbs(q._d.multiply(r._n));
}

BigRational.prototype.compareAbs = function(r) {
    if (this === r) {
        return 0;
    }

    r = BigRational(r);

    return compareAbsInternal(this, r);
};

BigRational.prototype.compare = function(r) {
    if (this === r) {
        return 0;
    }

    r = BigRational(r);
    var s = this._n.sign();

    if (s === 0) {
        return -r._n.sign();
    }

    if (s !== r._n.sign()) {
        return s;
    }

    return compareAbsInternal(this, r);
};

BigRational.prototype.isInteger = function() {
    return this._d.isUnit();
};

BigRational.prototype.floor = function() {
    if (this._d.isUnit()) {
        return this._n;
    }
    if (this.isNegative()) {
        return this._n.quotient(this._d).prev();
    }
    return this._n.quotient(this._d);
};

BigRational.prototype.ceiling = function() {
    if (this._d.isUnit()) {
        return this._n;
    }
    if (this.isNegative()) {
        return this._n.quotient(this._d);
    }
    return this._n.quotient(this._d).next();
};

BigRational.prototype.round = function() {
    if (this._d.isUnit()) {
        return this._n;
    }
    if (this.isNegative()) {
        return this.negate().round().negate();
    }

    var divmod = this._n.divRem(this._d);
    var div = divmod[0];
    var mod = divmod[1];

    switch (mod.add(mod).compare(this._d)) {
    case 0: return (div.isEven() ? div : div.next());
    case 1: return div.next();
    default: return div;
    }
};

BigRational.prototype.truncate = function() {
    return this._n.quotient(this._d);
};

BigRational.prototype.square = function() {
    return canonicalize(this._n.square(), this._d.square());
};

BigRational.prototype.pow = function(n) {
    n = BigRational(n);
    if (!n.isInteger()) {
        throw new Error("pow: can not handle non-integer exponent: " + n);
    }
    n = n._n;

    if (n.isUnit()) {
        return n.isPositive() ? this : this.reciprocal();
    }

    var s = n.sign();
    if (s === 0) {
        return BigRational.ONE;
    }

    var num, den;
    if (s > 0) {
        num = this._n;
        den = this._d;
    }
    else {
        n = n.negate();
        num = this._d;
        den = this._n;
        if (den.isZero()) {
            throw new Error("Divide by zero");
        }
    }

    return BigRational(BigInteger.pow(num, n),
                       BigInteger.pow(den, n), ALREADY_REDUCED);
};

BigRational.prototype.log = function() {
    return this._n.log() - this._d.log();
}

// Wrap all the BigInteger methods and functions so they accept
// BigRational arguments.  BigRationalInteger should be a drop-in
// replacement for BigInteger.

function copyArguments(arguments) {
    var newArgs = new Array(arguments.length);
    for (var i = 0; i < arguments.length; i++) {
        newArgs[i] = arguments[i];
    }
    return newArgs;
}

BigRationalInteger = function(x, flag) {
    if (!(this instanceof BigRationalInteger)) {
        if (x instanceof BigRationalInteger) {
            return x;
        }
        if (x instanceof BigRational) {
            return x.truncate();
        }
        if (!(x instanceof BigInteger)) {
            x = BigInteger.apply(this, copyArguments(arguments));
        }
        if (x.isZero()) {
            return BigRationalInteger.ZERO;
        }
        if (x.isUnit()) {
            return (x.isPositive() ? BigRationalInteger.ONE
                    : BigRationalInteger.M_ONE);
        }
        return new BigRationalInteger(x, INTERNAL);
    }

    if (arguments.length === 0) {  // Allow null constructor for subclassing.
        x = BigInteger.ZERO;
        flag = INTERNAL;
    }
    if (flag !== INTERNAL) {
        throw new Error("Use BigRationalInteger(x)," +
                        " not new BigRationalInteger(x).");
    }

    // Copy private BigInteger properties to the new object.

    if (Object.getOwnPropertyNames) {
        // XXX UNTESTED!  Fresh off the ECMA press.  Not supported in
        // my JS engines.
        var names = Object.getOwnPropertyNames(x);
        var i = names.length;
        while (i--) {
            this[names[i]] = x[names[i]];
        }
    }
    else {
        for (var i in x) {
            //if (typeof x[i] !== "function") {
            if (x.hasOwnProperty(i)) {
                this[i] = x[i];
            }
        }
    }
};

function wrapValue(value) {
    if (value instanceof BigInteger) {
        return BigRationalInteger(value);
    }
    if (value instanceof Array) {
        var len = value.length;
        if (len === 0) {
            return value;
        }
        var ret = new Array(len);
        while (len--) {
            ret[len] = wrapValue(value[len]);
        }
        return ret;
    }
    return value;
}

// Subclass BigInteger.
var biproto = new BigInteger();

// These methods take no argument and return a native value.
var retNative = " toJSValue isZero isPositive isNegative isEven isOdd isUnit sign isInteger log ";
var dontWrap = retNative + "toString valueOf ";

// These methods take no argument.  The return type is a bignum of the
// same type as this.
var retSame = " negate abs square ";

// These methods take no argument and return a rational.
var retRational = " reciprocal ";

// These methods take no argument and return a big integer value.
var retBigInteger = " numerator denominator floor ceiling round truncate ";

// These methods take a rational argument and return a native value.
// If the argument is an integer, they must use the BigInteger
// implementation to avoid infinite recursion.
var rationalRetNative = " compare compareAbs ";

// These methods take a rational argument and return a bignum.  If both
// this and the argument are integers, the returned value is an integer.
var rationalRetSame = " add subtract multiply ";

// These methods take a rational argument and return a rational.
var rationalRetRational = " divide ";

// BigRationalInteger method specializations.
biproto.isInteger = function() {
    return true;
};
biproto.numerator = function() {
    return this;
};
biproto.denominator = function() {
    return BigRationalInteger.ONE;
};
biproto.floor    = biproto.numerator;
biproto.ceiling  = biproto.numerator;
biproto.round    = biproto.numerator;
biproto.truncate = biproto.numerator;

biproto.reciprocal = function() {
    if (this.isNegative()) {
        return canonicalize(BigRationalInteger.M_ONE, this.negate());
    }
    return canonicalize(BigRationalInteger.ONE, this);
};

biproto.pow = function(n) {
    var ret = BigRational(this).pow(n);
    if (ret.isInteger()) {
        return ret.numerator();
    }
    return ret;
}

var indent="";
function logEntry(name, ch) {
    //print(indent + ch + ">" + name); indent = indent + " ";
}
function logExit(name, ch) {
    //indent = indent.substring(1); print(indent + "<" + ch + name);
}
function makeBriMethod(name) {
    var search = " " + name + " ";
    var mi = BigInteger.prototype[name];

    if (dontWrap.indexOf(search) !== -1) {
        return mi;
    }

    if (retSame.indexOf(search) !== -1) {
        return function() {
            logEntry(name, '=');
            var ret = BigRationalInteger(mi.call(this));
            logExit(name, '=');
            return ret;
        };
    }

    var mr = BigRational.prototype[name];

    if (!mr) {

        // This method applies only to integers, e.g., remainder().
        // Convert the result to BigRationalInteger.  For divRem (and
        // any future BigInteger-array-returning methods) convert
        // recursively.

        return function() {
            // XXX could optimize by specializing on arity?
            logEntry(name, '+');
            var ret = wrapValue(mi.apply(this, copyArguments(arguments)));
            logExit(name, '+');
            return ret;
        };
    }

    if (rationalRetNative.indexOf(search) !== -1) {
        return function(a) {
            var ret;
            logEntry(name, '~');
            if (a instanceof BigInteger) {
                ret = mi.call(this, a);
            }
            else {
                a = BigRational(a);
                if (a.isInteger()) {
                    ret = mi.call(this, a.numerator());
                }
                else {
                    ret = mr.call(BigRational(this), a);
                }
            }
            logExit(name, '~');
            return ret;
        };
    }

    if (rationalRetSame.indexOf(search) !== -1) {
        return function(a) {
            var ret;
            logEntry(name, '*');
            if (a instanceof BigInteger) {
                ret = BigRationalInteger(mi.call(this, a));
            }
            else {
                a = BigRational(a);
                if (a.isInteger()) {
                    ret = BigRationalInteger(mi.call(this, a.numerator()));
                }
                else {
                    ret = mr.call(BigRational(this), a);
                }
            }
            logExit(name, '*');
            return ret;
        };
    }

    if (rationalRetRational.indexOf(search) !== 1) {
        return function(a) {
            logEntry(name, '#');
            var ret = mr.call(BigRational(this), a);
            logExit(name, '#');
            return ret;
        };
    }

    throw new Error("Code does not account for method " + name);
}

for (var i in BigInteger.prototype) {
    if (biproto[i] === BigInteger.prototype[i]) {
        biproto[i] = makeBriMethod(i);
    }
}

for (var i in BigRational.prototype) {
    if (!biproto[i]) {
        throw new Error("Forgot method " + i);
    }
}

BigRationalInteger.prototype = biproto;

BigRationalInteger.ZERO  = new BigRationalInteger(BigInteger.ZERO,  INTERNAL);
BigRationalInteger.ONE   = new BigRationalInteger(BigInteger.ONE,   INTERNAL);
BigRationalInteger.M_ONE = new BigRationalInteger(BigInteger.M_ONE, INTERNAL);
BigRationalInteger._0 = BigRationalInteger.ZERO;
BigRationalInteger._1 = BigRationalInteger.ONE;

BigRationalInteger.parse = function(a, b) {
    var ret;
    switch (arguments.length) {
    case 1:
        ret = BigInteger.parse(a);
        break;
    case 2:
        ret = BigInteger.parse(a, b);
        break;
    default:
        ret = BigInteger.parse.apply(this, copyArguments(arguments));
        break;
    }
    return BigRationalInteger(ret);
};

BigRationalInteger.small = wrapValue(BigInteger.small);

for (var i in BigInteger) {
    if (typeof BigRationalInteger[i] !== "undefined") {
        continue;
    }
    var value = BigInteger[i];
    if (typeof value === "function") {
        var meth = BigRationalInteger.prototype[i];
        if (!meth) {
            throw new Error("Forgot BigInteger function " + i);
        }
        value = function(a) {
            var args = copyArguments(arguments);
            var first = args.shift();
            return wrapValue(meth.apply(BigRationalInteger(first), args));
        };
    }
    else if (value instanceof BigInteger) {
        value = BigRationalInteger(value);
    }
    BigRationalInteger[i] = value;
}

// Back to class BigRational.

// Constant: ZERO
// <BigRational> 0.
BigRational.ZERO = new BigRational(BigInteger.ZERO, BigInteger.ONE, INTERNAL);

// Constant: ONE
// <BigRational> 1.
BigRational.ONE = new BigRational(BigInteger.ONE, BigInteger.ONE, INTERNAL);

// Constant: M_ONE
// <BigRational> -1.
BigRational.M_ONE = new BigRational(BigInteger.M_ONE, BigInteger.ONE, INTERNAL);

// Wrap methods in functions that normalize their arguments.
function makeUnary(fn) {
    return function(a) {
        return fn.call(BigRational(a));
    };
}

function makeBinary(fn) {
    return function(a, b) {
        return fn.call(BigRational(a), b);
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function() {
        return this.replace(/^\s+/, "").replace(/\s+$/, "");
    }
}
var unary = new String(retNative + retSame + retRational + retBigInteger)
    .trim().split(/ +/);
var binary = new String(rationalRetNative + rationalRetSame + rationalRetRational)
    .trim().split(/ +/);

for (var i = 0; i < unary.length; i++) {
    var fn = unary[i];
    BigRational[fn] = makeUnary(BigRational.prototype[fn]);
}

for (var i = 0; i < binary.length; i++) {
    var fn = binary[i];
    BigRational[fn] = makeBinary(BigRational.prototype[fn]);
}

BigRational.pow = function(r, n) {
    return BigRational(r).pow(n);
}

for (var i in BigRational.prototype) {
    if (typeof BigRational[i] === "undefined") {
        print("Missing BigRational." + i);
    }
}

if (typeof exports !== "undefined") {
    exports.BigRational = BigRational;
    exports.BigInteger = BigRationalInteger;
}
})();
