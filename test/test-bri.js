// Copyright (c) 2009 Matthew Crumley <email@matthewcrumley.com>
// Copyright (c) 2011 John Tobey <John.Tobey@gmail.com>
load("../biginteger.js");
load("../bigrational.js");
load("test.js");

load("testValues.js");
load("powValues.js");

testValues1 = testValues1.map(BigRationalInteger);
testValues2 = testValues2.map(BigRationalInteger);
shortTestValues = shortTestValues.map(BigRationalInteger);
powValues = powValues.map(BigRationalInteger);

function getAnswers(file) {
	file = "expected/" + file + ".js";
	if (this.readFile) {
		eval(readFile(file));
	}
	else {
		load(file);
	}
	return answers;
}

var addResults = getAnswers("add");
var subtractResults = getAnswers("subtract");
var multiplyResults = getAnswers("multiply");
var divRemResults = getAnswers("divRem");
var negateResults = getAnswers("negate");
var nextResults = getAnswers("next");
var prevResults = getAnswers("prev");
var absResults = getAnswers("abs");
var compareAbsResults = getAnswers("compareAbs");
var compareResults = getAnswers("compare");
var isUnitResults = getAnswers("isUnit");
var isZeroResults = getAnswers("isZero");
var isPositiveResults = getAnswers("isPositive");
var isNegativeResults = getAnswers("isNegative");
var squareResults = getAnswers("square");
var isEvenResults = getAnswers("isEven");
var isOddResults = getAnswers("isOdd");
var signResults = getAnswers("sign");
var exp10Results = getAnswers("exp10");
var powResults = getAnswers("pow");
var modPowResults = getAnswers("modPow");

function runUnaryOperationTest(expect, test, values) {
	values = values || testValues1;

	var n = values.length;
	for (var i = 0; i < n; i++) {
		var expected = expect[i];
		var result = test(values[i]);
		if (result instanceof BigInteger) {
			checkBigInteger(result);
		}
		if (expected !== result) {
			fail(i + ": expected <" + expected + "> got <" + result + ">");
		}
	}
}

function runBinaryOperationTest(expect, test, values1, values2) {
	values1 = values1 || testValues1;
	values2 = values2 || testValues2;

	var n1 = values1.length;
	var n2 = values2.length;
	for (var i = 0; i < n1; i++) {
		for (var j = 0; j < n2; j++) {
			var expected = expect[i * n2 + j];
			var result = test(values1[i], values2[j]);
			if (expected !== result) {
				fail(i + "," + j + ": expected <" + expected + "> got <" + result + ">");
			}
		}
	}
}

function runTrinaryOperationTest(expect, test, values1, values2, values3) {
	values1 = values1 || testValues1;
	values2 = values2 || testValues2;
	values3 = values3 || shortTestValues;

	var n1 = values1.length;
	var n2 = values2.length;
	var n3 = values3.length;
	for (var i = 0; i < n1; i++) {
		for (var j = 0; j < n2; j++) {
			for (var k = 0; k < n3; k++) {
				var expected = expect[(i * n2 + j) * n3 + k];
				var result = test(values1[i], values2[j], values3[k]);
				if (result instanceof BigInteger) {
					checkBigInteger(result);
				}
				if (expected !== result) {
					fail([i,j,k].join(",") + ": expected <" + expected + "> got <" + result + ">");
				}
			}
		}
	}
}

function runShortBinaryOperationTest(expect, test) {
	runBinaryOperationTest(expect, test, testValues1, shortTestValues);
}

function checkBigInteger(n, d, s) {
	assertPropertyExists(n, "_d");
	assertPropertyExists(n, "_s");

	var sign = n._s;
	var digits = n._d;

	if (sign === 0) {
		assertTrue(digits.length === 0, "sign is zero, but array length is " + digits.length);
	}
	if (digits.length === 0) {
		assertTrue(sign === 0, "array length is zero, but sign is " + sign);
	}
	assertTrue(sign === 0 || sign === 1 || sign === -1, "sign is not one of {-1, 0, 1}: " + sign);

	assertTrue(digits.length >= 0, "invalid digits array");
	if (digits.length > 0) {
		assertTrue(digits[digits.length - 1], "leading zero");
	}

	if (d) {
		assertArrayEquals(d, digits);
	}
	if (s) {
		assertEquals(s, sign);
	}
}

