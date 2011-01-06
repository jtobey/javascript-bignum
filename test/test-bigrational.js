/* Test suite for class BigRational.
   Dependency: test/test.js from the BigInteger distribution.
*/

if (typeof BigRational === "undefined" || typeof runTests === "undefined") {

    /* Get require.js loaded by hook or by crook. */

    var top = "./";
    if (typeof require === "undefined") {
        var load = this.load;
        if (typeof load === "undefined") {
            load = function(file) {
                if (typeof readFile === "undefined") {
                    throw new Error("Must define BigRational, require, load, or readFile");
                }
                var code = readFile(file);
                if (code == "") {
                    throw new Error("Can not load " + file);
                }
                eval(code);
            };
        }
        try {
            var path = "test/require.js";
            if (!java.io.File || java.io.File(path).exists()) {
                load(path);
            }
        }
        catch (ex) {
        }
        if (typeof require === "undefined") {
            load("require.js");
            top = "../";
        }
    }
    if (require.paths) {
        require.paths.push(top, top + "test/");
    }

    BigRational = require("bigrational").BigRational;
    BRI         = require("bigrational").BigInteger;
    BigInteger  = require("biginteger").BigInteger;

    for (var i in require("test")) {
        this[i] = require("test")[i];
    }
}

function checkBigRational(r, n, d) {
    assertPropertyExists(r, "_n");
    assertPropertyExists(r, "_d");
    assertBigIntegerEquals(r._n, n);
    assertBigIntegerEquals(r._d, d);
    assertTrue(r._d.isPositive(), "denominator should be positive");
}

function assertBigIntegerEquals(got, expected) {
    //if (!(got instanceof BRI)) {
    if (!(got instanceof BigInteger)) {
        fail("expected a BigRationalInteger, got <" + got + ">");
    }
    if (BRI(expected).compare(got) != 0) {
        fail("expected <" + expected + "> got <" + got + ">");
    }
}

function testNoConstructor() {
    function createTest(n, d) {
        return function() { return new BigRational(n, d); };
    }

    var constructorError = /new BigRational/;

    assertThrows(createTest(1,2), constructorError);
    assertThrows(createTest(BRI.ONE, "2"), constructorError);
    assertThrows(createTest(BRI(4), BRI(-2)), constructorError);
}

function testConversion() {
    checkBigRational(BigRational(1,2), 1, 2);
    checkBigRational(BigRational(BRI.ONE, "2"), 1, 2);
    checkBigRational(BigRational(BRI(4), BRI(-2)), -2, 1);
    checkBigRational(BigRational("1/2"), 1, 2);
    checkBigRational(BigRational(".5"), 1, 2);
    checkBigRational(BigRational("-0.2"), -1, 5);
    checkBigRational(BigRational(BigRational("-0.2")), -1, 5);
    checkBigRational(BigRational(1.3), 13, 10);
    checkBigRational(BigRational("020.040"), 501, 25);
    checkBigRational(BigRational("12.04e-6"), 301, 25000000);
    checkBigRational(BigRational("-1e3"), -1000, 1);
}

function testParse() {

    var formatError = /^Invalid BigRational format: /;

    function bad(s) {
        function f() {
            BigRational.parse(s);
        }
        assertThrows(f, formatError);
    }
    function good(s, n, d) {
        checkBigRational(BigRational.parse(s), n, d);
    }

    bad("+ 4.2");
    good("+4.2", 21, 5);

    bad("-+342.5");
    good("-342.5", -685, 2);

    bad("34.25e-");
    good("34.25e-0", 137, 4);

    bad("34.25e1x");
    good("34.25e1", 685, 2);

    bad("12x3.4");
    good("123.4", 617, 5);

    bad("1.23x4");
    good("1.234", 617, 500);
}

function testPow() {
    checkBigRational(BigRational.pow("2/3", 3), 8, 27);
    checkBigRational(BigRational.pow("-2/3", 3), -8, 27);
    checkBigRational(BigRational.pow("2/3", -3), 27, 8);
}

function testBigRationalInteger() {
    checkBigRational(BRI(4).add(BigRational("1/2")), 9, 2);
    checkBigRational(BRI(4).add("1/2"), 9, 2);
}

function testLog() {
    assertEquals(BigRational.ONE.log(), 0);
    assertEqualsApprox(BigRational(10).log(), 2.302585092994046);
    assertEqualsApprox(BigRational.log(BigInteger(10).pow(1000)),
                       2302.585092994046);
    assertEqualsApprox(BigRational("10/3").pow(2000).log(), 2407.94560865187);
    assertEquals(BigRational.ZERO.log(), -Infinity);
    assertNaN(BigRational.M_ONE.log());
    assertNaN(BigRational("-22/7").pow(1999).log());
}

function TestBigRational() {
    this.start = new Date();
}

TestBigRational.prototype = {
    testNoConstructor: testNoConstructor,
    testConversion: testConversion,
    testParse: testParse,
    testPow: testPow,
    testBigRationalInteger: testBigRationalInteger,
    testLog: testLog,

/* Keep track of the time for each test */
    tearDown: function(show) {
        if (show) {
            var end = new Date();
            print("        Completed in " + (end - this.start) + "ms");
            this.start = new Date();
        }
    }
};

runTests(TestBigRational, +arguments[0]);
