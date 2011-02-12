// Test the SchemeNumber implementations of ECMA standard number
// formatting functions toFixed, toExponential, and toPrecision.

load("../biginteger.js");
load("../schemeNumber.js");

var exact=["0", "1", "-1", "123", "1e6", "2e-6", "3e12", "4e-12",
           "12.3", "1.23", "1.23e-4", "1.23e-9", "1.23e8", "5e20", "6.7e-21"];
var inexact=exact.concat(["1/3", "-22/7"]);
var i;
var count = 0;
var good = 0;

function testExact(x, meth, arg) {
    var js, sn;
    if (arg === undefined) {
        js = eval(x)[meth]();
        sn = SchemeNumber("#e"+x)[meth]();
    }
    else {
        js = eval(x)[meth](arg);
        sn = SchemeNumber("#e"+x)[meth](arg);
    }
    if (js == sn)
        good++;
    else
        print("#e" + x + " " + meth + "(" + arg + ") js=" + js + " sn=" + sn);
    count++;
}
function testInexact(x, meth, arg) {
    var js, sn;
    if (arg === undefined) {
        js = Number(eval(x)[meth]());
        sn = SchemeNumber("#i"+x)[meth]().valueOf();
    }
    else {
        js = Number(eval(x)[meth](arg));
        sn = SchemeNumber("#i"+x)[meth](arg);
    }
    if (sn == js)
        good++;
    else
        print("#i" + x + " " + meth + "(" + arg + ") js=" + js + " sn=" + sn);
    count++;
}
exact.forEach(function (x) {
        ["toFixed", "toExponential", "toPrecision"].forEach(function(meth) {
                testExact(x, meth, undefined);
            });
        for (i = 0; i < 16; i++) {
            if (i < 17 - Math.round(x).toString().length)
                testExact(x, "toFixed", i);
            testExact(x, "toExponential", i);
            testExact(x, "toPrecision", i + 1);
        }
    });
inexact.forEach(function(x) {
        ["toFixed", "toExponential", "toPrecision"].forEach(function(meth) {
                testInexact(x, meth, undefined);
            });
        for (i = 0; i < 21; i++) {
            testInexact(x, "toFixed", i);
            testInexact(x, "toExponential", i);
            testInexact(x, "toPrecision", i + 1);
        }
    });

print(good+"/"+count+" tests passed");
if (count == 0 || good != count)
    throw new Error("Test failed");