function testConversion() {
	var n = BigRationalInteger(-1);
	checkBigInteger(n, [1], -1);

	var n = BigRationalInteger(-123);
	checkBigInteger(n, [3,2,1], -1);

	var n = BigRationalInteger(456);
	checkBigInteger(n, [6, 5, 4], 1);

	var n = BigRationalInteger("+42");
	checkBigInteger(n, [2, 4], 1);

	var n = BigRationalInteger("23x10^5");
	checkBigInteger(n, [0,0,0,0,0,3,2], 1);

	var n = BigRationalInteger("3425 x 10 ^ -2");
	checkBigInteger(n, [4,3], 1);

	var n = BigRationalInteger("342.5 x 10 ^ -2");
	checkBigInteger(n, [3], 1);

	var n = BigRationalInteger("-23x10^5");
	checkBigInteger(n, [0,0,0,0,0,3,2], -1);

	var n = BigRationalInteger("-3425 x 10 ^ -2");
	checkBigInteger(n, [4,3], -1);

	var n = BigRationalInteger("23.45x10^5");
	checkBigInteger(n, [0,0,0,5,4,3,2], 1);

	var n = BigRationalInteger("3425e-12");
	checkBigInteger(n, [], 0);

	var n = BigRationalInteger("-3425e8");
	checkBigInteger(n, [0,0,0,0,0,0,0,0,5,2,4,3], -1);

	var n = BigRationalInteger("3425e-12");
	checkBigInteger(n, [], 0);

	var n = BigRationalInteger("+3425e0");
	checkBigInteger(n, [5,2,4,3], 1);

	var n = BigRationalInteger("0xDeadBeef");
	checkBigInteger(n, [9,5,5,8,2,9,5,3,7,3], 1);

	var n = BigRationalInteger("-0c715");
	checkBigInteger(n, [1,6,4], -1);

	var n = BigRationalInteger("+0b1101");
	checkBigInteger(n, [3,1], 1);
};

