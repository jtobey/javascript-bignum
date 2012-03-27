/*
    Function: implementHybridBigInteger(plugins, BigInteger)
    Exact integer implementation that uses native numbers up to
    2^53-1 and BigInteger objects beyond.
*/
function implementHybridBigInteger(plugins, BigInteger) {
    "use strict";
    var g                        = plugins.get("es5globals");
    var uncurry                  = plugins.get("uncurry");
    var SchemeNumber             = plugins.get("SchemeNumber");
    var ExactInteger             = plugins.get("ExactInteger");
    var BigIntegerName           = BigInteger.name || "BigInteger";
    var NativeExactIntegerName = "Proto" + BigIntegerName;

    var Number_toString  = uncurry(g.Number.prototype.toString);
    var String_replace   = uncurry(g.String.prototype.replace);
    var String_substring = uncurry(g.String.prototype.substring);

    var Math_LN10    = g.Math.LN10;
    var Math_abs     = g.Math.abs;
    var Math_ceil    = g.Math.ceil;
    var Math_exp     = g.Math.exp;
    var Math_floor   = g.Math.floor;
    var Math_pow     = g.Math.pow;
    var Math_sqrt    = g.Math.sqrt;

    var _parseInt    = g.parseInt;
    var _Number      = g.Number;
    var _String      = g.String;

    var api = g.Object.create(null);

    var toBigInteger = plugins.get("Dispatch").defGeneric("toBigInteger", 1);

    var toNativeExactInteger, raise, raiseDivisionByExactZero, numberToString, isExact, isZero, negate, reciprocal, divide, log, isNegative, sign, isEven, exp10, nativeToInexact, inexactRectangular, PI, INEXACT_ZERO, I;

    raise                    = plugins.get("raise");
    raiseDivisionByExactZero = plugins.get("raiseDivisionByExactZero");

    numberToString           = plugins.get("numberToString");
    isExact                  = plugins.get("isExact");
    isZero                   = plugins.get("isZero");
    negate                   = plugins.get("negate");
    reciprocal               = plugins.get("reciprocal");
    divide                   = plugins.get("divide");
    log                      = plugins.get("log");
    isNegative               = plugins.get("isNegative");
    sign                     = plugins.get("sign");
    isEven                   = plugins.get("isEven");
    exp10                    = plugins.get("exp10");

    function onPluginsChanged(plugins) {
        nativeToInexact          = plugins.get("nativeToInexact");
        inexactRectangular       = plugins.get("inexactRectangular");
        PI                       = plugins.get("PI");
        INEXACT_ZERO             = plugins.get("INEXACT_ZERO");
        I                        = plugins.get("I");
    }
    plugins.onChange.subscribe(onPluginsChanged);
    onPluginsChanged(plugins);

    function HybridBigInteger(){}
    HybridBigInteger.prototype = new ExactInteger();

    //
    // NativeExactInteger: Exact integers as native numbers.
    //

    function NativeExactInteger(x) {
        //assert(this instanceof NativeExactInteger);
        //assert(x === natFloor(x));
        this._ = x;
    }
    NativeExactInteger.prototype = new HybridBigInteger();

    function NativeExactInteger_debug() {
        return NativeExactIntegerName + "(" + this._ + ")";
    }

    function BigInteger_debug() {
        return BigIntegerName + "(" + this.toString() + ")";
    }

    function valueOf() {
        return this._;
    }

    NativeExactInteger.prototype.valueOf = valueOf;

    function ZeroType(){}     
    function OneType(){}
    function MinusOneType(){}

    ZeroType    .prototype = new NativeExactInteger(0);
    OneType     .prototype = new NativeExactInteger(1);
    MinusOneType.prototype = new NativeExactInteger(-1);

    function Zero_debug()     { return "Zero";     }
    function One_debug()      { return "One";      }
    function MinusOne_debug() { return "MinusOne"; }

    var ZERO      = new ZeroType();
    var ONE       = new OneType();
    var TWO       = new NativeExactInteger(2);
    var MINUS_ONE = new MinusOneType();

    var NativeExactIntegerSmall = [ ZERO, ONE, TWO ];

    function toNativeExactInteger(n) {
        //assert(natFloor(n) === n);
        return NativeExactIntegerSmall[n] ||
            (n === -1 ? MINUS_ONE : new NativeExactInteger(n));
    }

    function parseExactInteger(sign, string, radix) {
        var n = _parseInt(string, radix || 10);

        if (n < 9007199254740992)
            return toNativeExactInteger(sign * n);

        // Trim leading zeroes to avoid BigInteger treating "0c" and
        // "0b" as radix prefixes.
        n = BigInteger.parse(String_replace(string, /^0+/, ""), radix);
        if (sign < 0)
            n = n.negate();
        return n;
    }

    function nativeToExactInteger(n) {
        //assert(n === natFloor(n));
        if (n < 9007199254740992 && n > -9007199254740992)
            return toNativeExactInteger(n);
        // Use base 16 to avoid exponential notation.
        return BigInteger.parse(Number_toString(n, 16), 16);
    }

    function NEI_numberToString(radix, precision) {
        return Number_toString(this._, radix || 10);
    }

    function Zero_compare(x) {
        return -sign(x);
    }

    function Zero_divide(z) {
        if (isZero(z) && isExact(z))
            raiseDivisionByExactZero();
        return this;
    }

    function MinusOne_expt_EI(n) {
        return (isEven(n) ? ONE : MINUS_ONE);
    }

    function NEI_isPositive() {
        return this._ > 0;
    }
    function NEI_isNegative() {
        return this._ < 0;
    }
    function NEI_sign() {
        return (this._ > 0 ? 1 : (this._ == 0 ? 0 : -1));
    }

    function NEI_isEven() {
        return (this._ & 1) === 0;
    }
    function NEI_isOdd() {
        return (this._ & 1) === 1;
    }

    function NEI_eq(n) {
        return this._ === n._;
    }
    function NEI_ne(n) {
        return this._ !== n._;
    }
    function NEI_compare(n) {
        return (this._ === n._ ? 0 : (this._ > n._ ? 1 : -1));
    }

    function add_Natives(a, b) {
        var ret = a + b;
        if (ret > -9007199254740992 && ret < 9007199254740992)
            return toNativeExactInteger(ret);
        return BigInteger.add(a, b);
    }

    function NEI_add(n) {
        return add_Natives(this._, n._);
    }
    function NEI_negate() {
        return toNativeExactInteger(-this._);
    }
    function NEI_abs() {
        return (this._ < 0 ? toNativeExactInteger(-this._) : this);
    }
    function NEI_subtract(n) {
        return add_Natives(this._, -n._);
    }

    function divAndMod_NativeExactInteger(t, x, which) {
        if (x === 0)
            raiseDivisionByExactZero();

        var div = (x > 0 ? Math_floor(t / x) : Math_ceil(t / x));
        if (which === 0)
            return toNativeExactInteger(div);

        var tmp = x * div;
        var mod;

        if (tmp > -9007199254740992)
            mod = t - tmp;
        else if (div > 0)
            mod = (t - x) - (x * (div - 1));
        else
            mod = (t + x) - (x * (div + 1));

        mod = toNativeExactInteger(mod);
        if (which === 1)
            return mod;

        return [toNativeExactInteger(div), mod];
    }

    function NEI_div(n) {
        return divAndMod_NativeExactInteger(this._, n._, 0);
    }
    function NEI_mod(n) {
        return divAndMod_NativeExactInteger(this._, n._, 1);
    }
    function NEI_divAndMod(n) {
        return divAndMod_NativeExactInteger(this._, n._, 2);
    }

    function NEI_exactIntegerSqrt() {
        if (isNegative(this))
            raise("&assertion", "negative number", this);
        var n = Math_floor(Math_sqrt(this._));
        return [toNativeExactInteger(n), toNativeExactInteger(this._ - n * n)];
    }

    function NEI_toBigInteger() {
        return BigInteger(this._);
    }
    function EI_toBigInteger() {
        return BigInteger.parse(numberToString(this));
    }

    function integerTooBig(digits) {
        raise("&implementation-restriction",
              "exact integer would exceed limit of " +
              (+SchemeNumber.maxIntegerDigits) +
              " digits; adjust SchemeNumber.maxIntegerDigits",
              digits);
    }

    // (expt *this* *p*) where the absolute value of *this* is at
    // least 2.  (expt is specialized for -1, 0, and 1.)
    function Hybrid_expt(p) {
        //assert(ge(abs(this), 2));

        // Return this integer to the power of p.

        var s = sign(p);

        // If p != p.valueOf() due to inexactness, our result would
        // exhaust memory, since |n| is at least 2.
        p = Math_abs(p);

        var result = Math_pow(this, p);
        var a;
        if (result > -9007199254740992 && result < 9007199254740992) {
            a = toNativeExactInteger(result);
        }
        else {
            var newLog = log(this) * p;
            if (newLog > SchemeNumber.maxIntegerDigits * Math_LN10)
                integerTooBig(newLog / Math_LN10);

            a = toBigInteger(this).pow(p);
        }
        return (s > 0 ? a : reciprocal(a));
    }

    function NEI_multiply(n) {
        var ret = this._ * n._;
        if (ret > -9007199254740992 && ret < 9007199254740992)
            return toNativeExactInteger(ret);
        return BigInteger(this._).multiply(n._);
    }
    function NEI_square() {
        var ret = this._ * this._;
        if (ret < 9007199254740992)
            return toNativeExactInteger(ret);
        return BigInteger(this._).square();
    }

    // 2 to the power 53, top of the range of consecutive integers
    // representable exactly as native numbers.
    var FIRST_BIG_INTEGER = BigInteger(9007199254740992);

    function reduceBigInteger(n) {
        if (n.compareAbs(FIRST_BIG_INTEGER) >= 0)
            return n;
        return toNativeExactInteger(n.toJSValue());
    }

    function BigInteger_numberToString(radix) {
        return this.toString(radix);
    }

    function EI_compare(n) {
        return toBigInteger(this).compare(toBigInteger(n));
    }

    function EI_add(n) {
        return reduceBigInteger(toBigInteger(this).add(toBigInteger(n)));
    }
    function EI_subtract(n) {
        return reduceBigInteger(toBigInteger(this).subtract(toBigInteger(n)));
    }
    function EI_multiply(n) {
        return reduceBigInteger(toBigInteger(this).multiply(toBigInteger(n)));
    }

    function EI_divAndMod_EI(n, d) {
        d = toBigInteger(d);
        var dm = toBigInteger(n).divRem(d);
        var div = dm[0];
        var mod = dm[1];

        if (mod.isNegative()) {
            mod = mod.add(d);
            div = div.prev();
        }
        return [reduceBigInteger(div), reduceBigInteger(mod)];
    }

    function EI_divAndMod(d) {
        return EI_divAndMod_EI(this, d);
    }
    function EI_div(d) {
        return EI_divAndMod_EI(this, d)[0];
    }
    function EI_mod(d) {
        return EI_divAndMod_EI(this, d)[1];
    }

    function BigInteger_log() {
        var x = nativeToInexact(this.abs().log());
        return this.isPositive() ? x : inexactRectangular(x, PI);
    }

    function NEI_exp10(e) {
        if (this._ === 0 || isZero(e))
            return this;

        e = +e;
        if (Math_abs(e) > SchemeNumber.maxIntegerDigits)
            integerTooBig(Math_abs(e));

        if (e < 0) {
            var num = _String(this._);
            var i = num.length - 1;

            if (num[i] === '0') {
                while (num[i] === '0' && e < 0) {
                    e += 1;
                    i -= 1;
                }
                num = toNativeExactInteger(
                    _Number(String_substring(num, 0, i + 1)));
                if (e === 0)
                    return num;
            }
            else {
                num = this;
            }

            var den;
            if (e < -15)
                den = BigInteger.ONE.exp10(-e);
            else
                // Could make this an array lookup.
                den = toNativeExactInteger(
                    _Number(String_substring("1000000000000000", 0, 1 - e)));
            return divide(num, den);
        }
        if (e < 16) {
            // Could make substring+parseInt an array lookup.
            var result = this._ * _parseInt(
                String_substring("1000000000000000", 0, e + 1));
            if (result > -9007199254740992 && result < 9007199254740992)
                return toNativeExactInteger(result);
        }
        return BigInteger(this._).exp10(e);
    }

    function BigInteger_exp10(e) {
        switch (sign(e)) {
        case 0:  return this;
        case -1: return divide(this, exp10(ONE, negate(e)));
        case 1:
            e = +e;
            if (e > SchemeNumber.maxIntegerDigits)
                integerTooBig(e);
            return this.exp10(e);
        }
    }

    function BigInteger_sqrt() {
        //assert(!isZero(this));
        var mag = nativeToInexact(Math_exp(this.abs().log() / 2));
        if (this.isNegative())
            return inexactRectangular(INEXACT_ZERO, mag);
        return mag;
    }

    function BigInteger_exactIntegerSqrt() {

        // I know of no use cases for this.  Be stupid.  Be correct.

        //assert(this.compareAbs(FIRST_BIG_INTEGER) >= 0);

        function doit(n, a) {
            while (true) {
                var dm = n.divRem(a);
                var b = dm[0];
                var diff = a.subtract(b);
                // n == b*b + b*diff + dm[1], dm[1] < b+1

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

        if (this.isNegative())
            raise("&assertion", "negative number", this);
        var l = this.log() / 2 / Math_LN10;
        var a = BigInteger(Number_toString(Math_pow(10, l - Math_floor(l)))
                           + "e" + Math_floor(l));
        var ret = doit(this, a);
        return [ reduceBigInteger(ret[0]), reduceBigInteger(ret[1]) ];
    }

    function gcdNative(a, b) {
        //assert(a >= 0 && b >= 0)
        var c;
        while (a !== 0) {
            c = a;
            a = b % a;
            b = c;
        }
        return toNativeExactInteger(b);
    }

    // a and b must be nonnegative, exact integers.
    function NEI_gcdNonnegative(n) {
        //assert(!isNegative(this));
        //assert(!isNegative(n));
        return gcdNative(this._, n._);
    }

    function EI_gcdNonnegative(n) {
        //assert(!isNegative(this));
        //assert(!isNegative(n));

        var a = toBigInteger(this);
        if (a.isZero())
            return n;

        var b = toBigInteger(n);
        var c;

        while (true) {
            c = a;
            a = b.remainder(a);
            if (a.isZero())
                return c;
            b = c;
            if (b.compareAbs(FIRST_BIG_INTEGER) < 0)
                return gcdNative(a.valueOf(), b.valueOf());
        }
    }

    function retI()           { return I; }
    function negateThis()     { return negate(this); }
    function reciprocalThis() { return reciprocal(this); }

    function install(isDefaultInteger) {
        "use strict";
        var disp                     = plugins.get("Dispatch");
        var Complex                  = plugins.get("Complex");
        var Real                     = plugins.get("Real");
        var EI                       = plugins.get("ExactInteger");
        var Hybrid                   = HybridBigInteger;
        var NEI                      = NativeExactInteger;
        var debug                    = plugins.get("debug");

        var retTrue, retFalse, retThis, retFirst, retZero, retOne, sign, negate, raiseDivisionByExactZero, Complex_expt, reciprocal;
        retTrue                  = plugins.get("retTrue");
        retFalse                 = plugins.get("retFalse");
        retThis                  = plugins.get("retThis");
        retFirst                 = plugins.get("retFirst");
        retZero                  = plugins.get("retZero");
        retOne                   = plugins.get("retOne");
        sign                     = plugins.get("sign");
        negate                   = plugins.get("negate");
        raiseDivisionByExactZero = plugins.get("raiseDivisionByExactZero");
        Complex_expt             = plugins.get("Complex_expt");
        reciprocal               = plugins.get("reciprocal");

        disp.defClass("Zero",     {ctor: ZeroType});
        disp.defClass("One",      {ctor: OneType});
        disp.defClass("MinusOne", {ctor: MinusOneType});

        disp.defClass("HybridBigInteger", {ctor: HybridBigInteger});
        disp.defClass("ProtoBigInteger", {ctor: NativeExactInteger});
        disp.defClass("BigInteger", {ctor: BigInteger,
                                     base: "HybridBigInteger"});

        debug.def(NativeExactInteger, NativeExactInteger_debug);
        debug.def(BigInteger, BigInteger_debug);

        function def1(generic, type, func) {
            plugins.get(generic).def(type, func);
        }
        function def2(generic, type1, type2, func) {
            plugins.get(generic).def(type1, type2, func);
        }
        function defBigUnary(name) {
            plugins.get(name).def(BigInteger, BigInteger.prototype[name]);
        }

        def1("isZero",     ZeroType, retTrue);
        def1("isPositive", ZeroType, retFalse);
        def1("isNegative", ZeroType, retFalse);
        def2("compare",    ZeroType, Real, Zero_compare);
        def2("compare",    Real, ZeroType, sign);
        def2("add",        ZeroType, Complex, retFirst);
        def2("add",        Complex, ZeroType, retThis);
        def2("subtract",   ZeroType, Complex, negate);
        def2("subtract",   Complex, ZeroType, retThis);
        def1("negate",     ZeroType, retThis);
        def1("abs",        ZeroType, retThis);
        def2("multiply",   ZeroType, Complex, retThis);
        def2("multiply",   Complex, ZeroType, retFirst);
        def1("square",     ZeroType, retThis);
        def1("reciprocal", ZeroType, raiseDivisionByExactZero);
        def2("divide",     Complex, ZeroType, raiseDivisionByExactZero);
        def2("divide",     ZeroType, Complex, Zero_divide);
        def2("expt",       Complex, ZeroType, retOne);
        def2("expt",       ZeroType, Complex, Complex_expt);

        def1("sqrt",       ZeroType, retThis);
        def1("exp",        ZeroType, retOne);
        def1("sin",        ZeroType, retThis);
        def1("cos",        ZeroType, retOne);
        def1("tan",        ZeroType, retThis);
        def1("asin",       ZeroType, retThis);
        def1("atan",       ZeroType, retThis);

        def1("isPositive", OneType, retTrue);
        def1("isNegative", OneType, retFalse);
        def1("isUnit",     OneType, retTrue);
        def1("abs",        OneType, retThis);
        def2("multiply",   OneType, Complex, retFirst);
        def2("multiply",   Complex, OneType, retThis);
        def1("reciprocal", OneType, retThis);
        def2("divide",     OneType, Complex, reciprocal);
        def2("divide",     Complex, OneType, retThis);
        def1("square",     OneType, retThis);
        def2("expt",       OneType, Complex, retThis);
        def2("expt",       Complex, OneType, retThis);
        def1("sqrt",       OneType, retThis);
        def1("log",        OneType, retZero);
        def1("acos",       OneType, retZero);

        def1("isPositive", MinusOneType, retFalse);
        def1("isNegative", MinusOneType, retTrue);
        def1("isUnit",     MinusOneType, retTrue);
        def1("abs",        MinusOneType, retOne);
        def2("multiply",   MinusOneType, Complex, negate);
        def2("multiply",   Complex, MinusOneType, negateThis);
        def1("reciprocal", MinusOneType, retThis);
        def1("square",     MinusOneType, retOne);
        def1("sqrt",       MinusOneType, retI);
        def2("expt",       Complex, MinusOneType, reciprocalThis);
        def2("expt",       MinusOneType, EI, MinusOne_expt_EI);

        def1("isZero",     NEI, retFalse);  // The zero class overrides.
        def1("isPositive", NEI, NEI_isPositive);
        def1("isNegative", NEI, NEI_isNegative);
        def1("sign",       NEI, NEI_sign);

        def1("isEven",     NEI, NEI_isEven);
        def1("isOdd",      NEI, NEI_isOdd);

        def2("eq",         NEI, NEI, NEI_eq);
        def2("ne",         NEI, NEI, NEI_ne);
        def2("compare",    NEI, NEI, NEI_compare);

        def2("add",        NEI, NEI, NEI_add);
        def1("negate",     NEI, NEI_negate);
        def1("abs",        NEI, NEI_abs);
        def2("subtract",   NEI, NEI, NEI_subtract);

        def2("div",        NEI, NEI, NEI_div);
        def2("mod",        NEI, NEI, NEI_mod);
        def2("divAndMod",  NEI, NEI, NEI_divAndMod);

        def1("exactIntegerSqrt", NEI, NEI_exactIntegerSqrt);

        toBigInteger.def(BigInteger, retThis);
        toBigInteger.def(NEI,        NEI_toBigInteger);
        toBigInteger.def(EI,         EI_toBigInteger);

        def2("expt",       Hybrid, Hybrid, Hybrid_expt);

        def2("multiply",   NEI, NEI, NEI_multiply);
        def1("square",     NEI, NEI_square);

        def1("numberToString", NEI, NEI_numberToString);
        def1("numberToString", BigInteger, BigInteger_numberToString);

        defBigUnary("isZero");
        defBigUnary("isEven");
        defBigUnary("isOdd");
        defBigUnary("sign");
        defBigUnary("isUnit");
        defBigUnary("isPositive");
        defBigUnary("isNegative");
        defBigUnary("negate");
        defBigUnary("abs");
        defBigUnary("square");

        def1("log",        BigInteger, BigInteger_log);
        def1("exp10",      NEI, NEI_exp10);
        def1("exp10",      BigInteger, BigInteger_exp10);
        def1("sqrt",       BigInteger, BigInteger_sqrt);
        def1("exactIntegerSqrt", BigInteger, BigInteger_exactIntegerSqrt);
        def2("gcdNonnegative", NEI, NEI, NEI_gcdNonnegative);
        def2("gcdNonnegative", Hybrid, Hybrid, EI_gcdNonnegative);

        if (isDefaultInteger) {
            def2("compare",    EI, EI, EI_compare);
            def2("add",        EI, EI, EI_add);
            def2("subtract",   EI, EI, EI_subtract);
            def2("multiply",   EI, EI, EI_multiply);
            def2("divAndMod",  EI, EI, EI_divAndMod);
            def2("div",        EI, EI, EI_div);
            def2("mod",        EI, EI, EI_mod);
            def2("gcdNonnegative", EI, EI, EI_gcdNonnegative);
        }
    }

    api.parseExactInteger        = parseExactInteger;
    api.nativeToExactInteger     = nativeToExactInteger;
    api.toBigInteger             = toBigInteger;
    api.install                  = install;
    return api;
}

if (typeof exports !== "undefined")
    exports.implementHybridBigInteger = implementHybridBigInteger;
