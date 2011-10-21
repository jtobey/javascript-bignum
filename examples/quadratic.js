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
Quadratic.prototype = new sn.pluginApi.ER();

var ROOT_START = "\u221A";  // Unicode Character 'SQUARE ROOT'
var ROOT_END = "";
//var ROOT_START = "sqrt("; var ROOT_END = ")";

Quadratic.prototype.toString = function() {
    var ret = "";
    for (var n in this._) {  // XXX should sort.
        var c = this._[n];
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
        if (fn["="](n, "1")) {
            ret += ns(c);
            continue;
        }

        // Construct NUM ROOT N / DEN,
        // omitting NUM if NUM=1, omitting / DEN if DEN=1.

        var num = fn.numerator(c);
        if (!fn["="](num, "1")) {
            ret += ns(num);
        }
        ret += ROOT_START + ns(n) + ROOT_END;

        if (!fn["integer?"](c)) {
            var den = fn.denominator(c);
            ret += "/" + ns(den);
        }
    }
    return ret;
};

function debug(q) {
    return "Quadratic(" + q.toString() + ")";
}

Quadratic.prototype.valueOf = function() {
    var ret = 0;
    for (var n in this._) {
        var c = this._[n];
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
        if (i == "1") {
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

function add_EQ(quad, rat) {
    return _toSN(_add(quad._, _upgrade_EQ(rat)));
}

function add_Quadratic(q, r) {
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
        n = sn(n);
        var tmp = _multiply_EQ(x, c);
        tmp = _multiply_single(tmp, n);
        ret = _add(ret, tmp);
    }
    return ret;
}

function multiply_EQ(quad, rat) {
    return _toSN(_multiply(quad._, _upgrade_EQ(rat)));
}

function multiply_Quadratic(q, r) {
    return _toSN(_multiply(q._, r._));
}

// Returns q and r such that x == q + r * sqrt(p) and neither q nor r
// contains the square root of a number divisible by p.
function _decompose(x, p) {
    var q = null;
    var r = null;
    for (var i in x) {
        var c = x[i];
        var n = sn(i);
        var dm = fn["div-and-mod"](n, p);
        //print("divmod(" + n + ", " + p + ") == " + dm);
        if (fn["zero?"](dm[1])) {
            r = r || {};
            r[dm[0]] = c;
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
function _isPositive(x, primes) {
    while (primes.length) {
        var p = primes.pop();
        var qr = _decompose(x, p);
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
        // We want to know whether Q + R * sqrt(P) > 0.
        // It is easier to find whether Q - R * sqrt(P) > 0.
        // Once we know that, we can multiply the two numbers and
        // determine whether the product is positive.
        // X > 0 iff the product and Q-R*sqrt(P) share the same sign.
        var mprr = _multiply_EQ(_multiply(r, r), p);
        _negate(mprr, mprr);
        var qqmprr = _add(_multiply(q, q), mprr);

        // qqmprr == Q^2 - P*R^2, the product described above.
        // Q-R*sqrt(P) is positive iff Q > R*sqrt(P).
        // Clearly, sqrt(P) is positive, so this falls into two cases:
        // If R>0, then test whether Q>0 and Q^2 > P*R^2.
        // If R<0, then test whether Q>0 or Q^2 < P*R^2.
        // We can tell which of Q^2 and P*R^2 is greater by testing the
        // sign of their difference, qqmprr.
        var a = _isPositive(qqmprr, primes.slice());
        var b = _isPositive(r, primes.slice());
        var c = _isPositive(q, primes.slice());
        return a == (b ? (c && a) : (c || a));
    }
    return fn["positive?"](x[1]);
}

function isPositive(q) {
    // Find all prime factors of numbers under radicals in x.
    var primes = [];
    var seen = {};
    for (var i in q._) {
        var factors = factorize(sn(i));
        for (var f in factors) {
            if (!seen[f]) {
                primes.push(sn(f));
                seen[f] = true;
            }
        }
    }
    primes.sort(fn["-"]);  // XXX should convert "-" result to JS number?
    return _isPositive(q._, primes);
}

// XXX core should do this when we pass our operators to a nice, new
// high-level interface, say sn.pluginApi.addType("Quadratic", Quadratic,
// {add_EQ:add_EQ,...}).
Quadratic.prototype.SN_debug = function() { return debug(this); };
Quadratic.prototype.SN_negate = function() { return negate(this); };
Quadratic.prototype.SN_isPositive = function() { return isPositive(this); };
Quadratic.prototype.SN_isNegative = function() { return !isPositive(this); };
Quadratic.prototype.SN_sign = function() { return isPositive(this) ? 1 : -1; };
Quadratic.prototype.SN__add_EQ = function(q) { return add_EQ(this, q); };
Quadratic.prototype.SN__subtract_EQ = function(q) { return add_EQ(this.SN_negate(), q); };
Quadratic.prototype.SN__add_Quadratic = function(q) { return add_Quadratic(this, q); };
Quadratic.prototype.SN__subtract_Quadratic = function(q) { return add_Quadratic(this.SN_negate(), q); };
Quadratic.prototype.SN_add = function(z) { return z.SN__add_Quadratic(this); };
Quadratic.prototype.SN_subtract = function(z) { return z.SN__subtract_Quadratic(this); };
sn.pluginApi.C.prototype.SN__add_Quadratic = sn.pluginApi.C.prototype.SN__add_Real;
sn.pluginApi.C.prototype.SN__subtract_Quadratic = sn.pluginApi.C.prototype.SN__subtract_Real;
sn.pluginApi.ER.prototype.SN__add_Quadratic = sn.pluginApi.pureVirtual;
sn.pluginApi.ER.prototype.SN__subtract_Quadratic = sn.pluginApi.pureVirtual;
sn.pluginApi.EQ.prototype.SN__add_Quadratic = function(q) { return add_EQ(q, this); };
sn.pluginApi.EQ.prototype.SN__subtract_Quadratic = function(q) { return add_EQ(q, this.SN_negate()); };
sn._bogusApi.EINative.prototype.SN__add_Quadratic = sn.pluginApi.EQ.prototype.SN__add_Quadratic;
sn._bogusApi.EINative.prototype.SN__subtract_Quadratic = sn.pluginApi.EQ.prototype.SN__subtract_Quadratic;
// ... and so on for EIBig, EI, EQRational.
Quadratic.prototype.SN__add_EINative = Quadratic.prototype.SN__add_EQ;
Quadratic.prototype.SN__subtract_EINative = Quadratic.prototype.SN__subtract_EQ;
// ...

// ... incomplete.