function testParse() {
	var n;
	n = BigRationalInteger.parse("0", 10);
	checkBigInteger(n, [], 0);

	n = BigRationalInteger.parse("");
	checkBigInteger(n, [], 0);

	n = BigRationalInteger.parse("1");
	checkBigInteger(n, [1], 1);

	n = BigRationalInteger.parse("-1");
	checkBigInteger(n, [1], -1);

	n = BigRationalInteger.parse("+42", 10);
	checkBigInteger(n, [2, 4], 1);

	n = BigRationalInteger.parse("+42", 5);
	checkBigInteger(n, [2, 2], 1);

	n = BigRationalInteger.parse("23x10^5");
	checkBigInteger(n, [0,0,0,0,0,3,2], 1);

	n = BigRationalInteger.parse("3425 x 10 ^ -2");
	checkBigInteger(n, [4,3], 1);

	n = BigRationalInteger.parse("342.5 x 10 ^ -2");
	checkBigInteger(n, [3], 1);

	n = BigRationalInteger.parse("-23x10^5");
	checkBigInteger(n, [0,0,0,0,0,3,2], -1);

	n = BigRationalInteger.parse("-3425 x 10 ^ -2");
	checkBigInteger(n, [4,3], -1);

	n = BigRationalInteger.parse("23.45x10^5");
	checkBigInteger(n, [0,0,0,5,4,3,2], 1);

	n = BigRationalInteger.parse("3425e-12");
	checkBigInteger(n, [], 0);

	n = BigRationalInteger.parse("-3425e8");
	checkBigInteger(n, [0,0,0,0,0,0,0,0,5,2,4,3], -1);

	n = BigRationalInteger.parse("-3425e-12");
	checkBigInteger(n, [], 0);

	n = BigRationalInteger.parse("+3425e0");
	checkBigInteger(n, [5,2,4,3], 1);

	n = BigRationalInteger.parse("0xDeadBeef");
	checkBigInteger(n, [9,5,5,8,2,9,5,3,7,3], 1);

	n = BigRationalInteger.parse("12abz", 36);
	checkBigInteger(n, [9,1,3,6,8,7,1], 1);

	n = BigRationalInteger.parse("-0c715");
	checkBigInteger(n, [1,6,4], -1);

	n = BigRationalInteger.parse("-0C715", 10);
	checkBigInteger(n, [5,1,7], -1);

	n = BigRationalInteger.parse("+0b1101");
	checkBigInteger(n, [3,1], 1);

	n = BigRationalInteger.parse("1011", 2);
	checkBigInteger(n, [1,1], 1);

	n = BigRationalInteger.parse("1011", 3);
	checkBigInteger(n, [1,3], 1);

	n = BigRationalInteger.parse("1011", 4);
	checkBigInteger(n, [9,6], 1);

	n = BigRationalInteger.parse("1011", 5);
	checkBigInteger(n, [1,3,1], 1);

	n = BigRationalInteger.parse("1011", 6);
	checkBigInteger(n, [3,2,2], 1);

	n = BigRationalInteger.parse("1011", 7);
	checkBigInteger(n, [1,5,3], 1);

	n = BigRationalInteger.parse("1011", 10);
	checkBigInteger(n, [1,1,0,1], 1);

	n = BigRationalInteger.parse("1011", 11);
	checkBigInteger(n, [3,4,3,1], 1);

	n = BigRationalInteger.parse("1011", 12);
	checkBigInteger(n, [1,4,7,1], 1);

	n = BigRationalInteger.parse("1011", 15);
	checkBigInteger(n, [1,9,3,3], 1);

	n = BigRationalInteger.parse("1011", 16);
	checkBigInteger(n, [3,1,1,4], 1);

	n = BigRationalInteger.parse("1011", 36);
	checkBigInteger(n, [3,9,6,6,4], 1);

	BigRationalInteger.parse("1", 2);
	BigRationalInteger.parse("2", 3);
	BigRationalInteger.parse("3", 4);
	BigRationalInteger.parse("4", 5);
	BigRationalInteger.parse("5", 6);
	BigRationalInteger.parse("6", 7);
	BigRationalInteger.parse("7", 8);
	BigRationalInteger.parse("8", 9);
	BigRationalInteger.parse("9", 10);

	BigRationalInteger.parse("a", 11);
	BigRationalInteger.parse("b", 12);
	BigRationalInteger.parse("c", 13);
	BigRationalInteger.parse("d", 14);
	BigRationalInteger.parse("e", 15);
	BigRationalInteger.parse("f", 16);
	BigRationalInteger.parse("g", 17);
	BigRationalInteger.parse("h", 18);
	BigRationalInteger.parse("i", 19);
	BigRationalInteger.parse("j", 20);

	BigRationalInteger.parse("k", 21);
	BigRationalInteger.parse("l", 22);
	BigRationalInteger.parse("m", 23);
	BigRationalInteger.parse("n", 24);
	BigRationalInteger.parse("o", 25);
	BigRationalInteger.parse("p", 26);
	BigRationalInteger.parse("q", 27);
	BigRationalInteger.parse("r", 28);
	BigRationalInteger.parse("s", 29);
	BigRationalInteger.parse("t", 30);

	BigRationalInteger.parse("u", 31);
	BigRationalInteger.parse("v", 32);
	BigRationalInteger.parse("w", 33);
	BigRationalInteger.parse("x", 34);
	BigRationalInteger.parse("y", 35);
	BigRationalInteger.parse("z", 36);
};

