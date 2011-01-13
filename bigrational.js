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
        a = BigInteger.remainder(b, a);
        b = c;
    }
    return (b instanceof BigRationalInteger ? b : BigRationalInteger(b));
}

function reduce(n, d) {
    //assert(n instanceof BigRationalInteger);
    //assert(d instanceof BigRationalInteger);
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
    if (d === BigRational.ONE) {
        return n;
    }
    return new BigRational(n, d, INTERNAL);
}

function divide(n, d) {
    if (d === BigRational.ONE) {
        return n;
    }
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
                return canonicalize(BigRationalInteger(n), BigRational.ONE );
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
            return BigRationalInteger(integer + zeroes(tens));
        }
        return BigRational(integer, "1" + zeroes(-tens));
    }

    if (array.length !== 1) {
        throw new Error("Invalid BigRational format: " + s);
    }

    return canonicalize(BigRationalInteger(s), BigRational.ONE);
};

BigRational.prototype.toString = function() {
    return this._n.toString() + "/" + this._d.toString();
};

BigRational.prototype.valueOf = function() {
    return this._n / this._d;
};

BigRational.prototype.toJSValue = BigRational.prototype.valueOf;

BigRational.prototype.numerator = function() {
    return this._n;
};

BigRational.prototype.denominator = function() {
    return this._d;
};

BigRational.prototype.add = function(r) {
    r = BigRational(r);
    var r_d = r.denominator();
    var d = this.denominator();
    if (d.compare(r_d) === 0) {
        return divide(this._n.add(r.numerator()), d);
    }
    var g = gcd(this._d, r_d);
    var d_g = this._d.quotient(g);
    return divide(r_d.quotient(g).multiply(this._n)
                  .add(d_g.multiply(r.numerator())), d_g.multiply(r_d));
};

BigRational.prototype.negate = function() {
    return canonicalize(this._n.negate(), this._d);
};

BigRational.prototype.subtract = function(r) {
    return this.add(BigRational(r).negate());
};

BigRational.prototype.multiply = function(r) {
    r = BigRational(r);
    return divide(this._n.multiply(r.numerator()),
                  this._d.multiply(r.denominator()));
};

BigRational.prototype.reciprocal = function() {
    var n = this._d;
    var d = this._n;
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
    return false;
};

BigRational.prototype.isPositive = function() {
    return this._n.isPositive();
};

BigRational.prototype.isNegative = function() {
    return this._n.isNegative();
};

BigRational.prototype.isUnit = function() {
    return false;
};

BigRational.prototype.abs = function() {
    return this.isNegative() ? this.negate() : this;
};

BigRational.prototype.sign = function() {
    return this._n.sign();
};

function compareAbsInternal(q, r) {
    var q_n = q.numerator();
    var q_d = q.denominator();
    var r_n = r.numerator();
    var r_d = r.denominator();

    if (BigInteger.compare(q_d, r_d) === 0) {
        return BigInteger.compareAbs(q_n, r_n);
    }

    return BigInteger.compareAbs(BigInteger.multiply(q_n, r_d),
                                 BigInteger.multiply(q_d, r_n));
}

BigRational.prototype.compareAbs = function(r) {
    if (this === r) {
        return 0;
    }

    r = BigRational(r);

    return compareAbsInternal(this, r);
};

BigRational.prototype.compare = function(r) {
    r = BigRational(r);
    var s = this.sign();

    if (s === 0) {
        return -r.sign();
    }

    if (s !== r.sign()) {
        return s;
    }

    return compareAbsInternal(this, r);
};

BigRational.prototype.isInteger = function() {
    return false;
};

BigRational.prototype.floor = function() {
    if (this.isNegative()) {
        return this._n.quotient(this._d).prev();
    }
    return this._n.quotient(this._d);
};

BigRational.prototype.ceiling = function() {
    if (this.isNegative()) {
        return this._n.quotient(this._d);
    }
    return this._n.quotient(this._d).next();
};

