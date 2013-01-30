// Number type abstraction.  javacript-bignum version.  This does not
// actually use bignums, but it uses javascript-bignum's complex support.

if (typeof importScripts === "function") {
    importScripts('biginteger.js', 'schemeNumber.js');
}

var MoebiusMaths = (function() {
    var sn = SchemeNumber;
    var fn = sn.fn;
    var ns = fn["number->string"];

    // Number type abstraction.
    var crect = fn["make-rectangular"];
    var creal = fn["real-part"];
    var cimag = fn["imag-part"];
    var ceq = fn["="];
    var cadd = fn["+"];  // can handle more than 2 args
    var csub = fn["-"];  // can handle more than 2 args
    var cneg = fn["-"];
    var cmul = fn["*"];  // can handle more than 2 args
    var cdiv = fn["/"];  // can handle more than 2 args
    var crdiv = fn["/"];  // can handle more than 2 args
    var carg = fn.angle;
    var polar = fn["make-polar"];
    var cabs = fn.magnitude;
    var cabs2 = function(z) {
        var x = creal(z), y = cimag(z);
        return radd(rmul(x, x), rmul(y, y));
    };
    var radd = function(a, b) { return a + b; };
    var rsub = function(a, b) { return a - b; };
    var rneg = function(a)    { return -a; };
    var rmul = function(a, b) { return a * b; };
    var rdiv = function(a, b) { return a / b; };
    var rsin = Math.sin;
    var rcos = Math.cos;
    var log = Math.log;
    var min = Math.min;
    var max = Math.max;
    var lt0 = function(x) { return x < 0; };
    var gt0 = function(x) { return x > 0; };
    var le = function(x, y) { return x <= y; };
    var lt = function(x, y) { return x < y; };
    var ge = function(x, y) { return x >= y; };
    var gt = function(x, y) { return x > y; };
    var isOdd = function(n) { return (n & 1) == 1; };
    var finite = fn["finite?"];
    var isZero = fn["zero?"];
    var cIsZero = fn["zero?"];
    var abs = Math.abs;
    var ceil = Math.ceil;
    var sqrt = Math.sqrt;
    var PI = Math.PI;
    var ZERO = 0;
    var ONE = 1;
    var cZERO = 0;
    var cONE = 1;
    var INF = Infinity;

    return { crect: crect, creal: creal, cimag: cimag, ceq: ceq, cadd: cadd, csub: csub, cneg: cneg, cmul: cmul, cdiv: cdiv, crdiv: crdiv, carg: carg, polar: polar, cabs: cabs, cabs2: cabs2, radd: radd, rsub: rsub, rneg: rneg, rmul: rmul, rdiv: rdiv, rsin: rsin, rcos: rcos, log: log, min: min, max: max, lt0: lt0, gt0: gt0, le: le, lt: lt, ge: ge, gt: gt, isOdd: isOdd, finite: finite, isZero: isZero, cIsZero: cIsZero, abs: abs, ceil: ceil, sqrt: sqrt, PI: PI, ZERO: ZERO, ONE: ONE, cZERO: cZERO, cONE: cONE, INF: INF };
})();
