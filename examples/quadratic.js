// Exact quadratic numbers.  Incomplete.

// The quadratic numbers are the rationals along with their real
// square roots and everything obtainable by adding together such
// numbers.  The sum, difference, product, and quotient of two
// quadratic numbers are themselves quadratic.

// The simplest irrational example is the square root of 2.

// The goal here is to represent these numbers exactly in Scheme and
// return exact results where the standard requires it.

// The purpose of this file is to test ideas for supporting extension
// of the core set of types defined in schemeNumber.js.

// This file is incomplete; if complete, it would present a clean,
// module-like interface and would not rely on the variables "fn",
// "sn", and "ns" in the global environment.

// XXX We should avoid "i in x" construct due to concerns about
// Object.prototype.  Looking for a good alternative.

function assert(x) { if (!x) throw new Error("assertion failed"); }

function factorize(n) {
    assert(fn["integer?"](n));
    assert(fn["positive?"](n));
    var ret = {};
    // Stupidly factor n into primes.
    // Lots of room for optimization, I think.
    var sqrtN = fn["exact-integer-sqrt"](n)[0];
    var ONE = sn("1");
    var TWO = sn("2");
    var i = TWO;
    var next = sn("3");
    while (!fn["="](n, ONE)) {
        var a = fn["div-and-mod"](n, i);
        if (fn["zero?"](a[1])) {
            ret[i] = (ret[i] || 0) + 1;
            n = a[0];
            sqrtN = fn["exact-integer-sqrt"](n)[0];
        }
        else {
            i = next;
            next = fn["+"](next, TWO);
        }
        if (fn[">"](i, sqrtN)) {
            i = n;
        }
    }
    return ret;
}

// Returns [p,q] s.t. n=p*p*q for maximal p.
function factorSquares(n) {
    var factors = factorize(n);
    var p = sn("1");
    var q = p;
    for (var i in factors) {
        var count = factors[i];
        i = sn(i);
        var odd = (count & 1);
        var half = count >> 1;
        if (odd) {
            q = fn["*"](q, i);
        }
        if (half) {
            p = fn["*"](p, fn.expt(i, fn.exact(half)));
        }
    }
    return [p, q];
}

// x maps positive, square-free integer n to nonzero rational c.
// Value is sum of c*sqrt(n).
var Quadratic = function(x) {
    this._ = x;
};

var ROOT_START = "\u221A";  // Unicode Character 'SQUARE ROOT'
var ROOT_END = "";
//var ROOT_START = "sqrt("; var ROOT_END = ")";

function numberToString(q, radix) {
    var ret = "";
    for (var n in q._) {  // XXX should sort.
        var c = q._[n];
        if (fn["positive?"](c)) {
            if (ret != "") {
                ret += "+";
            }
        }
        else {
            ret += "-";
            c = fn["-"](c);
        }

        // Express c * sqrt(n).

        // Trivial case n=1, express c.
        if (n === "1") {
            ret += c.toString(radix);
            continue;
        }

        // Construct NUM ROOT N / DEN,
        // omitting NUM if NUM=1, omitting / DEN if DEN=1.

        var num = fn.numerator(c);
        if (!fn["="](num, "1")) {
            ret += num.toString(radix);
        }
        ret += ROOT_START;
        if (radix && radix != 10) {
            ret += sn(n).toString(radix);
        }
        else {
            ret += n;
        }
        ret += ROOT_END;

        if (!fn["integer?"](c)) {
            var den = fn.denominator(c);
            ret += "/" + den.toString(radix);
        }
    }
    return ret;
};

function debug(q) {
    return "Quadratic(" + numberToString(q) + ")";
}

function valueOf(q) {
    var ret = 0;
    for (var n in q._) {
        var c = q._[n];
        ret += c * Math.sqrt(n);
    }
    return ret;
};

function exactSqrt(q) {
    q = sn(q);
    assert(fn["rational?"](q));
    var isPositive = fn["positive?"](q);

    if (!isPositive) {
        if (fn["zero?"](q)) {
            return q;
        }
        q = fn["-"](q);
    }

    var num = factorSquares(fn.numerator(q));
    var den = factorSquares(fn.denominator(q));

    // q == num[0]*num[0]*num[1] / (den[0]*den[0]*den[1])

    var n = fn["*"](num[1], den[1]);
    var c = fn["/"](num[0], den[0], den[1]);  // XXX redundant reduction.

    // n = num[1]*den[1]
    // c == num[0]/(den[0]*den[1])
    // c*c*n = q

    var ret;
    if (fn["="](n, "1")) {
        ret = c;
    }
    else {
        ret = {};
        ret[n] = c;
        ret = new Quadratic(ret);
    }
    if (!isPositive) {
        ret = fn["make-rectangular"]("0", ret);
    }
    return ret;
}

function _upgrade_EQ(q) {
    var ret = {};
    ret[1] = q;
    return ret;
}