BigRational.prototype.round = function() {
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

function powInternal(base, exp) {
    exp = BigRational(exp);
    if (exp === BigRational.ONE) {
        return exp.isPositive() ? base : base.reciprocal();
    }

    var num = base.numerator();
    var den = base.denominator();

    if (!exp.isInteger()) {
        switch (num.sign()) {
        case -1:
            throw new RangeError
                ("Can't raise a negative to a non-integer power.");
        case 0:
            if (exp.isNegative()) {
                throw new Error("Divide by zero");
            }
            return BigRational.ZERO;
        default:  // 1
            if (base.isUnit()) {
                return BigRational.ONE;
            }
            // XXX Shouldn't the returned value support various methods
            // such as .add() etc. ???
            return Math.exp((num.log() - den.log()) * exp.toJSValue());
        }
    }

    var s = exp.sign();
    if (s === 0) {
        return BigRational.ONE;
    }

    if (s < 0) {
        exp = exp.negate();
        var tmp = num;
        num = den;
        den = tmp;
        if (den.isZero()) {
            throw new Error("Divide by zero");
        }
    }

    return BigRational(BigInteger.pow(num, exp),
                       BigInteger.pow(den, exp), ALREADY_REDUCED);
}

BigRational.prototype.pow = function(n) {
    return powInternal(this, n);
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
        if (!(x instanceof BigInteger)) {
            x = BigInteger(x, flag);
        }
        if (x.isNegative()) {
            if (x.isUnit()) {
                return BigRational.M_ONE;
            }
        }
        else if (x.compare(maxSmall) <= 0) {
            return BigRationalInteger.small[x.toString()];
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

    if (true) {
        this._d = x._d;
        this._s = x._s;
    }
    else if (Object.getOwnPropertyNames) {
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
var rationalRetSameCommutative = " add multiply ";
var rationalRetSame = " subtract ";

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
    return BigRational.ONE;
};
biproto.floor    = biproto.numerator;
biproto.ceiling  = biproto.numerator;
biproto.round    = biproto.numerator;
biproto.truncate = biproto.numerator;

biproto.reciprocal = function() {
    switch (this.sign()) {
    case 0: throw new Error("Divide by zero");
    case 1: return canonicalize(BigRational.ONE, this);
    default:
    case -1: return canonicalize(BigRational.M_ONE, this.negate());
    }
};

biproto.pow = function(n) {
    return powInternal(this, n);
};

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

    if (rationalRetSameCommutative.indexOf(search) !== -1) {
        return function(a) {
            var ret;
            logEntry(name, '%');
            if (a instanceof BigInteger) {
                ret = BigRationalInteger(mi.call(this, a));
            }
            else {
                a = BigRational(a);
                if (a.isInteger()) {
                    ret = BigRationalInteger(mi.call(this, a));
                }
                else {
                    ret = mr.call(a, this);
                }
            }
            logExit(name, '%');
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
                    ret = BigRationalInteger(mi.call(this, a));
                }
                else {
                    ret = mr.call(this, a);
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

BigRationalInteger.small = new Array(BigInteger.small.length);
BigRationalInteger.small[0] = BigRationalInteger.ZERO;
BigRationalInteger.small[1] = BigRationalInteger.ONE;
for (var i = 2; i < BigInteger.small.length; i++) {
    BigRationalInteger.small[i] = new BigRationalInteger(BigInteger.small[i],
                                                         INTERNAL);
}
var maxSmall = BigRationalInteger.small[BigRationalInteger.small.length - 1];

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
BigRational.ZERO = BigRationalInteger.ZERO;

// Constant: ONE
// <BigRational> 1.
BigRational.ONE = BigRationalInteger.ONE;

// Constant: M_ONE
// <BigRational> -1.
BigRational.M_ONE = BigRationalInteger.M_ONE;

// Wrap methods in functions that normalize their arguments.  Don't
// optimize as in biginteger.js, since we use interface inheritance.
// BigRational.add(4,"1/2") would call BigRational.prototype.add
// instead of BigRationalInteger.prototype.add as it should (since
// BigRational(4) is a BigRationalInteger).  The functions generated
// by makeUnary and makeBinary are convenience wrappers.

function makeUnary(name) {
    return function(a) {
        return BigRational(a)[name]();
    };
}

function makeBinary(name) {
    return function(a, b) {
        return BigRational(a)[name](b);
    };
}

var trim = (String.prototype.trim ? function(s) { return s.trim(); } :
            function(s) {
                return s.replace(/^\s+/, "").replace(/\s+$/, "");
            });

var unary = trim(new String(retNative + retSame + retRational + retBigInteger))
    .split(/ +/);
var binary = trim(new String(rationalRetNative + rationalRetSame + rationalRetSameCommutative + rationalRetRational))
    .split(/ +/);

for (var i = 0; i < unary.length; i++) {
    var fn = unary[i];
    BigRational[fn] = makeUnary(fn);
}

for (var i = 0; i < binary.length; i++) {
    var fn = binary[i];
    BigRational[fn] = makeBinary(fn);
}

BigRational.pow = function(r, n) {
    return BigRational(r).pow(n);
}

BigRational.log = function(r) {
    return BigRational(r).log();
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
