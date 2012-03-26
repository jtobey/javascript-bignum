/*
    Function: implementJavaBigInteger(plugins, BigInteger)
    Exact integer implementation using the host's java.math.BigInteger
    class, for hosts that have such a class such as Rhino.
*/
// SchemeNumber = SchemeNumber.configure({ integerFactory: javaBigIntegerFactory });
function javaBigIntegerFactory(plugins) {
    "use strict";
    var g                        = plugins.get("es5globals");
    var uncurry                  = plugins.get("uncurry");
    var SchemeNumber             = plugins.get("SchemeNumber");
    var ExactInteger             = plugins.get("ExactInteger");
    var BigInteger               = java.math.BigInteger;
    var BigIntegerName           = String(BigInteger.ZERO.getClass().getName());
    var Number_toString = uncurry(g.Number.prototype.toString);
    var String_replace  = uncurry(g.String.prototype.replace);

    var Math_LN10    = g.Math.LN10;
    var Math_LN2     = g.Math.LN2;
    var Math_abs     = g.Math.abs;
    var Math_ceil    = g.Math.ceil;
    var Math_exp     = g.Math.exp;
    var Math_floor   = g.Math.floor;
    var Math_log     = g.Math.log;
    var Math_pow     = g.Math.pow;
    var Math_sqrt    = g.Math.sqrt;
    var _Infinity    = g.Infinity;

    var api = g.Object.create(null);

    var toBigInteger = plugins.get("Dispatch").defGeneric(
        "to:" + BigIntegerName, 1);

    var _MINUS_ONE = BigInteger("-1");

    var raise, numberToString, isZero, isEven, negate, reciprocal, divide, sign, nativeToInexact, inexactRectangular, ONE, PI, INEXACT_ZERO, MINUS_INFINITY;

    raise                    = plugins.get("raise");

    numberToString           = plugins.get("numberToString");
    isZero                   = plugins.get("isZero");
    isEven                   = plugins.get("isEven");
    negate                   = plugins.get("negate");
    reciprocal               = plugins.get("reciprocal");
    divide                   = plugins.get("divide");
    sign                     = plugins.get("sign");

    function onPluginsChanged(plugins) {
        nativeToInexact          = plugins.get("nativeToInexact");
        inexactRectangular       = plugins.get("inexactRectangular");
        ONE                      = plugins.get("ONE");
        PI                       = plugins.get("PI");
        INEXACT_ZERO             = plugins.get("INEXACT_ZERO");
        MINUS_INFINITY           = plugins.get("MINUS_INFINITY");
    }
    plugins.onChange.subscribe(onPluginsChanged);
    onPluginsChanged(plugins);

    function JavaBigInteger(bi) {
        //assert(this instanceof Wrapped);
        this._ = bi;
    }
    JavaBigInteger.prototype = new ExactInteger();

    function BigInteger_debug() {
        return BigIntegerName + "(" + this._.toString() + ")";
    }

    function BigInteger_numberToString(radix) {
        return String(this._.toString(radix || 10));
    }

    function BigInteger_valueOf() {
        return this._.doubleValue();
    }

    JavaBigInteger.prototype.toString = BigInteger_numberToString;
    JavaBigInteger.prototype.valueOf  = BigInteger_valueOf;

    function wrap(bi) {
        return new JavaBigInteger(bi);
    }

    function parseExactInteger(sign, string, radix) {
        var n = BigInteger(string, radix || 10);
        if (sign < 0)
            n = n.negate();
        return wrap(n);
    }

    function nativeToExactInteger(n) {
        // Use base 16 to avoid exponential notation.
        return wrap(BigInteger(Number_toString(n, 16), 16));
    }

    function ExactInteger_toBigInteger() {
        // XXX could build a byte array if we had reasonable
        // rnrs-arithmetic-bitwise support.
        return parseExactInteger(1, numberToString(this), 10);
    }

    function integerTooBig(digits) {
        raise("&implementation-restriction",
              "exact integer would exceed limit of " +
              (+SchemeNumber.maxIntegerDigits) +
              " digits; adjust SchemeNumber.maxIntegerDigits",
              digits);
    }

    function BigInteger_isEven() {
        return !this._.testBit(0);
    }
    function BigInteger_isOdd() {
        return this._.testBit(0);
    }
    function BigInteger_sign() {
        return this._.signum();
    }
    function BigInteger_negate() {
        return wrap(this._.negate());
    }
    function BigInteger_abs() {
        return wrap(this._.abs());
    }

    function BigInteger_compare(n) {
        return this._.compareTo(n._);
    }
    function BigInteger_add(n) {
        return wrap(this._.add(n._));
    }
    function BigInteger_subtract(n) {
        return wrap(this._.subtract(n._));
    }
    function BigInteger_multiply(n) {
        return wrap(this._.multiply(n._));
    }

    // (expt *this* *p*)
    function BigInteger_expt(p) {
        if (this._.signum() === 0)
            return (isZero(p) ? ONE : this);
        if (this._.equals(BigInteger.ONE))
            return ONE;
        if (this._.equals(_MINUS_ONE))
            return (isEven(p) ? ONE : this);

        // If p != p.valueOf() due to inexactness, our result would
        // exhaust memory, since |this| is at least 2.
        // XXX does not respect maxIntegerDigits.
        p = p.valueOf();
        var a = wrap(this._.pow(Math_abs(p)));
        return (p >= 0 ? a : reciprocal(a));
    }

    function divAndMod_BigInteger(n, d) {
        var dm = n._.divideAndRemainder(d._);
        var div = dm[0], mod = dm[1];
        if (mod.signum() < 0) {
            if (d._.signum() < 0) {
                div = div.add(BigInteger.ONE);
                mod = mod.subtract(d._);
            }
            else {
                div = div.subtract(BigInteger.ONE);
                mod = mod.add(d._);
            }
        }
        return [wrap(div), wrap(mod)];
    }

    function BigInteger_divAndMod(d) {
        return divAndMod_BigInteger(this, d);
    }
    function BigInteger_div(d) {
        return divAndMod_BigInteger(this, d)[0];
    }
    function BigInteger_mod(d) {
        return divAndMod_BigInteger(this, d)[1];
    }

    function logAbs(n) {
        var x = Math_abs(n.doubleValue());
        if (x !== _Infinity)
            return Math_log(x);
        var shift = n.bitLength() - 128;
        return Math_LN2 * shift + Math_log(
            Math_abs(n.shiftRight(shift).doubleValue()));
    }

    function BigInteger_log() {
        var s = this._.signum();
        if (s === 0)
            return MINUS_INFINITY;
        var x = nativeToInexact(logAbs(this._));
        return (s > 0 ? x : inexactRectangular(x, PI));
    }

    function BigInteger_sqrt() {
        var t = this._.doubleValue();
        if (t === 0)
            return this;
        var x = Math_sqrt(Math_abs(t));
        if (x === _Infinity)
            x = Math_exp(logAbs(this._) / 2);
        x = nativeToInexact(x);
        if (t < 0)
            return inexactRectangular(INEXACT_ZERO, x)
        return x;
    }

    function BigInteger_exactIntegerSqrt() {

        // I know of no use cases for this.  Be stupid.  Be correct.

        function doit(n, a) {
            while (true) {
                var dm = n.divideAndRemainder(a);
                var b = dm[0];
                var diff = a.subtract(b);
                // n == b*b + b*diff + dm[1], dm[1] < b+1

                if (diff.equals(BigInteger.ZERO))
                    return [ b, dm[1] ]; // n == b*b + dm[1]

                if (diff.equals(BigInteger.ONE))
                    // n == b*b + b + dm[1], dm[1] < b+1
                    return [ b, b.add(dm[1]) ];

                if (diff.equals(_MINUS_ONE))
                    // n == b*b - b + dm[1] == (b-1)^2 + b - 1 + dm[1]
                    return [ a, a.add(dm[1]) ];

                a = b.add(diff.shiftRight(1));
            }
        }

        switch (this._.signum()) {
        case -1:
            raise("&assertion", "negative number", this);
        case 0:
            return [ ZERO, ZERO ];
        case 1: default:
            break;
        }
        var l = logAbs(this._) / 2 / Math_LN2;

        if (l < 26) {
            // Use native arithmetic.
            var x = this.valueOf();
            var f = Math_floor(Math_sqrt(x));
            return [nativeToExactInteger(f), nativeToExactInteger(x - f * f)];
        }

        var shift = Math_ceil(l) - 63;
        var a = BigInteger.valueOf(Math_floor(Math_pow(2, l - shift)))
        var ret = doit(this._, a.shiftLeft(shift));
        return [wrap(ret[0]), wrap(ret[1])];
    }

    function BigInteger_gcdNonnegative(n) {
        return wrap(this._.gcd(n._));
    }

    function install() {
        "use strict";
        var disp                     = plugins.get("Dispatch");
        var Complex                  = plugins.get("Complex");
        var ExactInteger             = plugins.get("ExactInteger");
        var debug                    = plugins.get("debug");
        var retThis                  = plugins.get("retThis");

        disp.defClass(BigIntegerName, {ctor: JavaBigInteger});

        debug.def(JavaBigInteger, BigInteger_debug);

        toBigInteger.def(JavaBigInteger, retThis);
        toBigInteger.def(ExactInteger, ExactInteger_toBigInteger);

        function def1(generic, type, func) {
            plugins.get(generic).def(type, func);
        }
        function def2(generic, type1, type2, func) {
            plugins.get(generic).def(type1, type2, func);
        }

        def1("numberToString", JavaBigInteger, BigInteger_numberToString);

        def1("isEven", JavaBigInteger, BigInteger_isEven);
        def1("isOdd",  JavaBigInteger, BigInteger_isOdd);
        def1("sign",   JavaBigInteger, BigInteger_sign);
        def1("negate", JavaBigInteger, BigInteger_negate);
        def1("abs",    JavaBigInteger, BigInteger_abs);

        def2("compare",    JavaBigInteger, JavaBigInteger, BigInteger_compare);
        def2("add",        JavaBigInteger, JavaBigInteger, BigInteger_add);
        def2("subtract",   JavaBigInteger, JavaBigInteger, BigInteger_subtract);
        def2("multiply",   JavaBigInteger, JavaBigInteger, BigInteger_multiply);

        def2("expt",       JavaBigInteger, JavaBigInteger, BigInteger_expt);
        def1("log",        JavaBigInteger, BigInteger_log);
        def1("sqrt",       JavaBigInteger, BigInteger_sqrt);
        def1("exactIntegerSqrt", JavaBigInteger, BigInteger_exactIntegerSqrt);
        def2("divAndMod",  JavaBigInteger, JavaBigInteger,
             BigInteger_divAndMod);
        def2("div",        JavaBigInteger, JavaBigInteger, BigInteger_div);
        def2("mod",        JavaBigInteger, JavaBigInteger, BigInteger_mod);
        def2("gcdNonnegative", JavaBigInteger, JavaBigInteger,
             BigInteger_gcdNonnegative);
    }

    api.parseExactInteger        = parseExactInteger;
    api.nativeToExactInteger     = nativeToExactInteger;
    api.importExactInteger       = toBigInteger;
    api.install                  = install;
    return api;
}