function _add(x, y) {
    var ret = {};
    for (var i in x) {
        ret[i] = x[i];
    }
    for (var i in y) {
        var c = ret[i];
        if (c) {
            c = fn["+"](c, y[i]);
            if (fn["zero?"](c)) {
                delete(ret[i]);
            }
            else {
                ret[i] = c;
            }
        }
        else {
            ret[i] = fn["+"](y[i]);
        }
    }
    return ret;
}

function _toSN(x) {
    var ret = sn("0");
    for (i in x) {
        if (i === "1") {
            ret = x[i];
        }
        else {
            return new Quadratic(x);
        }
    }
    return ret;
}

function _negate(q, r) {
    for (var i in q) {
        r[i] = fn["-"](q[i]);
    }
}

function add_Quadratic_EQ(quad, rat) {
    return _toSN(_add(quad._, _upgrade_EQ(rat)));
}

function add_Quadratic_Quadratic(q, r) {
    return _toSN(_add(q._, r._));
}

function negate(q) {
    var r = {};
    _negate(q._, r);
    return new Quadratic(r);
}

function _multiply_EQ(x, eq) {
    assert(fn["rational?"](eq));
    var ret = {};
    if (!fn["zero?"](eq)) {
        for (i in x) {
            ret[i] = fn["*"](x[i], eq);
        }
    }
    return ret;
}

// multiplies x by sqrt(n).
function _multiply_single(x, n) {
    assert(fn["integer?"](n));
    assert(fn["positive?"](n));
    var ret = {};
    for (i in x) {
        var c = x[i];
        i = sn(i);
        // multiply c*sqrt(i) by sqrt(n):
        // (c*gcd(i,n)) * sqrt(i*n/gcd(i,n)^2)
        var g = fn.gcd(i, n);
        c = fn["*"](c, g);
        var n1 = fn["/"](fn["*"](i, n), g, g);
        ret[n1] = c;
    }
    return ret;
}

function _multiply(x, y) {
    var ret = {};
    for (n in y) {
        var c = y[n];
        var tmp = _multiply_EQ(x, c);
        if (n != "1") {
            tmp = _multiply_single(tmp, sn(n));
        }
        ret = _add(ret, tmp);
    }
    return ret;
}

function multiply_Quadratic_EQ(quad, rat) {
    return _toSN(_multiply(quad._, _upgrade_EQ(rat)));
}

function multiply_Quadratic_Quadratic(q, r) {
    return _toSN(_multiply(q._, r._));
}

// Returns q and r such that x == q + r * sqrt(p) and neither q nor r
// contains the square root of a number divisible by p.  If isDivide
// is true, the second returned element shall be r*sqrt(p) instead of r.
function _decompose(x, p, isDivide) {
    var q = null;
    var r = null;
    for (var i in x) {
        var c = x[i];
        var n = sn(i);
        var dm = fn["div-and-mod"](n, p);
        //print("divmod(" + n + ", " + p + ") == " + dm);
        if (fn["zero?"](dm[1])) {
            r = r || {};
            r[isDivide ? i : dm[0]] = c;
        }
        else {
            q = q || {};
            q[i] = c;
        }
    }
    return [q, r];
}

// Return true if X is positive.  PRIMES must be a sorted array of
// exact integers containing each prime factor of each key of x.  That
// is, of each number whose square root is taken in x.  X must be nonzero.
// XXX Should avoid work when all components of X are of one sign.
function _isPositive(x, primes, primeIndex) {
    while (primeIndex > 0) {
        var p = primes[--primeIndex];
        var qr = _decompose(x, p, false);
        var q = qr[0];
        var r = qr[1];
        // x == q + r * sqrt(p)
        // No number under the radical in q or r is divisible by p.
        if (!q) {
            x = r;
            continue;
        }
        if (!r) {
            x = q;
            continue;
        }
        var qGt0 = _isPositive(q, primes, primeIndex);
        var rGt0 = _isPositive(r, primes, primeIndex);
        if (rGt0 === qGt0) {
            return rGt0;
        }
        // We want to know whether Q + R * sqrt(P) > 0.
        // Q > -R*sqrt(P)
        // (Q > 0) ? (R < 0 && Q^2 > R^2*P) : (R < 0 || Q^2 < R^2*P)
        // Check whether Q^2 - (R^2)*P is positive.
        var mr2p = _multiply_EQ(_multiply(r, r), p);
        _negate(mr2p, mr2p);
        var q2GtR2p = _isPositive(_add(_multiply(q, q), mr2p), primes,
                                  primeIndex);
        return (qGt0 === q2GtR2p);
    }
    return fn["positive?"](x[1]);
}

// Return a sorted array of all prime factors of numbers under radicals in x.
function _primes(x) {
    var primes = [];
    var seen = {};
    for (var i in x) {
        var factors = factorize(sn(i));
        for (var f in factors) {
            if (!seen[f]) {
                primes.push(sn(f));
                seen[f] = true;
            }
        }
    }
    primes.sort(fn["-"]);  // XXX should convert "-" result to JS number?
    return primes;
}

function isPositive(q) {
    var primes = _primes(q._);
    return _isPositive(q._, primes, primes.length);
}

function isZero(q) {
    return false;
}

