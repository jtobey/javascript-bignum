// Exact quadratic numbers.  Incomplete.

// I take quadratic to mean satisfying some quadratic equation with
// integer coefficients.  The quadratic numbers are the rationals
// along with their real square roots and anything you can get by
// adding such numbers.  The sum, difference, product, and quotient
// of two quadratic numbers, if real, are themselves quadratic.
// They are also called constructible numbers:
// http://en.wikipedia.org/wiki/Constructible_number

// The simplest irrational example is the square root of 2.

// The goal here is to represent them exactly in Scheme and return
// exact results where the standard requires it.

// Field operations (+ - * /) are relatively easy.  Comparisons (< >
// positive? negative?) are the hard ones and are not yet begun here.

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

// XXX core should do this when we pass our operators to a nice, new
// high-level interface, say sn.pluginApi.addType("Quadratic", Quadratic,
// {add_EQ:add_EQ,...}).
Quadratic.prototype.SN_debug = function() { return debug(this); };
Quadratic.prototype.SN_negate = function() { return negate(this); };
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
// ...
Quadratic.prototype.SN__add_EINative = Quadratic.prototype.SN__add_EQ;
Quadratic.prototype.SN__subtract_EINative = Quadratic.prototype.SN__subtract_EQ;
// ...

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

// ... incomplete.
