
// Exact rational with terminating decimal, stored as exact integers n
// and e where the value is n * 10^e and 10 does not divide n.

function implementExactDecimals(args) {

var ED                = args.className || "ExactDecimal";
var base              = args.baseName || "ExactRational";
var EI                = args.exactIntegerName || "ExactInteger";
var ExactRational     = args.interfaces.ExactRational;
var R                 = args.realName || "Real";
var isDefaultDecimal  = args.isDefaultDecimal;

var nativeToExactInteger = args.nativeToExactInteger;

var ZERO = nativeToExactInteger(0);
var ONE  = nativeToExactInteger(1);
var TWO  = nativeToExactInteger(2);
var TEN  = nativeToExactInteger(10);

function ExactDecimal(n, e) {
    //assert(this instanceof arguments.callee);
    //assert(n["SN_ isInteger"]());
    //assert(n["SN_ isExact"]());
    //assert(e["SN_ isInteger"]());
    //assert(e["SN_ isExact"]());
    //assert(!TEN["SN_ mod"](n)["SN_ isZero"]());
    this._n = n;
    this._e = e;
}

ExactDecimal.prototype = new ExactRational();

function DecimalOne(){}
function DecimalTen(){}

DecimalOne.prototype = new ExactDecimal(ONE, ZERO);
DecimalTen.prototype = new ExactDecimal(ONE, ONE);

var DECIMAL_ONE = new DecimalOne();
var DECIMAL_TEN = new DecimalTen();

// Use this when n is not divisible by 10.
function makeDecimal(n, e) {
    if (n["SN_ eq"](ONE)) {
        if (e["SN_ isZero"]())
            return DECIMAL_ONE;
        if (e["SN_ eq"](ONE))
            return DECIMAL_TEN;
    }
    return new ExactDecimal(n, e);
}

// XXX I need a better bootstrapping mechanism.
var ED_exp10 = null, toDecimal = null;
function parserExp10(ei, p) {
    return ED_exp10(toDecimal(ei), p);
}

function install(SN) {

var pluginApi = SN.pluginApi;

var interfaces         = pluginApi.interfaces;

var defClass           = pluginApi.defClass;
var defGeneric         = pluginApi.defGeneric;
var getConstructor     = pluginApi.getConstructor;

var stringToNumber     = pluginApi.stringToNumber;
var parseInexact       = pluginApi.parseInexact;
var toFlonum           = pluginApi.toFlonum;
var parseExactInteger  = pluginApi.parseExactInteger;
var nativeToExactInteger = pluginApi.nativeToExactInteger;
var divideReduced      = pluginApi.divideReduced;
var I                  = pluginApi.I;
var MINUS_I            = pluginApi.MINUS_I;
var exactRectangular   = pluginApi.exactRectangular;
var inexactRectangular = pluginApi.inexactRectangular;
var makePolar          = pluginApi.makePolar;

var pureVirtual        = pluginApi.pureVirtual;
var raise              = pluginApi.raise;
var raiseDivisionByExactZero= pluginApi.raiseDivisionByExactZero;

var complexExpt        = pluginApi.complexExpt;
var complexExpt_method = pluginApi.complexExpt_method;
var complexAcos        = pluginApi.complexAcos;
var complexAsin        = pluginApi.complexAsin;
var complexAtan        = pluginApi.complexAtan;
var complexLog         = pluginApi.complexLog;
var numberToBinary     = pluginApi.numberToBinary;
var nativeDenominatorLog2= pluginApi.nativeDenominatorLog2;
var nativeDenominator  = pluginApi.nativeDenominator;

var numberToString     = pluginApi.numberToString;
var isExact            = pluginApi.isExact;
var isInexact          = pluginApi.isInexact;
var toExact            = pluginApi.toExact;
var toInexact          = pluginApi.toInexact;
var isComplex          = pluginApi.isComplex;
var isReal             = pluginApi.isReal;
var isRational         = pluginApi.isRational;
var isInteger          = pluginApi.isInteger;
var isZero             = pluginApi.isZero;
var negate             = pluginApi.negate;
var reciprocal         = pluginApi.reciprocal;
var square             = pluginApi.square;
var debug              = pluginApi.debug;
var eq                 = pluginApi.eq;
var ne                 = pluginApi.ne;
var add                = pluginApi.add;
var subtract           = pluginApi.subtract;
var multiply           = pluginApi.multiply;
var divide             = pluginApi.divide;
var expt               = pluginApi.expt;
var realPart           = pluginApi.realPart;
var imagPart           = pluginApi.imagPart;
var exp                = pluginApi.exp;
var magnitude          = pluginApi.magnitude;
var angle              = pluginApi.angle;
var sqrt               = pluginApi.sqrt;
var log                = pluginApi.log;
var asin               = pluginApi.asin;
var acos               = pluginApi.acos;
var atan               = pluginApi.atan;
var sin                = pluginApi.sin;
var cos                = pluginApi.cos;
var tan                = pluginApi.tan;
var SN_isFinite        = pluginApi.isFinite;
var SN_isInfinite      = pluginApi.isInfinite;
var SN_isNaN           = pluginApi.isNaN;
var abs                = pluginApi.abs;
var isPositive         = pluginApi.isPositive;
var isNegative         = pluginApi.isNegative;
var sign               = pluginApi.sign;
var floor              = pluginApi.floor;
var ceiling            = pluginApi.ceiling;
var truncate           = pluginApi.truncate;
var round              = pluginApi.round;
var compare            = pluginApi.compare;
var gt                 = pluginApi.gt;
var lt                 = pluginApi.lt;
var ge                 = pluginApi.ge;
var le                 = pluginApi.le;
var divAndMod          = pluginApi.divAndMod;
var div                = pluginApi.div;
var mod                = pluginApi.mod;
var atan2              = pluginApi.atan2;
var numerator          = pluginApi.numerator;
var denominator        = pluginApi.denominator;
var isUnit             = pluginApi.isUnit;
var isEven             = pluginApi.isEven;
var isOdd              = pluginApi.isOdd;
var exactIntegerSqrt   = pluginApi.exactIntegerSqrt;
var exp10              = pluginApi.exp10;
var gcdNonnegative     = pluginApi.gcdNonnegative;

// Function that efficiently computes both a number's numerator and
// its denominator.
var numeratorAndDenominator = pluginApi.numeratorAndDenominator;

// Create it if it didn't already exist.
if (!numeratorAndDenominator) {
    numeratorAndDenominator = defGeneric("numeratorAndDenominator", 1);
    numeratorAndDenominator.def(R, function() {
        return [numerator(this), denominator(this)];
    });
    pluginApi.numeratorAndDenominator = numeratorAndDenominator;
}

var _isNaN   = isNaN;
var _parseFloat = parseFloat;
var natPow   = Math.pow;
var natExp   = Math.exp;
var LN10     = Math.LN10;

var ZERO  = nativeToExactInteger(0);
var ONE   = nativeToExactInteger(1);
var TEN   = nativeToExactInteger(10);

var Tens = [ONE, TEN];  // Cached positive powers of TEN.

defClass(ED, {ctor: ExactDecimal, extends: base});

function retThis()    { return this; }
function retFalse()   { return false; }
function retTrue()    { return true; }

SN_isFinite.def(ED,   retTrue);
SN_isInfinite.def(ED, retFalse);
SN_isNaN.def(ED,      retFalse);

ExactDecimal.prototype.valueOf = function() {
    return _parseFloat(stringToNumber(this._n) + "e" +
                       stringToNumber(this._e));
}

debug.def(ED, function() {
    return ED + "(" + debug(this._n) + " e " + debug(this._e) + ")";
});

function tenExpt(e) {
    //assert(isInteger(e));
    //assert(!isNegative(e));
    //assert(isExact(e));
    var string = numberToString(e);
    var ret = Tens[string];
    if (!ret) {
        ret = square(tenExpt(div(e, TWO)));
        if (isOdd(e))
            ret = multiply(TEN, ret);
        Tens[string] = ret;
    }
    return ret;
}

// Returns ed's numerator (if which==0), its denominator (if which==1),
// or both (if which==2).
function numDen(ed, which) {
    var n = ed._n, e = ed._e;
    if (!isNegative(e)) {
        switch (which) {
        case 0: return multiply(ed._n, tenExpt(e));
        case 1: return ONE;
        case 2: return [multiply(ed._n, tenExpt(e)), ONE];
        }
    }
    var num = ed._n, den = tenExpt(negate(e));
    var gcd = gcdNonnegative(abs(num), den); // XXX could perhaps optimize
    switch (which) {
    case 0: return divide(num, gcd);
    case 1: return divide(den, gcd);
    case 2: return [divide(num, gcd), divide(den, gcd)];
    }
}

numerator.def(              ED, function() { return numDen(this, 0); });
denominator.def(            ED, function() { return numDen(this, 1); });
numeratorAndDenominator.def(ED, function() { return numDen(this, 2); });

function EI_toDecimal(ei) {
    var e = ZERO, power = ONE, test = TEN;
    var dm;
    // Loop invariants: test == 10^power, original ei == ei * 10^e
    while (true) {
        dm = divAndMod(ei, test);
        if (!isZero(dm[1]))
            break;
        e = add(e, power);
        ei = dm[0];
        power = add(power, power);
        test = tenExpt(power);
    }
    while (true) {
        power = div(power, TWO);
        if (isZero(power))
            return makeDecimal(ei, e);
        test = tenExpt(power);
        dm = divAndMod(ei, test);
        if (isZero(dm[1])) {
            e = add(e, power);
            ei = dm[0];
        }
    }
}

toDecimal = pluginApi.toDecimal;
if (!toDecimal) {
    toDecimal = defGeneric("ExactDecimal_import", 1);
    toDecimal.def(EI, function() { return EI_toDecimal(this); });
    pluginApi.toDecimal = toDecimal;
}

// Returns the "_n" component.
var decimalSignificand = pluginApi.decimalSignificand;
if (!decimalSignificand) {
    decimalSignificand = defGeneric("decimalSignificand", 1);
    decimalSignificand.def(EI, function() {
        return decimalSignificand(EI_toDecimal(this));
    });
    pluginApi.decimalSignificand = decimalSignificand;
}

// Returns the "_e" component.
var decimalExponent = pluginApi.decimalExponent;
if (!decimalExponent) {
    decimalExponent = defGeneric("decimalExponent", 1);
    decimalExponent.def(EI, function() {
        return decimalExponent(EI_toDecimal(this));
    });
    pluginApi.decimalExponent = decimalExponent;
}

toDecimal.def(         ED, retThis);
decimalSignificand.def(ED, function() { return this._n; });
decimalExponent.def(   ED, function() { return this._e; });

ExactDecimal.prototype.toExponential = function(digits) {
    var e = this._e;
    var s = this._n.toExponential(digits);
    var i = s.indexOf('e');
    if (i === -1) // Huh?
        s += 'e';
    else {
        e = add(e, SN(s.substring(i + 1)));
        s = s.substring(0, i + 1);
    }
    return s + (isNegative(e) ? "" : "+") + numberToString(e);
};

// This exp10 takes an exact power.
ED_exp10 = function(ed, p) {
    return makeDecimal(ed._n, add(ed._e, p));
};

exp10.def(ED, function(p) { return ED_exp10(this, nativeToExactInteger(p)); });

if (isDefaultDecimal) {
    exp10.def(EI, function(p) {
        return ED_exp10(toDecimal(this), nativeToExactInteger(p));
    });
}

isInteger.def( ED, function() { return !isNegative(this._e); });
isUnit.def(    ED, function() { return isUnit(this._n) && isZero(this._e); });
sign.def(      ED, function() { return sign(this._n); });
isPositive.def(ED, function() { return isPositive(this._n); });
isNegative.def(ED, function() { return isNegative(this._n); });
isZero.def(    ED, function() { return isZero(this._n); });

function ED_compare(a, b) {
    var an = a._n, bn = b._n;

    // XXX could introduce compareAbs.
    var sa = sign(an);
    var signDiff = sa - sign(bn);
    if (signDiff !== 0)
        return (signDiff > 0 ? 1 : -1);

    var eDiff = subtract(a._e, b._e);
    if (isNegative(eDiff))
        bn = multiply(bn, tenExpt(negate(eDiff)));
    else
        an = multiply(an, tenExpt(eDiff));
    return sa * compare(an, bn);
}

compare.def(ED, ED, function(d) { return ED_compare(this, d); });

eq.def(ED, ED, function(d) {
    return eq(this._n, d._n) && eq(this._e, d._e);
});
// XXX should define ne, gt, lt, ge, and le in case ExactRational does
// so someday.

negate.def(ED, function() {
    return makeDecimal(negate(this._n), this._e);
});

function ED_reciprocal(ed) {
    if (eq(ONE, ed._n))
        return makeDecimal(ed._n, negate(ed._e));
    var nd = numDen(ed, 2);
    switch (sign(nd[0])) {
    case 0: raiseDivisionByExactZero();
    case 1: return divideReduced(nd[1], nd[0]);
    case -1: return divideReduced(negate(nd[1]), negate(nd[0]));
    }
}
reciprocal.def(ED, function() { return ED_reciprocal(this); });

function ED_add(an, ae, bn, be) {
    var eDiff = subtract(ae, be);
    var e;
    if (isNegative(eDiff)) {
        e = ae;
        bn = multiply(bn, tenExpt(negate(eDiff)));
    }
    else {
        e = be;
        an = multiply(an, tenExpt(eDiff));
    }
    return ED_exp10(toDecimal(add(an, bn)), e);
}

add.def(ED, ED, function(b) {
    return ED_add(this._n, this._e, b._n, b._e);
});
subtract.def(ED, ED, function(b) {
    return ED_add(this._n, this._e, negate(b._n), b._e);
});

function ED_add_EI(ed, ei) {
    var ed2 = toDecimal(ei);
    return ED_add(ed._n, ed._e, ed2._n, ed2._e);
}
add.def(EI, ED, function(ed) { return ED_add_EI(ed, this); });
add.def(ED, EI, function(ei) { return ED_add_EI(this, ei); });

subtract.def(EI, ED, function(ed) { return ED_add_EI(negate(ed), this); });
subtract.def(ED, EI, function(ei) { return ED_add_EI(this, negate(ei)); });

function ED_multiply(an, ae, bn, be) {
    if (isOdd(an) === isOdd(bn))  // not multiplying 5*2
        return makeDecimal(multiply(an, bn), add(ae, be));
    return ED_exp10(toDecimal(multiply(an, bn)), add(ae, be));
};
multiply.def(ED, ED, function(b) {
    return ED_multiply(this._n, this._e, b._n, b._e);
});
function ED_multiply_EI(ed, ei) {
    var ed2 = toDecimal(ei);
    return ED_multiply(ed._n, ed._e, ed2._n, ed2._e);
}
multiply.def(EI, ED, function(ed) { return ED_multiply_EI(ed, this); });
multiply.def(ED, EI, function(ei) { return ED_multiply_EI(this, ei); });

divide.def(ED, ED, function(b) {
    return multiply(this, ED_reciprocal(b));
});

numberToString.def(ED, function(radix, precision) {
    var nd = numeratorAndDenominator(this);
    var n = nd[0];
    var d = nd[1];
    // XXX from here down is copied verbatim from ExactRational
    // numberToString, which should learn about
    // numeratorAndDenominator.
    if (isUnit(d))
        return numberToString(n, radix, precision);
    return (numberToString(n, radix, precision) +
            "/" + numberToString(d, radix, precision));
});

function zeroes(count) {
    var ret = "000000000000000".substring(0, count & 15);
    if (count > 15)
        ret += new Array((count >> 4) + 1).join("0000000000000000");
    return ret;
}

ExactDecimal.prototype.toFixed = function(digits) {
    var n = this._n;
    var sn = sign(n), minus;
    if (sn === 0)
        return n.toFixed(digits);

    if (sn > 0) {
        minus = "";
    }
    else {
        minus = "-";
        n = negate(n);
    }
    var e = +this._e;
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
};

// Skipping toPrecision, since the version in schemeNumber.js works on
// output of toExponential.

// XXX TO DO: floor and friends, isEven, isOdd, gcdNonnegative.
}

var ret = {
    install: install,
    makeDecimal: makeDecimal,
    exp10: parserExp10,
    ONE: DECIMAL_ONE,
    TEN: DECIMAL_TEN,
};

if (isDefaultDecimal)
    ret.parserExp10 = parserExp10;

return ret;
}
// load("biginteger.js");load("schemeNumber.js");sn=SchemeNumber;fn=sn.fn;ns=fn["number->string"];debug=sn.pluginApi.debug;load("lib/decimal.js");var Decimals=implementExactDecimals({interfaces:sn.pluginApi.interfaces,nativeToExactInteger:sn.pluginApi.nativeToExactInteger,isDefaultDecimal:true}); Decimals.install(sn); var toDecimal=sn.pluginApi.toDecimal; var decimalSignificand=sn.pluginApi.decimalSignificand;var decimalExponent=sn.pluginApi.decimalExponent; var numeratorAndDenominator=sn.pluginApi.numeratorAndDenominator;var exp10=sn.pluginApi.exp10;1