function equals_Quadratic_EQ(q, r) {
    return false;
}

function equals_Quadratic_Quadratic(q, r) {
    for (i in q) {
        if (r[i] === undefined || !fn["="](q[i], r[i])) {
            return false;
        }
    }
    for (i in r) {
        if (q[i] === undefined) {
            return false;
        }
    }
    return true;
}

function _divide(x, y, primes) {
    while (primes.length) {
        var p = primes.pop();
        var qr = _decompose(y, p, true);
        var q = qr[0];
        var r = qr[1];
        // y == q + r
        // No number under the radical in q or r/sqrt(p) is divisible by p.
        if (!r) {
            continue;
        }
        if (!q) {
            x = _multiply_single(x, p);
            y = _multiply_single(y, p);
            continue;
        }
        // Multiply x and y by (q-r) to clear sqrt(p) from y.
        _negate(r, q);
        x = _multiply(x, q);
        y = _multiply(y, q);
    }
    return _multiply_EQ(x, fn["/"](y[1]));
}

function divide_Quadratic_Quadratic(q, r) {
    return _toSN(_divide(q._, r._, _primes(r._)));
}

function divide_EQ_Quadratic(rat, quad) {
    return _toSN(_divide(_upgrade_EQ(rat), quad._, _primes(quad._)));
}

// XXX core should do this when we pass our operators to a nice, new
// high-level interface, say
if (false)  // until addType exists
sn.pluginApi.addType("Quadratic", Quadratic, "ER", {
    "numberToString": numberToString,
    // XXX how to hook into the number parser?
    "debug": debug,
    "valueOf": valueOf,
    "add(Quadratic,EQ)": add_Quadratic_EQ,
    "add(Quadratic,Quadratic)": add_Quadratic_Quadratic,
    "negate(Quadratic)": negate,
    "multiply(Quadratic,EQ": multiply_Quadratic_EQ,
    "multiply(Quadratic,Quadratic)": multiply_Quadratic_Quadratic,
    "divide(EQ,Quadratic)": divide_EQ_Quadratic,
    "divide(Quadratic,Quadratic)": divide_Quadratic_Quadratic,
    "isPositive(Quadratic)": isPositive,
    "isZero(Quadratic)": isZero,
    "equals(Quadratic,EQ)": equals_Quadratic_EQ,
    "equals(Quadratic,Quadratic)": equals_Quadratic_Quadratic,
});
Quadratic.prototype = new sn.pluginApi.ER();

Quadratic.prototype.SN_numberToString = function(r, p) { return numberToString(this, r); };
Quadratic.prototype.valueOf = function() { return valueOf(this); };
Quadratic.prototype.SN_debug = function() { return debug(this); };
Quadratic.prototype.SN_negate = function() { return negate(this); };
Quadratic.prototype.SN_isPositive = function() { return isPositive(this); };
Quadratic.prototype.SN_isNegative = function() { return !isPositive(this); };
Quadratic.prototype.SN_sign = function() { return isPositive(this) ? 1 : -1; };
Quadratic.prototype.SN__add_EQ = function(q) { return add_Quadratic_EQ(this, q); };
Quadratic.prototype.SN__subtract_EQ = function(q) { return add_Quadratic_EQ(this.SN_negate(), q); };
Quadratic.prototype.SN__add_Quadratic = function(q) { return add_Quadratic_Quadratic(this, q); };
Quadratic.prototype.SN__subtract_Quadratic = function(q) { return add_Quadratic_Quadratic(this.SN_negate(), q); };
Quadratic.prototype.SN_add = function(z) { return z.SN__add_Quadratic(this); };
Quadratic.prototype.SN_subtract = function(z) { return z.SN__subtract_Quadratic(this); };
sn.pluginApi.C.prototype.SN__add_Quadratic = sn.pluginApi.C.prototype.SN__add_Real;
sn.pluginApi.C.prototype.SN__subtract_Quadratic = sn.pluginApi.C.prototype.SN__subtract_Real;
sn.pluginApi.ER.prototype.SN__add_Quadratic = sn.pluginApi.pureVirtual;
sn.pluginApi.ER.prototype.SN__subtract_Quadratic = sn.pluginApi.pureVirtual;
sn.pluginApi.EQ.prototype.SN__add_Quadratic = function(q) { return add_Quadratic_EQ(q, this); };
sn.pluginApi.EQ.prototype.SN__subtract_Quadratic = function(q) { return add_Quadratic_EQ(q, this.SN_negate()); };
sn._bogusApi.EINative.prototype.SN__add_Quadratic = sn.pluginApi.EQ.prototype.SN__add_Quadratic;
sn._bogusApi.EINative.prototype.SN__subtract_Quadratic = sn.pluginApi.EQ.prototype.SN__subtract_Quadratic;
// ... and so on for EIBig, EI, EQRational.
Quadratic.prototype.SN__add_EINative = Quadratic.prototype.SN__add_EQ;
Quadratic.prototype.SN__subtract_EINative = Quadratic.prototype.SN__subtract_EQ;
// ...

// ... incomplete.