function testParseFail() {
	function createTest(s, radix) {
		if (arguments.length < 2) {
			radix = 10;
		}
		return function() { BigRationalInteger.parse(s, radix); };
	}

	var radixError  = /^Illegal radix \d+./;
	var digitError  = /^Bad digit for radix \d+/;
	var formatError = /^Invalid BigInteger format: /;

	assertThrows(createTest("0", 1), radixError);
	assertThrows(createTest("0", 37), radixError);

	assertThrows(createTest("+ 42", 10), formatError);
	assertThrows(createTest("3425 x 10 ^ - 2"), formatError);
	assertThrows(createTest("34e-2", 16), formatError);
	assertThrows(createTest("- 23x10^5"), formatError);
	assertThrows(createTest("-+3425"), formatError);
	assertThrows(createTest("3425e-"), formatError);
	assertThrows(createTest("52", 5), digitError);
	assertThrows(createTest("23a105"), digitError);
	assertThrows(createTest("DeadBeef", 15), digitError);

	assertThrows(createTest("2", 2), digitError);
	assertThrows(createTest("3", 3), digitError);
	assertThrows(createTest("4", 4), digitError);
	assertThrows(createTest("5", 5), digitError);
	assertThrows(createTest("6", 6), digitError);
	assertThrows(createTest("7", 7), digitError);
	assertThrows(createTest("8", 8), digitError);
	assertThrows(createTest("9", 9), digitError);
	assertThrows(createTest("a", 10), digitError);
	assertThrows(createTest("b", 11), digitError);
	assertThrows(createTest("c", 12), digitError);
	assertThrows(createTest("d", 13), digitError);
	assertThrows(createTest("e", 14), digitError);
	assertThrows(createTest("f", 15), digitError);
	assertThrows(createTest("g", 16), digitError);
	assertThrows(createTest("h", 17), digitError);
	assertThrows(createTest("i", 18), digitError);
	assertThrows(createTest("j", 19), digitError);
	assertThrows(createTest("k", 20), digitError);
	assertThrows(createTest("l", 21), digitError);
	assertThrows(createTest("m", 22), digitError);
	assertThrows(createTest("n", 23), digitError);
	assertThrows(createTest("o", 24), digitError);
	assertThrows(createTest("p", 25), digitError);
	assertThrows(createTest("q", 26), digitError);
	assertThrows(createTest("r", 27), digitError);
	assertThrows(createTest("s", 28), digitError);
	assertThrows(createTest("t", 29), digitError);
	assertThrows(createTest("u", 30), digitError);
	assertThrows(createTest("v", 31), digitError);
	assertThrows(createTest("w", 32), digitError);
	assertThrows(createTest("x", 33), digitError);
	assertThrows(createTest("y", 34), digitError);
	assertThrows(createTest("z", 35), digitError);
};

function testToString() {
	var narray = [
		new BigInteger([], 1),
		BigRationalInteger(-1),
		BigRationalInteger(-123),
		BigRationalInteger(456),
		BigRationalInteger("+42"),
		BigRationalInteger("23x10^5"),
		BigRationalInteger("342.5 x 10 ^ -2"),
		BigRationalInteger("-23x10^5"),
		BigRationalInteger("-3425 x 10 ^ -2"),
		BigRationalInteger("23.45x10^5"),
		BigRationalInteger("3425e-12"),
		BigRationalInteger("-3425e8"),
		BigRationalInteger("+3425e0").toString(10),
		BigRationalInteger("0xDeadBeef").toString(16),
		BigRationalInteger("-0c715").toString(8),
		BigRationalInteger("+0b1101").toString(2),
		BigRationalInteger.parse("+42", 5).toString(10),
		BigRationalInteger.parse("+42", 5).toString(5),
		BigRationalInteger.parse("12abz", 36).toString(36),
		BigRationalInteger.parse("-0c715"),
	];
	var sarray = [
		"0",
		"-1",
		"-123",
		"456",
		"42",
		"2300000",
		"3",
		"-2300000",
		"-34",
		"2345000",
		"0",
		"-342500000000",
		"3425",
		"DEADBEEF",
		"-715",
		"1101",
		"22",
		"42",
		"12ABZ",
		"-461"
	];

	assertArraySimilar(sarray, narray);
	assertArraySimilar(testStrings, testValues1);
};

function testConstants() {
	assertEquals(37, BigRationalInteger.small.length);

	checkBigInteger(BigRationalInteger.small[0], [], 0);
	checkBigInteger(BigRationalInteger._0, [], 0);
	checkBigInteger(BigRationalInteger.ZERO, [], 0);
	checkBigInteger(BigRationalInteger._1, [1], 1);
	checkBigInteger(BigRationalInteger.ONE, [1], 1);
	checkBigInteger(BigRationalInteger.M_ONE, [1], -1);

	for (var i = 1; i <= 9; i++) {
		checkBigInteger(BigRationalInteger.small[i], [i], 1);
	}
	for (var i = 10; i <= 36; i++) {
		checkBigInteger(BigRationalInteger.small[i], [Math.floor(i % 10), Math.floor(i / 10)], 1);
	}

	checkBigInteger(BigRationalInteger.MAX_EXP, null, 1);
};

