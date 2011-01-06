// Copyright (c) 2009 Matthew Crumley <email@matthewcrumley.com>
function AssertionFailed(message) {
	this.message = Array.join(message, " ");
}

AssertionFailed.prototype = new Error();

function fail() {
	throw new AssertionFailed(arguments);
}

function assertSimilar(a, b) {
	if (a != b) {
		fail(a, "!=", b);
	}
}

function assertEquals(a, b) {
	if (a !== b) {
		fail(a, "!==", b);
	}
}

function assertArrayEquals(a, b) {
	if (a.length !== b.length) {
		fail("Arrays have different lengths: expected", a.length, "got", b.length);
	}
	for (var i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			fail("Arrays differ at element", i + ":", a[i], "!==", b[i]);
		}
	}
}

function assertArraySimilar(a, b) {
	if (a.length !== b.length) {
		fail("Arrays have different lengths: expected", a.length, "got", b.length);
	}
	for (var i = 0; i < a.length; i++) {
		if (a[i] != b[i]) {
			fail("Arrays differ at element", i + ":", a[i], "!=", b[i]);
		}
	}
}

function assertEqualsApprox(a, b, tolerance) {
	tolerance = tolerance || 1.0e-5;
	if (Math.abs(a - b) > tolerance) {
		fail(a, "!=", b);
	}
}

function assertTrue(a, message) {
	if (!a) {
		fail(message || (a + " is not true"));
	}
}

function assertFalse(a, message) {
	if (a) {
		fail(message || (a + "is not false"));
	}
}

function assertNaN(a) {
	if (!((typeof a == "number") && isNaN(a))) {
		fail(a, "is not NaN");
	}
}

function assertThrows(fn, pattern) {
	try {
		fn();
	}
	catch (ex) {
		if (pattern) {
			if (typeof pattern === "string") {
				assertEquals(pattern, ex.message);
			}
			else if (!pattern.test(ex.message)) {
				fail("incorrect exception:", ex.message);
			}
		}
		return;
	}

	fail("did not throw an exception");
}

function assertPropertyExists(obj, property) {
	if (property in obj) {
		if (obj[property] === undefined) {
			fail("property", property, "in object is undefined");
		}
		if (obj[property] === null) {
			fail("property", property, "in object is null");
		}
	}
	else {
		fail("property", property, "does not exist in object");
	}
}

function assertHasMethod(obj, method) {
	if (method in obj) {
		var f = obj[method];
		if (typeof f !== "function") {
			fail("'" + method + "'", "is not a function");
		}
	}
	else {
		fail("object does not contain method '" + method + "'");
	}
}

function runTests(testClass, verbose) {

	function getTests(obj, log, logPrefix) {

		function isTestName(fn) {
			return fn.substr(0, 4) === "test";
		}

		var tests = [];
		var f = null;

		for (var fn in obj) {
			if ((typeof(obj[fn]) === "function") && isTestName(fn)) {
				f = getFunction(fn, obj, log, logPrefix);
				f.testName = fn;
				tests.push(f);
			}
		}

		return tests;
	}

	function getFunction(name, obj, log, logPrefix) {
		if (name in obj && typeof(obj[name]) === "function") {
			if (log) {
				return function(message) {
					print(logPrefix, message);
					obj[name](log);
				};
			}
			else {
				return function() {
					obj[name](log);
				}
			}
		}
		else {
			return function() {};
		}
	}

	function displayTest(tests, index) {
		return (index + 1) + "/" + tests.length + " (" + tests[index].testName + ")";
	}

	function displayTime(time) {
		if (time < 1000) {
			return (time / 1000) + "s";
		}

		var parts = [];

		if (time > 1000 * 60 * 60) {
			// hours
			parts.push(Math.floor(time / (1000 * 60 * 60)));
		}
		if (time > 1000 * 60) {
			// minutes
			parts.push(Math.floor((time % (1000 * 60 * 60)) / (1000 * 60)));
		}
		parts.push((time % (1000 * 60))/ 1000.0);
		return parts.map(function (x, i) { return (i > 0 && x < 10 ? "0" : "") + x; }).join(":");
	}

	verbose = verbose || 0;

	var SHOW_PRE_POST = 2;
	var SHOW_RUN = 1;
	var SHOW_NONE = -1;

	var testObject;
	try {
		testObject = new testClass();
	}
	catch (ex) {
		if (verbose > SHOW_NONE) print("Could not instantiate test class:", ex.message);
		return false;
	}

	var tests    = getTests(testObject,                verbose >= SHOW_RUN,      "   ");
	var setup    = getFunction("setUp",    testObject, verbose >= SHOW_PRE_POST, "        Setting up test");
	var teardown = getFunction("tearDown", testObject, verbose >= SHOW_PRE_POST, "        Tearing down test");

	var ntest = tests.length;
	var npass = 0;

	if (ntest === 0) {
		if (verbose > SHOW_NONE) print("No Tests to run.");
		return false;
	}

	if (verbose > SHOW_NONE) print("Running Tests...");
	var startTime = new Date();

	for (var i = 0; i < ntest; i++) {
		var displayName = displayTest(tests, i);

		try { setup(displayName); }
		catch(ex) {
			if (verbose > SHOW_NONE) print("setUp failed for test", displayName + ":", ex.message);
			return false;
		}

		try {
			tests[i](displayName);
			npass++;
		}
		catch (ex) {
			if (verbose > SHOW_NONE) print("Failed", displayName + ":", ex.message);
		}

		try { teardown(displayName); }
		catch(ex) {
			if (verbose > SHOW_NONE) print("tearDown failed for test", displayName + ":", ex.message);
			return false;
		}
	}

	var endTime = new Date();
	var elapsed = endTime - startTime;
	if (verbose > SHOW_NONE) print("\nFinished in " + displayTime(elapsed));
	if (verbose > SHOW_NONE) print("Passed " + npass + "/" + ntest + " (" + (npass/ntest * 100).toFixed(2) + "%): " + ((npass === ntest) ? "PASS" : "FAIL"));

	return npass === ntest;
}

if (typeof exports !== "undefined") {
    exports.AssertionFailed = AssertionFailed;
    exports.fail = fail;
    exports.assertSimilar = assertSimilar;
    exports.assertEquals = assertEquals;
    exports.assertArrayEquals = assertArrayEquals;
    exports.assertArraySimilar = assertArraySimilar;
    exports.assertEqualsApprox = assertEqualsApprox;
    exports.assertTrue = assertTrue;
    exports.assertFalse = assertFalse;
    exports.assertNaN = assertNaN;
    exports.assertThrows = assertThrows;
    exports.assertPropertyExists = assertPropertyExists;
    exports.assertHasMethod = assertHasMethod;
    exports.runTests = runTests;
}
