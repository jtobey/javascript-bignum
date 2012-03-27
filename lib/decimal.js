/*
    Function: implementExactDecimal(plugins)
    Nonzero exact rational with terminating decimal, stored as exact
    integer n and native integer e where the value is n * 10^e.

    XXX to be debugged and documented.
*/

function implementExactDecimal(plugins) {
    "use strict";
    var g                        = plugins.get("es5globals");
    var uncurry                  = plugins.get("uncurry");
    var _undefined  = g.undefined;
    var _Infinity   = g.Infinity;
    var Math_min    = g.Math.min;
    var Math_LN10   = g.Math.LN10;
    var _Array      = g.Array;
    var _parseFloat = g.parseFloat;
    var _concat     = uncurry(_Array.prototype.concat);
    var _join       = uncurry(_Array.prototype.join);
    var _substring  = uncurry(g.String.prototype.substring);
    var ExactRational            = plugins.get("ExactRational");
    var ExactInteger             = plugins.get("ExactInteger");
    var nativeToExactInteger     = plugins.get("nativeToExactInteger");
    var debug                    = plugins.get("debug");
    var exp10                    = plugins.get("exp10");
    var divAndMod                = plugins.get("divAndMod");
    var sign                     = plugins.get("sign");
    var isZero                   = plugins.get("isZero");
    var isPositive               = plugins.get("isPositive");
    var isNegative               = plugins.get("isNegative");
    var eq                       = plugins.get("eq");
    var compare                  = plugins.get("compare");
    var abs                      = plugins.get("abs");
    var negate                   = plugins.get("negate");
    var square                   = plugins.get("square");
    var add                      = plugins.get("add");
    var multiply                 = plugins.get("multiply");
    var divide                   = plugins.get("divide");
    var log                      = plugins.get("log");
    var div                      = plugins.get("div");
    var isEven                   = plugins.get("isEven");
    var isOdd                    = plugins.get("isOdd");
    var gcdNonnegative           = plugins.get("gcdNonnegative");
    var numeratorAndDenominator  = plugins.get("numeratorAndDenominator");
    var exactIntegerSqrt         = plugins.get("exactIntegerSqrt");
    var raise                    = plugins.get("raise");
    var api = g.Object.create(null);

    var ZERO = nativeToExactInteger(0);
    var ONE  = nativeToExactInteger(1);
    var TEN  = nativeToExactInteger(10);

    // Value is ns[i] * 10^(e-i) wherever ns[i] !== undefined.
    // Value * 10^(-lim) known to be non-integer.
    function ExactDecimal(ns, e, lim) {
        //assert(this instanceof ExactDecimal);
        //assert(ns[0] !== undefined);
        //ns.forEach(function(n){assert(isInteger(n));assert(isExact(n));});
        //assert(e === Math.floor(e));
        //assert(lim > 0); assert(lim === Math.floor(lim));
        //assert(!isFinite(lim) || !isInteger(exp10(ns[0], e - lim)));
        this._ns  = ns;
        this._e   = e;
        this._lim = lim;
    }
    ExactDecimal.prototype = new ExactRational();

    function ExactDecimal_debug() {
        return "ExactDecimal(" + debug(this._ns[0]) + " e" + this._e + ")";
    }

    function ExactDecimal_valueOf() {
        return _parseFloat(stringToNumber(this._ns[0]) + "e" + this._e);
    }

    function ExactDecimal_toExponential(digits) {
        var e = this._e;
        var s = this._ns[0].toExponential(digits);
        var i = s.indexOf('e');
        if (i === -1) // Huh?
            s += 'e';
        else {
            e += Number(s.substring(i + 1));
            s = s.substring(0, i + 1);
        }
        return s + (e < 0 ? "" : "+") + e;
    }

    function zeroes(count) {
        var ret = _substring("000000000000000", 0, count & 15);
        if (count > 15) {
            ret += _join(new _Array((count >> 4) + 1), "0000000000000000");
        }
        return ret;
    }

    function ExactDecimal_toFixed(digits) {
        var n = this._ns[0];
        var sn = sign(n), minus;
        if (sn === 0)  // not supposed to happen.
            return n.toFixed(digits);

        if (sn > 0) {
            minus = "";
        }
        else {
            minus = "-";
            n = negate(n);
        }
        var e = this._e;
        var newDigits = (digits || 0) + e;
        var s = n.toFixed(newDigits), len, left;
        if (e === 0)
            return minus + s;
        len = s.length;
        // XXX Too many special cases.
    // 1.23e-4 (0.000123) toFixed(4)
    // digits=4, e=-6, newDigits=-2, s=100, len=3, want 0.0001
    // 2e-6 (0.000002) toFixed(1)
    // digits=1, e=-6, newDigits=-5, s=0, len=1, want 0.0
        // We have the right precision but must move the decimal point.
        if (e < 0) {
            // Move the (logical) decimal point left -e places.
            // Case 1: s contains an actual decimal point.
            if (newDigits > 0) {
                // Find the number of digits in s to the left of the point.
                left = len - newDigits - 1;
                // Case 1a: s extends as far left as needed.
                if (left > -e)
                    return (minus + s.substring(0, left + e) + "." +
                            s.substring(left + e, left) + s.substring(left + 1));
                // Case 1b: We need to prepend "0.0000...".
                return minus + "0." + zeroes(-e - left) + s.substring(0, left) +
                    s.substring(left + 1);
            }
            // Case 2: s does not contain a '.'.  The last digits should be 0.
            // Case 2a: It suffices to chop some zeroes.
            if (newDigits <= e)
                return minus + s.substring(0, (len > -e ? len + e : 1));
            // Case 2b: We must insert a "0.".
            if (len === -e)
                return minus + '0.' + s.substring(len + e, len + newDigits);
            // Case 2c: We must insert a decimal point.
            if (len > -e)
                return (minus + s.substring(0, len + e) + '.' +
                        s.substring(len + e, len + newDigits));
            if (len < -newDigits)
                return minus + "0." + zeroes(digits);
            return minus + "0." + zeroes(-e - len) +
                s.substring(0, len + newDigits);
        }
        // Move the (logical) decimal point right e places.
        // Case 3: s contains an actual decimal point.
        if (newDigits > 0) {
            // Find the number of digits in s to the left of the point.
            left = len - newDigits - 1;
            // Case 3a: The result needs a decimal point.
            if (digits > 0)
                return (minus + s.substring(0, left) +
                        s.substring(left + 1, left + 1 + e) + "." +
                        s.substring(left + 1 + e));
            // Case 3b: The result may need zeroes appended.
            return minus + s.substring(0, left) + s.substring(left + 1) +
                zeroes(-digits);
        }
        // Case 4: s does not contain '.'.
        return minus + zeroes(-newDigits);
    }

    // Skipping toPrecision, since the version in schemeNumber.js
    // works on output of toExponential.

    ExactDecimal.prototype.valueOf       = ExactDecimal_valueOf;
    ExactDecimal.prototype.toExponential = ExactDecimal_toExponential;
    ExactDecimal.prototype.toFixed       = ExactDecimal_toFixed;

    function makeDecimal(n, e) {
        return (isZero(n) ? n : new ExactDecimal([n], +e, _Infinity));
    }

    var importInteger = plugins.get("Dispatch").defGeneric("toExactDecimal", 1);

    function Integer_toExactDecimal(n) {
        return new ExactDecimal([n], 0, _Infinity);
    }

    var DECIMAL_ONE = new ExactDecimal([ONE], 0, 1);

    function tenExpt(e) {
        //assert(e === Math.floor(e));
        //assert(e >= 0);
        var ret = DECIMAL_ONE._ns[e];
        if (ret === _undefined) {
            ret = exp10(ONE, nativeToExactInteger(e));
            DECIMAL_ONE._ns[e] = ret;
        }
        return ret;
    }

    // Return ed * 10^-e as a canonical integer, or undefined if not an integer.
    // ed: ExactDecimal, e: native integer.
    function toE(ed, e) {
        var firstE = ed._e;
        var i, ret, dm;

        if (firstE >= e) {
            i = firstE - e;
            ret = ed._ns[i];
            if (ret === _undefined) {
                ret = exp10(ed._ns[0], nativeToExactInteger(i));
                ed._ns[i] = ret;
            }
            return ret;
        }

        if (e >= ed._lim)
            return _undefined;

        i = e - firstE;
        dm = divAndMod(ed._ns[0], tenExpt(i));
        if (isZero(dm[1])) {
            ed._e = e;
            ed._ns = _concat(_Array(i), ed._ns);
            ed._ns[0] = dm[0];
            return dm[0];
        }
        ed._lim = e;
        return _undefined;
    }

    function _toInteger(ed) {
        var ret = toE(ed, 0);
        if (ret === _undefined)
            raise("&assertion", "not an integer", ed);
        return ret;
    }

    function ExactDecimal_isInteger() {
        return toE(this, 0) !== _undefined;
    }

    // Returns ed's numerator (if which==0), its denominator (if which==1),
    // or both (if which==2).
    function numDen(ed, which) {
        var n = ed._ns[0], e = ed._e;
        if (e >= 0) {
            switch (which) {
            case 0: return multiply(n, tenExpt(e));
            case 1: return ONE;
            case 2: return [multiply(n, tenExpt(e)), ONE];
            }
        }
        var den = tenExpt(-e);
        var gcd = gcdNonnegative(abs(n), den);
        switch (which) {
        case 0: return divide(n, gcd);
        case 1: return divide(den, gcd);
        case 2: return [divide(n, gcd), divide(den, gcd)];
        }
    }

    function ExactDecimal_numerator()   { return numDen(this, 0); }
    function ExactDecimal_denominator() { return numDen(this, 1); }
    function ExactDecimal_numeratorAndDenominator() {
        return numDen(this, 2);
    }

    function getSameExponent(ed1, ed2) {
        if (ed1._e === ed2._e)
            return [ed1._ns[0], ed2._ns[0], ed1._e];
        if (ed1._e < ed2._e)
            return [ed1._ns[0], toE(ed2, ed1._e), ed1._e];
        return [toE(ed1, ed2._e), ed2._ns[0], ed2._e];
    }

    function ExactDecimal_eq(ed) {
        if (this === ed)
            return true;
        if (this._e === ed._e)
            return eq(this._ns[0], ed._ns[0]);

        var vals = getSameExponent(this, ed);
        if (eq(vals[0], vals[1])) {
            // XXX could merge _ns elements.
            if (ed._e < this._e) {
                ed._ns  = this._ns;
                ed._e   = this._e;
            }
            else {
                this._ns = ed._ns;
                this._e  = ed._e;
            }
            ed._lim = this._lim = Math_min(ed._lim, this._lim);
            return true;
        }
        return false;
    }

    function ExactDecimal_compare(ed) {
        if (this._e === ed._e)
            return compare(this._ns[0], ed._ns[0]);
        var vals = getSameExponent(this, ed);
        return compare(vals[0], vals[1]);
    }

    function compareRational(ed, n, d) {
        return compare(multiply(ed._ns[0], d),
                       exp10(n, nativeToExactInteger(-ed._e)));
    }

    function ExactDecimal_compare_Rational(q) {
        var nd = numeratorAndDenominator(q);
        return compareRational(this, nd[0], nd[1]);
    }

    function Rational_compare_ExactDecimal(ed) {
        var nd = numeratorAndDenominator(this);
        return -compareRational(ed, nd[0], nd[1]);
    }

    function ExactDecimal_sign() {
        return sign(this._ns[0]);
    }
    function ExactDecimal_isPositive() {
        return isPositive(this._ns[0]);
    }
    function ExactDecimal_isNegative() {
        return isNegative(this._ns[0]);
    }

    function ExactDecimal_negate() {
        return new ExactDecimal([negate(this._ns[0])], this._e, this._lim);
    }

    function ExactDecimal_square() {
        return new ExactDecimal([square(this._ns[0])], 2*this._e,
                                2*this._lim - 1);
    }

    function ExactDecimal_reciprocal() {
        if (isUnit(this._ns[0]))
            return new ExactDecimal(DECIMAL_ONE._ns, -this._e, 1);
        var nd = numDen(this, 2);
        return divide(nd[1], nd[0]);
    }

    function ExactDecimal_add(ed) {
        var vals = getSameExponent(this, ed);
        return makeDecimal(add(vals[0], vals[1]), vals[2]);
    }

    function addInteger(ed, i) {
        if (ed._e >= 0)
            return add(toE(ed, 0), i);
        return makeDecimal(add(ed._ns[0],
                               exp10(i, nativeToExactInteger(-ed._e))),
                           ed._e);
    }
    function ExactDecimal_add_Integer(i)  { return addInteger(this, i); }
    function Integer_add_ExactDecimal(ed) { return addInteger(ed, this); }

    function ExactDecimal_multiply(ed) {
        return new ExactDecimal([multiply(this._ns[0], ed._ns[0])],
                                this._e + ed._e, _Infinity);
    }

    function multiplyInteger(ed, i) {
        return makeDecimal(multiply(ed._ns[0], i), ed._e);
    }
    function ExactDecimal_multiply_Integer(i)  {
        return multiplyInteger(this, i);
    }
    function Integer_multiply_ExactDecimal(ed) {
        return multiplyInteger(ed, this);
    }

    function ExactDecimal_log() {
        return log(this._ns[0]) + this._e * Math_LN10;
    }

    function ExactDecimal_floor() {
        var n = toE(this, 0);
        if (n !== _undefined)
            return n;
        return div(this._ns[0], tenExpt(-this._e));
    }

    function _exp10(ed, e) {
        var exactE = add(e, nativeToExactInteger(ed._e));
        var newE = e + ed._e;
        // XXX what if newE === Infinity?
        if (eq(exactE, nativeToExactInteger(newE)))
            return new ExactDecimal(ed._ns, newE, ed._lim + e);
        raise("&implementation-restriction",
              "decimal exponent would exceed the native exact range");
    }

    function ExactDecimal_exp10(e) {
        return _exp10(this, e);
    }

    function ExactDecimal_divAndMod(ed2) {
        var ed1 = this;
        var e = Math_min(ed1._e, ed2._e);
        var dm = divAndMod(toE(ed1, e), toE(ed2, e));
        if (isInteger(dm[1]))
            return [dm[0], exp10(dm[1], nativeToExactInteger(e))];
        var nd = numeratorAndDenominator(dm[1]);
        return [dm[0], divide(exp10(nd[0], nativeToExactInteger(e)), nd[1])];
    }

    function ExactDecimal_gcdNonnegative(ed2) {
        var ed1 = this;
        var e = Math_min(ed1._e, ed2._e);
        if (e > 0)
            return new ExactDecimal([gcdNonnegative(toE(ed1, e), toE(ed2, e))],
                                    e, Math_min(ed1._lim, ed2._lim));
        return gcdNonnegative(_toInteger(ed1), _toInteger(ed2));
    }

    function ExactDecimal_isEven() {
        return this._e > 0 || isEven(_toInteger(this));
    }

    function ExactDecimal_isOdd() {
        return this._e <= 0 && isOdd(_toInteger(this));
    }

    function ExactDecimal_exactIntegerSqrt() {
        return exactIntegerSqrt(_toInteger(this));
    }

    function install() {
        var disp         = plugins.get("Dispatch");
        var EI           = plugins.get("ExactInteger");
        var EQ           = plugins.get("ExactRational");
        var retFalse     = plugins.get("retFalse");
        var retTrue      = plugins.get("retTrue");

        disp.defClass("ExactDecimal", {ctor: ExactDecimal});
        plugins.get("canonicalExactInteger").def(
            ExactDecimal, _toInteger);

        importInteger.def(ExactDecimal, plugins.get("retThis"));
        importInteger.def(EI, Integer_toExactDecimal);

        function def(name, type1, type2, func) {
            plugins.get(name).def(type1, type2, func);
        }
        function def1(name, func) {
            plugins.get(name).def(ExactDecimal, func);
        }
        function def2(name, func) {
            plugins.get(name).def(ExactDecimal, ExactDecimal, func);
        }

        def1("debug",                   ExactDecimal_debug);
        def1("isInteger",               ExactDecimal_isInteger);
        def1("numeratorAndDenominator", ExactDecimal_numeratorAndDenominator);
        def1("numerator",               ExactDecimal_numerator);
        def1("denominator",             ExactDecimal_denominator);
        def1("sign",                    ExactDecimal_sign);
        def1("isPositive",              ExactDecimal_isPositive);
        def1("isNegative",              ExactDecimal_isNegative);
        def1("negate",                  ExactDecimal_negate);
        def1("square",                  ExactDecimal_square);
        def1("reciprocal",              ExactDecimal_reciprocal);
        def1("log",                     ExactDecimal_log);
        def1("floor",                   ExactDecimal_floor);
        def1("isEven",                  ExactDecimal_isEven);
        def1("isOdd",                   ExactDecimal_isOdd);
        def1("exactIntegerSqrt",        ExactDecimal_exactIntegerSqrt);

        def2("eq",                      ExactDecimal_eq);
        def2("compare",                 ExactDecimal_compare);
        def("compare",    ExactDecimal, EQ, ExactDecimal_compare_Rational);
        def("compare",    EQ, ExactDecimal, Rational_compare_ExactDecimal);
        def2("add",                     ExactDecimal_add);
        def("add",        ExactDecimal, EI, ExactDecimal_add_Integer);
        def("add",        EI, ExactDecimal, Integer_add_ExactDecimal);
        def2("multiply",                ExactDecimal_multiply);
        def("multiply",   ExactDecimal, EI, ExactDecimal_multiply_Integer);
        def("multiply",   EI, ExactDecimal, Integer_multiply_ExactDecimal);
        def2("divAndMod",               ExactDecimal_divAndMod);
        def2("gcdNonnegative",          ExactDecimal_gcdNonnegative);

        def1("exp10",                   ExactDecimal_exp10);
    }

    api.makeDecimal              = makeDecimal;
    api.ONE                      = DECIMAL_ONE;
    api.importInteger            = importInteger;
    api.install                  = install;
    return api;
}

if (typeof exports !== "undefined")
    exports.implementExactDecimal = implementExactDecimal;

// sn=require('./schemeNumber').SchemeNumber; dec=require('./lib/decimal').implementExactDecimal(sn.plugins); dec.install();fn=sn.fn;ns=fn["number->string"];debug=sn.plugins.get("debug");md=dec.makeDecimal;1