function testToJSValue() {
	var narray = [
		new BigInteger([], 1).toJSValue(),
		BigRationalInteger(-1).toJSValue(),
		BigRationalInteger(-123).toJSValue(),
		BigRationalInteger(456).toJSValue(),
		BigRationalInteger("+42").toJSValue(),
		BigRationalInteger("23x10^5").toJSValue(),
		BigRationalInteger("342.5 x 10 ^ -2").toJSValue(),
		BigRationalInteger("-23x10^5").toJSValue(),
		BigRationalInteger("-3425 x 10 ^ -2").toJSValue(),
		BigRationalInteger("23.45x10^5").toJSValue(),
		BigRationalInteger("3425e-12").toJSValue(),
		BigRationalInteger("-3425e8").toJSValue(),
		BigRationalInteger("+3425e0").toJSValue(),
		BigRationalInteger("0xDeadBeef").toJSValue(),
		BigRationalInteger("-0c715").toJSValue(),
		BigRationalInteger("+0b1101").toJSValue(),
		BigRationalInteger.parse("+42", 5).toJSValue(),
		BigRationalInteger.parse("+42", 5).toJSValue(),
		BigRationalInteger.parse("12abz", 36).toJSValue(),
		BigRationalInteger.parse("-0C715").toJSValue()
	];
	var jsarray = [
		0,
		-1,
		-123,
		456,
		42,
		parseInt("2300000", 10),
		parseInt("3", 10),
		parseInt("-2300000", 10),
		parseInt("-34", 10),
		parseInt("2345000", 10),
		parseInt("0", 10),
		parseInt("-342500000000", 10),
		parseInt("3425", 10),
		parseInt("DeadBeef", 16),
		parseInt("-715", 8),
		parseInt("1101", 2),
		parseInt("22", 10),
		parseInt("42", 5),
		parseInt("12ABZ", 36),
		parseInt("-461", 10)
	];

	assertArrayEquals(jsarray, narray);
	assertArrayEquals(testStrings.map(Number), testValues1.map(Number));
};

function testValueOf() {
	var narray = [
		+new BigInteger([], 1),
		+BigRationalInteger(-1),
		+BigRationalInteger(-123),
		+BigRationalInteger(456),
		+BigRationalInteger("+42"),
		+BigRationalInteger("23x10^5"),
		+BigRationalInteger("342.5 x 10 ^ -2"),
		+BigRationalInteger("-23x10^5"),
		+BigRationalInteger("-3425 x 10 ^ -2"),
		+BigRationalInteger("23.45x10^5"),
		+BigRationalInteger("3425e-12"),
		+BigRationalInteger("-3425e8"),
		+BigRationalInteger("+3425e0"),
		+BigRationalInteger("0xDeadBeef"),
		+BigRationalInteger("-0c715"),
		+BigRationalInteger("+0b1101"),
		+BigRationalInteger.parse("+42", 5),
		+BigRationalInteger.parse("+42", 5),
		+BigRationalInteger.parse("12abz", 36),
		+BigRationalInteger.parse("-0c715")
	];
	var jsarray = [
		0,
		-1,
		-123,
		456,
		42,
		parseInt("2300000", 10),
		parseInt("3", 10),
		parseInt("-2300000", 10),
		parseInt("-34", 10),
		parseInt("2345000", 10),
		parseInt("0", 10),
		parseInt("-342500000000", 10),
		parseInt("3425", 10),
		parseInt("DeadBeef", 16),
		parseInt("-715", 8),
		parseInt("1101", 2),
		parseInt("22", 10),
		parseInt("42", 5),
		parseInt("12ABZ", 36),
		parseInt("-461", 10)
	];

	assertArrayEquals(jsarray, narray);
	assertArrayEquals(testStrings.map(Number), testValues1.map(Number));
};

function testAdd() {
	runBinaryOperationTest(addResults, function(a, b) {
		return a.add(b).toString();
	});
};

function testSubtract() {
	runBinaryOperationTest(subtractResults, function(a, b) {
		return a.subtract(b).toString();
	});
};

function testMultiply() {
	runBinaryOperationTest(multiplyResults, function(a, b) {
		return a.multiply(b).toString();
	});
};

function testDivRem() {
	runBinaryOperationTest(divRemResults, function(a, b) {
		try {
			return a.divRem(b).toString();
		}
		catch (e) {
			return e.message;
		}
	});
};

function testNegate() {
	runUnaryOperationTest(negateResults, function(a) {
		return a.negate().toString();
	});
};

function testNext() {
	runUnaryOperationTest(nextResults, function(a) {
		return a.next().toString();
	});
};

function testPrev() {
	runUnaryOperationTest(prevResults, function(a) {
		return a.prev().toString();
	});
};

function testAbs() {
	runUnaryOperationTest(absResults, function(a) {
		return a.abs().toString();
	});
};

function testCompareAbs() {
	runBinaryOperationTest(compareAbsResults, function(a, b) {
		return a.compareAbs(b);
	});
};

function testCompare() {
	runBinaryOperationTest(compareResults, function(a, b) {
		return a.compare(b);
	});
};

function testIsUnit() {
	runUnaryOperationTest(isUnitResults, function(a) {
		return a.isUnit();
	});
};

function testIsZero() {
	runUnaryOperationTest(isZeroResults, function(a) {
		return a.isZero();
	});
};

function testIsPositive() {
	runUnaryOperationTest(isPositiveResults, function(a) {
		return a.isPositive();
	});
};

function testIsNegative() {
	runUnaryOperationTest(isNegativeResults, function(a) {
		return a.isNegative();
	});
};

function testSquare() {
	runUnaryOperationTest(squareResults, function(a) {
		return a.square().toString();
	});
};

function testIsEven() {
	runUnaryOperationTest(isEvenResults, function(a) {
		return a.isEven();
	});
};

function testIsOdd() {
	runUnaryOperationTest(isOddResults, function(a) {
		return a.isOdd();
	});
};

function testSign() {
	runUnaryOperationTest(signResults, function(a) {
		return a.sign();
	});
};

function testExp10() {
	runShortBinaryOperationTest(exp10Results, function(a, b) {
		if (Math.abs(Number(b)) > 1000) {
			b = Number(BigRationalInteger.MAX_EXP.next());
		}
		try {
			return a.exp10(b).toString();
		}
		catch (e) {
			return e.message;
		}
	});
};

function testPow() {
	runBinaryOperationTest(powResults, function(a, b) {
		try {
			if (b.isNegative() && a.compareAbs(BigInteger.ONE) > 0) {
				return "0";
			}
			return a.pow(b).toString();
		}
		catch (e) {
			return e.message;
		}
	},
	powValues, powValues);
};

function testModPow() {
	runTrinaryOperationTest(modPowResults, function(a, b, c) {
		try {
			return a.modPow(b, c).toString();
		}
		catch (e) {
			return e.message;
		}
	},
	powValues, powValues, powValues);
};


function TestBigInteger() {
	this.start = new Date();
}

TestBigInteger.prototype = {
/* Basic Functions */
	testConstants: testConstants,
	testConversion: testConversion,
	testParse: testParse,
	testParseFail: testParseFail,
	testToString: testToString,
	testToJSValue: testToJSValue,
	testValueOf: testValueOf,
/* Unary Functions */
	testNegate: testNegate,
	testNext: testNext,
	testPrev: testPrev,
	testAbs: testAbs,
	testSquare: testSquare,
/* Binary Functions */
	testAdd: testAdd,
	testSubtract: testSubtract,
	testMultiply: testMultiply,
	testDivRem: testDivRem,
	testExp10: testExp10,
/* Slow Binary Functions */
	testPow: testPow,
/* Comparisons/Information */
	testCompareAbs: testCompareAbs,
	testCompare: testCompare,
	testIsUnit: testIsUnit,
	testIsZero: testIsZero,
	testIsPositive: testIsPositive,
	testIsNegative: testIsNegative,
	testIsEven: testIsEven,
	testIsOdd: testIsOdd,
	testSign: testSign,
/* Trinary Functions */
	testModPow: testModPow,

/* Keep track of the time for each test */
	tearDown: function(show) {
		if (show) {
			var end = new Date();
			print("        Completed in " + (end - this.start) + "ms");
			this.start = new Date();
		}
	}
};

function generate() {
	// (echo 'var answers = ['; js test-biginteger.js | bc | sed -e :a -e '/\\$/N; s/\\\n//; ta' -e 's/^/\t"/' -e 's/$/",/'; echo '];') >expected/xxx.js

	print("scale = 0");
	runTrinaryOperationTest(new Array(testValues1.length * testValues2.length), function(a, b, c) {
		//print('print (' + a + ' / ' + b + '), ",", (' + a + ' % ' + b + '), "\\n"');
		//print("a = " + a + "; b = " + b + "; if (a == b) { 0 } else { if (a < b) { -1 } else { 1 } }");
		//print("if (" + a + " == 0) { 0 } else { (" + a + ") / abs(" + a + ") }");
		print("modexp(" + a + "," + b + "," + c + ")");
		return undefined;
	}, powValues, powValues, powValues);
	quit();
}

runTests(TestBigInteger, +arguments[0]);
