// Scheme numerical tower in JavaScript.
// Copyright (c) 2011,2012 by John Tobey <John.Tobey@gmail.com>

/*
    File: schemeNumber.js

    Exports:

        <SchemeNumber>

    Depends:

        <biginteger.js> for <BigInteger>
 */

/*
    Class: SchemeNumber
    A number object as <defined by the Scheme language at
    http://www.r6rs.org/>.

    Scheme supports *exact* arithmetic and mixing exact with standard
    (*inexact*) numbers.  Several basic operations, including
    addition, subtraction, multiplication, and division, when given
    only exact arguments, must return an exact, numerically correct
    result.

    These operations are allowed to fail due to running out of memory,
    but they are not allowed to return approximations the way
    ECMAScript operators may, unless given one or more inexact
    arguments.

    For example, adding exact *1/100* to exact *0* one hundred times
    produces exactly *1*, not 1.0000000000000007 as in JavaScript.
    Raising exact *2* to the power of exact *1024* returns a 308-digit
    integer with complete precision, not *Infinity* as in ECMAScript.

    This implementation provides all functions listed in the <R6RS
    Scheme specification at http://www.r6rs.org/>, Section 11.7, along
    with <eqv?> from Section 11.5.  (<eqv?> uses JavaScript's *===* to
    compare non-numbers.)

    Exact numbers support the standard ECMA Number formatting methods
    (toFixed, toExponential, and toPrecision) without a fixed upper
    limit to precision.

    The schemeNumber.js file exports an object <SchemeNumber>.  It
    contains a property <fn>, which in turn contains the functions
    implementing the numeric types.

    The <SchemeNumber> object is in fact a function that converts its
    argument to a Scheme number: similar to a constructor, but it may
    not always return an object, let alone a unique object.

    Parameters:

        obj - Object to be converted to a Scheme number.

    *obj* may have any of the following
    types:

        Scheme number - returned unchanged.
        String        - converted as if by *string->number*.
        Native ECMAScript number - treated as an inexact real.

    Returns:

        A Scheme number.

    Exceptions:

        If *obj* can not be parsed, <SchemeNumber> will <raise> an
        exception with condition type *&assertion*.

    See Also:

        <fn>, <raise>, <R6RS Chapter 3: Numbers at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-6.html#node_chap_3>
*/
var SchemeNumber = (function() {

//
// Multiple dispatch support.
//

var DispatchJs = (function() {
/*
Multiple dispatch for JavaScript functions of fixed arity.  Example:

    // B and C inherit from A.  D inherits from C.
    var A = disp.defClass("A", {ctor: function(x) { this.x = x }});
    var B = disp.defClass("B", {extends: "A"});
    var C = disp.defClass("C", {extends: "A"});
    // Classes may be defined after their superclass methods.
    //var D = disp.defClass("D", {extends: "C"});

    // Or you can declare existing classes:
    //var disp = DispatchJs;
    //function A(){} A.prototype = {};
    //disp.defClass("A", {ctor: A});
    //function B(){} B.prototype = new A();
    //disp.defClass("B", {ctor: B, extends "A"});
    //function C(){} C.prototype = new A();
    //disp.defClass("C", {ctor: C, extends "A"});
    //function D(){} D.prototype = new C();
    //disp.defClass("D", {ctor: D, extends "C"});

    // This creates a function of 2 arguments:
    var frob = disp.defGeneric("frob", 2);

    // Define methods.  Methods receive frob's first argument as "this" and
    // the rest as method arguments.
    frob.def("A", "A", function(a1) { return "A A" });
    frob.def("A", "B", function(a1) { return "A B" });
    frob.def("B", "A", function(a1) { return "B A" });
    frob.def("B", "B", function(a1) { return "B B" });
    frob.def("A", "C", function(a1) { return "A C" });
    var D = disp.defClass("D", function(x) { this.x = x }, "C");
    frob.def("D", "D", function(a1) { return "D D" });

    // Create some arguments:
    var a = new A();
    var b = new B();
    var c = new C();
    var d = new D();

    // Call the function:
    frob(a,a);  // "A A"
    frob(a,b);  // "A B"
    frob(a,c);  // "A C"
    frob(a,d);  // "A C"
    frob(b,a);  // "B A"
    frob(b,b);  // "B B"
    frob(b,c);  // "B A" or "A C"
    frob(b,d);  // "B A" or "A C"
    frob(c,a);  // "A A"
    frob(c,b);  // "A B"
    frob(c,c);  // "A C"
    frob(c,d);  // "A C"
    frob(d,a);  // "A A"
    frob(d,b);  // "A B"
    frob(d,c);  // "A C"
    frob(d,d);  // "D D"

Ambiguous calls such as frob(b,c) and frob(b,d) above use whichever of
the best candidates was defined first: the method for types B,A or the
one for A,C.
*/
function short_fn(f) {
    return String(f).replace(/(?:.|\n)*(function .*?\(.*?\))(?:.|\n)*/, "$1");
}
var Formals = [];
function makeContext(opts) {
    var _jtmd = opts.methodNamePrefix || "_jtmd";
    var sp = opts.methodNameSeparator || " ";
    var classes = {};

    var ret = {
        getConstructor: function(name) {
            var c = classes[sp + name];
            return c && c.ctor;
        },
        defClass: function(name, opts) {
            var ctor, base;
            var kname, bctor, kbase, proto, sub, bases, c, inherited;

            if (opts) {
                ctor = opts.ctor;
                base = opts.extends;
            }
            if (base !== undefined) {
                kbase = sp + base;
                if (!classes[kbase]) {
                    throw Error("Define base " + base + " before class "
                                + name);
                }
                bctor = classes[kbase].ctor;
            }
            ctor = ctor || function(){}
            if (typeof name !== "string" && !(name instanceof String)) {
                throw Error("Usage: defClass(NAME, [OPTS])");
            }
            kname = sp + name;
            if (classes[kname] !== undefined) {
                if (classes[kname].ctor !== ctor ||
                    classes[kname].kbase !== kbase)
                {
                    throw Error("Can't redefine class " + name);
                }
                return ctor;
            }
            if (name.indexOf(sp) != -1) {
                throw Error((sp == " " ? "Space" : "Separator") +
                            " in class name: " + name);
            }
            if (!ctor.prototype ||
                (bctor && !(ctor.prototype instanceof bctor)))
            {
                proto = (bctor ? new bctor() : {});
                proto.constructor = ctor;
                if (ctor.prototype) {
                    for (key in ctor.prototype) {
                        proto[key] = ctor.prototype[key];
                    }
                }
                ctor.prototype = proto;
            }
            classes[kname] = {
                ctor:    ctor,
                kbase:   kbase,
                sub:     [],
                ename:   kname.replace(/([\"\\])/g, "\\$1"),
                meths:   [],
            };
            //print("defClass:" + kname);
            if (base !== undefined) {
                sub = classes[kbase].sub;
                if (sub.indexOf(kname) === -1)
                    sub.push(kname);
            }
            bases = [];
            for (c = classes[kbase]; c; c = classes[c.kbase]) {
                bases.unshift(c);
            }
            inherited = {};
            bases.forEach(function(c) {
                c.meths.forEach(function(array) {
                    var types = array[0].slice();
                    var i = array[1], do_def = array[2], eName = array[3];
                    var c0 = classes[types[0]];
                    var proto = c0.ctor.prototype;
                    var method = _jtmd + eName + types.slice(1).join('');
                    var code = proto[method];
                    if (!proto.hasOwnProperty(method)) {
                        //print("inherited property: " + method)
                        return;
                    }
                    types[i] = kname;
                    //print("Propagating " + [c.ename, eName, i, types]);
                    do_def(types, code, inherited);
                });
            });
            return ctor;
        },

        defGeneric: function (fnName, ndisp, nargs) {
            if (fnName.indexOf(sp) != -1)
                throw Error((sp == " " ? "Space" : "Separator") +
                            " in function name: " + fnName);
            nargs = nargs || ndisp;
            if (fnName == ""
                || ndisp < 1 || ndisp != Math.floor(ndisp)
                || nargs < 1 || nargs != Math.floor(nargs))
                throw Error("Usage: defGeneric(NAME, NDISP [, NARGS])");

            var eName = sp + fnName.replace(/([\"\\])/g, "\\$1");
            var eTopMethod = _jtmd + eName;

            for (var i = Formals.length; i < nargs; i++)
                Formals[i] = "a" + i;
            var array = Formals.slice(0, nargs);
            // e.g., function(a0,a1,a2,a3){return a3["_jtmd frob"](a0,a1,a2)}
            array.push(
                "return " + Formals[ndisp-1] + '["' + eTopMethod + '"](' +
                    array.slice(0, ndisp-1).concat(array.slice(ndisp, nargs))
                    .join(",") + ')')
            var ret = Function.apply(null, array);

            var func_cache = {};
            function get_func(i, etypes) {
                var suffix = etypes.slice(i).join("");
                if (!func_cache[suffix]) {
                    var method = _jtmd + eName + suffix;
                    var array = Formals.slice(0,i).concat(
                        Formals.slice(i+1,nargs));

                    array.push("return " + Formals[i-1] +
                               '["' + method + '"](' +
                               Formals.slice(0,i-1).concat("this").concat(
                                   Formals.slice(i+1,nargs)).join(",") +
                               ')');

                    func_cache[suffix] = Function.apply(null,array);
                }
                return func_cache[suffix];
            }

            function usageArgs() {
                switch (ndisp) {
                case 1: return "TYPE";
                case 2: return "TYPE1, TYPE2";
                case 3: return "TYPE1, TYPE2, TYPE3";
                default: return "TYPE1, ..., TYPE" + ndisp;
                }
            }

            // def(TYPE1, ..., TYPEn, FUNCTION)
            // Defines FUNCTION as this method's specialization for the
            // given types.  Each TYPEi must have been passed as the
            // NAME argument in a successful call to defClass.
            function def() {
                var fn = arguments[ndisp];
                if (typeof fn !== "function") {
                    throw Error("Not a function.  Usage: " + fnName +
                                ".def(" + usageArgs() + ", FUNCTION)");
                }
                var types = new Array(ndisp);

                for (i = 0; i < ndisp; i++) {
                    types[i] = sp + arguments[i];
                    if (!classes[types[i]]) {
                        // XXX Could add arguments to a list to be
                        // defined during defClass.
                        throw Error("Type not defined with defClass: " +
                                    arguments[i] + ".  Usage: def(" +
                                    usageArgs() + ", FUNCTION)");
                    }
                }
                //print("def");
                do_def(types, fn, {});

                //print("Recording in meths:" + types);
                for (i = ndisp-1; i >= 0; i--) {
                    // XXX memory leak+slow for methods often redefined.
                    classes[types[i]].meths.push([types, i, do_def, eName]);
                }
            }

            function do_def(types, fn, inherited) {
                //print("do_def: " + fnName + " -" + types + " - " + short_fn(fn));
                var cs = new Array(ndisp);
                var eTypes = new Array(ndisp);
                var i, suffix, oldm, newm;

                for (i = 0; i < ndisp; i++) {
                    cs[i] = classes[types[i]];
                    eTypes[i] = cs[i].ename;
                }

                oldm = new Array(ndisp);
                for (i = ndisp-1, suffix = ""; ; i--) {
                    oldm[i] = cs[i].ctor.prototype[
                        _jtmd + sp + fnName + suffix];
                    //print("oldm[" + i + "]" + oldm[i]);
                    if (i === 0)
                        break;
                    suffix = eTypes[i] + suffix;
                }

                newm = new Array(ndisp);
                newm[0] = fn;
                for (i=1; i<ndisp; i++)
                    newm[i] = get_func(i, eTypes);

                function doit(i, method) {
                    var key;
                    var proto = cs[i].ctor.prototype;

                    if (proto[method] && proto[method] !== oldm[i]) {
                        //print("Skipping " + i + types[i] + '["' + method + '"] ' + short_fn(proto[method]) + "!=" + short_fn(oldm[i]));
                        return;  // already more specialized in an argument.
                    }
                    //print("doit("+i+","+method+")  "+cs[i].ename);
                    if (proto === Object.prototype)
                        throw Error("BUG: code would modify Object.prototype.");
                    key = eTypes[i] + sp + method;
                    if (proto[method] !== newm[i]) {
                        if ((key in inherited) && newm[i] === inherited[key]) {
                            //print(eTypes[i] + '["'+method+'"] ' + short_fn(proto[method]) + " -> DELETED");
                            delete(proto[method]);
                        }
                        else {
                            //print(eTypes[i] + '["'+method+'"] ' + short_fn(proto[method]) + " -> " + short_fn(newm[i]));
                            if (!proto.hasOwnProperty(method))
                                inherited[key] = proto[method];
                            proto[method] = newm[i];
                        }
                    }
                    if (i === 0)
                        return;
                    function doit2(k) {
                        doit(i - 1, method + k);
                        classes[k].sub.forEach(doit2);
                    }
                    doit2(types[i]);
                }

                doit(ndisp-1, _jtmd + eName);
            }
            ret.def = def;
            return ret;
        },
    };
    if (opts.debug)
        ret.classes = classes;
    return ret;
}
//var ret = makeContext({});
//ret.makeContext = makeContext;
//return ret;
    return makeContext({
        methodNamePrefix: "SN_",
        methodNameSeparator: " ",
        debug: true,
    });
})();

//if (typeof exports !== "undefined") {
//    exports.DispatchJs = DispatchJs;
//    exports.makeContext = DispatchJs.makeContext;
//    exports.defClass = DispatchJs.defClass;
//    exports.defGeneric = DispatchJs.defGeneric;
//}

//
// Uncomment "assert(...)" to use this:
//

function assert(x) { if (!x) throw new Error("assertion failed"); }

/*
    Function: makeInterfaces()
    Returns an object whose keys are the abstract number class
    constructors:

    - N (base class of all Scheme numbers)
    - Complex
    - Real
    - InexactReal
    - ExactReal
    - ExactRational
    - ExactInteger

    Number implementations may call the constructors (without
    arguments) to create prototypes and inherit functionality defined
    in <makeTower>.

    Each call to makeInterfaces returns a new set of constructors, so
    multiple independent SchemeNumber implementations may coexist.
*/
function makeInterfaces() {
    function N(){} N.prototype = new Number();  // so sn(x) instanceof Number.
    function Complex(){}             Complex.prototype = new N();
    function Real(){}                   Real.prototype = new Complex();
    function InexactReal(){}     InexactReal.prototype = new Real();
    function ExactReal(){}         ExactReal.prototype = new Real();
    function ExactRational(){} ExactRational.prototype = new ExactReal();
    function ExactInteger(){}   ExactInteger.prototype = new ExactRational();
    return {
        N:N, Complex:Complex, Real:Real, InexactReal:InexactReal,
        ExactReal:ExactReal, ExactRational:ExactRational,
        ExactInteger:ExactInteger
    };
}

/*
    Function: makeBase(interfaces, args)
    Defines and returns a partially constructed <SchemeNumber> object.

    *interfaces* should be an object as returned by <makeInterfaces>.

    *args* should be an object containing one or more of the
    properties described below.

    If *args* contains *stringToNumber*, then *parseInexact* and
    *parseExactInteger* are optional and default to versions that use
    *stringToNumber*.

    Otherwise, if *args* does not contain *stringToNumber*, it must
    contain both *parseInexact* and *parseExactInteger*, which the
    parser then calls via <defaultStringToNumber>.

    If *args* does not contain the properties relating to complex
    numbers, the library will not support complex arithmetic, and it
    will replace non-real values with NaN.

    The remaining properties of *args* are optional and default to
    versions that use the required properties.  All properties,
    whether explicitly passed or generated by default, are returned as
    the corresponding properties of <SchemeNumber.pluginApi>.

    stringToNumber - function(string, radix, exact)
    <stringToNumber> must be a function behaving like
    <defaultStringToNumber>, which returns the Scheme number whose
    external representation is *string* with added prefixes
    corresponding to either or both of *radix* and *exact*, if
    defined.

    parseInexact - function(sign, string)
    *sign* is the native number 1 or -1.  <parseExact> must be a
    function returning a Scheme number equal to *sign* times the
    result of parsing *string* as a positive, unprefixed, decimal,
    inexact real number.

    parseExactInteger - function(sign, string, radix)
    *sign* is the native number 1 or -1.  *radix* is the native number
    2, 8, 10, or 16.  <parseExactInteger> must be a function returning
    a Scheme number equal to *sign* times the result of parsing
    *string* as a positive, unprefixed, exact integer in the given
    radix.

    toFlonum - function(number)
    *number* is a native ECMAScript number.  <toFlonum> must be a
    function returning an inexact Scheme number whose value equals
    *number*.

    nativeToExactInteger - function(integer)
    *integer* is a native ECMAScript number of integer value.
    <nativeToExactInteger> must be a function returning an exact
    Scheme number whose value equals *integer*.

    parserExp10 - function(n, e)
    *n* and *e* are exact integers.  <parserExp10> must return an
    exact integer whose value equals *n* times 10 to the power *e*.
    <defaultStringToNumber> calls *parserExp10* to construct exact
    decimal literals.

    divideReduced - function(numerator, denominator)
    *numerator* is an exact integer.  *denominator* is an exact,
    positive integer, possibly 1, that has no factors in common with
    *numerator*.  <divideReduced> must be a function returning the
    result of dividing *numerator* by *denominator*.

    exactRectangular - function(x, y)
    *x* and *y* are exact reals.  <exactRectangular> must be a
    function that returns an exact complex equal to *x* + (i * *y*).

    inexactRectangular - function(x, y)
    *x* and *y* are inexact reals.  <inexactRectangular> must be a
    function that returns an inexact complex equal to *x* + (i * *y*).
    makePolar

    I - a Scheme number equal to the exact imaginary unit "i".

    MINUS_I - a Scheme number equal to the exact imaginary unit "-i".

    See Also: <makeTower>
*/
function makeBase(interfaces, args) {

var stringToNumber       = args.stringToNumber;
var parseInexact         = args.parseInexact;
var parseExactInteger    = args.parseExactInteger;

if (!stringToNumber && !(parseInexact && parseExactInteger)) {
    throw Error("Neither stringToNumber nor the default version's" +
                " dependencies found");
}
stringToNumber    = stringToNumber    || defaultStringToNumber;
parseInexact      = parseInexact      || defaultParseInexact;
parseExactInteger = parseExactInteger || defaultParseExactInteger;

var toFlonum             = args.toFlonum             || defaultToFlonum;
var nativeToExactInteger = args.nativeToExactInteger ||
                                               defaultNativeToExactInteger;
var parserExp10          = args.parserExp10          || defaultParserExp10;
var divideReduced        = args.divideReduced;

var exactRectangular     = getComplexFunc("exactRectangular");
var inexactRectangular   = getComplexFunc("inexactRectangular");
var makePolar            = getComplexFunc("makePolar");
var I                    = args.I       || getComplexConstant(0, 1);
var M_I                  = args.MINUS_I || getComplexConstant(0, -1);

var disp                 = args.dispatchContext || DispatchJs;

function getComplexFunc(name) {
    var ret = args[name];
    if (ret)
        return ret;
    if (args["USE_NAN_AS_COMPLEX"]) {
        return function() {
            return NAN;
        };
    }
    return function() {
        throw Error("Complex function " + name + " not defined");
    };
}

function getComplexConstant(x, y) {
    try {
        return exactRectangular(nativeToExactInteger(x),
                                nativeToExactInteger(y));
    }
    catch (e) {
        return NAN;
    }
}

var N = interfaces.N;

function isNumber(x) {
    return x instanceof N;
}

function pureVirtual() {
    throw new Error("BUG: Abstract method not overridden for " + this);
}

var ZERO = nativeToExactInteger(0);
var ONE  = nativeToExactInteger(1);
var TWO  = nativeToExactInteger(2);
var M_ONE = nativeToExactInteger(-1);

var INEXACT_ZERO = toFlonum(0);
var PI           = toFlonum(Math.PI);
var INFINITY     = toFlonum(Number.POSITIVE_INFINITY);
var M_INFINITY   = toFlonum(Number.NEGATIVE_INFINITY);
var NAN          = toFlonum(Number.NaN);

var numberToString = disp.defGeneric("numberToString", 1, 3);

var isExact        = disp.defGeneric("isExact",    1);
var isInexact      = disp.defGeneric("isInexact",  1);
var toExact        = disp.defGeneric("toExact",    1);
var toInexact      = disp.defGeneric("toInexact",  1);
var isComplex      = disp.defGeneric("isComplex",  1);
var isReal         = disp.defGeneric("isReal",     1);
var isRational     = disp.defGeneric("isRational", 1);
var isInteger      = disp.defGeneric("isInteger",  1);
var isZero         = disp.defGeneric("isZero",     1);
var negate         = disp.defGeneric("negate",     1);
var reciprocal     = disp.defGeneric("reciprocal", 1);
var square         = disp.defGeneric("square",     1);
var debug          = disp.defGeneric("debug",      1);

var eq             = disp.defGeneric("eq",         2);
var ne             = disp.defGeneric("ne",         2);
var add            = disp.defGeneric("add",        2);
var subtract       = disp.defGeneric("subtract",   2);
var multiply       = disp.defGeneric("multiply",   2);
var divide         = disp.defGeneric("divide",     2);
var expt           = disp.defGeneric("expt",       2);

var realPart       = disp.defGeneric("realPart",   1);
var imagPart       = disp.defGeneric("imagPart",   1);
var exp            = disp.defGeneric("exp",        1);
var magnitude      = disp.defGeneric("magnitude",  1);
var angle          = disp.defGeneric("angle",      1);
var sqrt           = disp.defGeneric("sqrt",       1);
var log            = disp.defGeneric("log",        1);
var asin           = disp.defGeneric("asin",       1);
var acos           = disp.defGeneric("acos",       1);
var atan           = disp.defGeneric("atan",       1);
var sin            = disp.defGeneric("sin",        1);
var cos            = disp.defGeneric("cos",        1);
var tan            = disp.defGeneric("tan",        1);

var SN_isFinite    = disp.defGeneric("isFinite",   1);
var SN_isInfinite  = disp.defGeneric("isInfinite", 1);
var SN_isNaN       = disp.defGeneric("isNaN",      1);

var abs            = disp.defGeneric("abs",        1);
var isPositive     = disp.defGeneric("isPositive", 1);
var isNegative     = disp.defGeneric("isNegative", 1);
var sign           = disp.defGeneric("sign",       1);
var floor          = disp.defGeneric("floor",      1);
var ceiling        = disp.defGeneric("ceiling",    1);
var truncate       = disp.defGeneric("truncate",   1);
var round          = disp.defGeneric("round",      1);

var compare        = disp.defGeneric("compare",    2);
var gt             = disp.defGeneric("gt",         2);
var lt             = disp.defGeneric("lt",         2);
var ge             = disp.defGeneric("ge",         2);
var le             = disp.defGeneric("le",         2);
var divAndMod      = disp.defGeneric("divAndMod",  2);
var div            = disp.defGeneric("div",        2);
var mod            = disp.defGeneric("mod",        2);
var atan2          = disp.defGeneric("atan2",      2);

var numerator      = disp.defGeneric("numerator",   1);
var denominator    = disp.defGeneric("denominator", 1);

var isUnit         = disp.defGeneric("isUnit",     1);
var isEven         = disp.defGeneric("isEven",     1);
var isOdd          = disp.defGeneric("isOdd",      1);
var exactIntegerSqrt = disp.defGeneric("exactIntegerSqrt", 1);
var exp10          = disp.defGeneric("exp10",      1, 2);  // return this*10^n
var gcdNonnegative = disp.defGeneric("gcdNonnegative", 2);

var natAbs      = Math.abs;
var natFloor    = Math.floor;
var LN2         = Math.LN2;
var _parseInt   = parseInt;
var _isFinite = isFinite;
var _isNaN    = isNaN;

function defaultParseInexact(sign, string) {
    return stringToNumber((sign < 0 ? "-" : "") + string, 10, false);
}

function defaultToFlonum(x) {
    if (_isFinite(x))
        return parseInexact(x < 0 ? -1 : 1, String(natAbs(x)));
    if (_isNaN(x))
        return "+nan.0";
    return (x > 0 ? "+inf.0" : "-inf.0");
}

function defaultParseExactInteger(sign, string, radix) {
    return stringToNumber((sign < 0 ? "-" : "") + string, radix, true);
}

function defaultNativeToExactInteger(n) {
    return parseExactInteger(n < 0 ? -1 : 1, natAbs(n).toString(16), 16);
}

function defaultParserExp10(n, e) {
    var ie = +e;
    if (ne(nativeToExactInteger(ie), e))
        raise("&implementation-restriction", "exponent limit exceeded", e);
    return exp10(n, ie);
}

// How to split a rectangular literal into real and imaginary components:
var decimalComplex = /^(.*[^a-zA-Z]|)([-+].*)i$/;
var radixComplex = /^(.*)([-+].*)i$/;

var nanInfPattern = /^[-+](nan|inf)\.0$/;
var exponentMarkerPattern = /[eEsSfFdDlL]/;
var decimal10Pattern = /^([0-9]+\.?|[0-9]*\.[0-9]+)([eEsSfFdDlL][-+]?[0-9]+)?$/;

var uintegerPattern = {
    2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-fA-F]+$/
};

var natFloor  = Math.floor;
var natAbs    = Math.abs;
var natPow    = Math.pow;
var _parseInt = parseInt;

//
// Input functions.
//

var PARSE_ERROR = new Object();

function makeRectangular(x, y) {
    if (isInexact(x))
        return inexactRectangular(x, toInexact(y));
    if (isInexact(y))
        return inexactRectangular(toInexact(x), y);
    return exactRectangular(x, y);
}

/*
    Function: defaultStringToNumber(s, radix, exact)
    Parses a string, optionally using radix and exactness hints, and
    returns the resulting Scheme number.

    The string *s* should be the external representation of a Scheme
    number, such as "2/3" or "#e1.1@-2d19".  If *s* does not represent
    a Scheme number, the function must return *false*.

    If *radix* is given, it must be either 2, 8, 10, or 16, and *s*
    must not contain a radix prefix.  The function behaves as if *s*
    did contain the prefix corresponding to *radix*.

    If *exact* is given, it must have type "boolean", and *s* must not
    contain an exactness prefix.  The function behaves as if *s*
    contained the corresponding prefix ("#e" if *exact* is true, "#i"
    if false).
*/
function defaultStringToNumber(s, radix, exact) {
    function lose() {
        throw PARSE_ERROR;
    }
    function setExact(value) {
        if (exact !== undefined) lose();
        exact = value;
    }
    function setRadix(value) {
        if (radix) lose();
        radix = value;
    }
    function parseUinteger(s, sign) {
        if (!uintegerPattern[radix].test(s))
            lose();

        if (exact === false) {
            if (radix === 10)
                return parseInexact(sign, s);
            return toInexact(parseExactInteger(sign, s, radix));
        }
        return parseExactInteger(sign, s, radix);
    }
    function parseReal(s) {
        if (nanInfPattern.test(s)) {
            if (exact)
                lose();
            switch (s) {
            case "+inf.0": return INFINITY;
            case "-inf.0": return M_INFINITY;
            default: return NAN;
            }
        }

        var sign = 1;
        switch (s[0]) {
        case '-': sign = -1;  // fall through
        case '+': s = s.substring(1);
        }

        var slash = s.indexOf('/');
        if (slash != -1)
            return divide(parseUinteger(s.substring(0, slash), sign),
                          parseUinteger(s.substring(slash + 1), 1));

        if (radix !== 10)
            lose();

        var pipe = s.indexOf('|');
        if (pipe !== -1) {

            // WHOA!!!  Explicit mantissa width!  Somebody really
            // cares about correctness.  However, I haven't got all
            // day, so execution speed loses.

            var afterPipe = s.substring(pipe + 1);
            if (!uintegerPattern[10].test(afterPipe))
                lose();

            s = s.substring(0, pipe);
            var precision = _parseInt(afterPipe, 10);

            if (precision === 0)
                s = "0.0";
            else if (precision < 53)
                return parseWithWidth(s, precision, exact);
        }

        // We have only one floating point width.
        s = s.replace(exponentMarkerPattern, 'e');

        var dot = s.indexOf('.');
        var e = s.indexOf('e');
        if (dot === -1 && e === -1)
            return parseUinteger(s, sign);

        if (!decimal10Pattern.test(s))
            lose();

        if (!exact)
            return parseInexact(sign, s);

        var integer = s.substring(0, dot === -1 ? e : dot);
        var exponent = ZERO;
        var fraction;

        if (e === -1)
            fraction = s.substring(dot + 1);
        else {
            if (dot === -1)
                fraction = "";
            else
                fraction = s.substring(dot + 1, e);
            exponent = parseReal(s.substring(e + 1));
        }

        return parserExp10(parseExactInteger(sign, integer + fraction),
                           subtract(exponent,
                                    nativeToExactInteger(fraction.length)));
    }
    function parseComplex(s) {
        var a = s.indexOf('@');
        if (a !== -1) {
            var ret = makePolar(parseReal(s.substring(0, a)),
                                parseReal(s.substring(a + 1)));
            if (exact && isInexact(ret))
                ret = toExact(ret);  // XXX is this right?
            return ret;
        }

        if (s[s.length - 1] !== "i")
            return parseReal(s);

        if (s === "i") {
            if (exact === false)
                return inexactRectangular(INEXACT_ZERO, toFlonum(1));
            return I;
        }
        if (s === "-i") {
            if (exact === false)
                return inexactRectangular(INEXACT_ZERO, toFlonum(-1));
            return M_I;
        }

        var match = (radix === 10 ? decimalComplex : radixComplex).exec(s);
        var x, y;
        if (match) {
            x = match[1];
            y = match[2];
            x = (x ? parseReal(x) : (exact === false ? INEXACT_ZERO : ZERO));
            y = (y === "+" ? ONE : (y === "-" ? M_ONE : parseReal(y)));
        }
        else {
            // Could be "3i" for example.
            x = (exact === false ? INEXACT_ZERO : ZERO);
            y = parseReal(s.substring(0, s.length - 1));
        }

        return makeRectangular(x, y);
    }

    // Parse a real that had a |p attached.
    // See the second half of R6RS Section 4.2.8 and also
    // http://www.mail-archive.com/r6rs-discuss@lists.r6rs.org/msg01676.html.
    function parseWithWidth(s, precision) {

        // First, parse it as exact.
        var x = stringToNumber(s, radix, true);
        if (x === false || !isReal(x))
            lose();

        if (!isZero(x)) {
            var xabs = abs(x);

            var shift = precision - natFloor(log(xabs) / LN2) - 1;
            var scale = expt(TWO, nativeToExactInteger(natAbs(shift)));
            if (shift < 0)
                scale = reciprocal(scale);
            var shifted = multiply(xabs, scale);

            // Correct for log() imprecision.
            var denom = expt(TWO, nativeToExactInteger(precision));
            while (ge(shifted, denom)) {
                shifted = divide(shifted, TWO);
                scale = divide(scale, TWO);
            }
            for (var twiceShifted = add(shifted, shifted);
                 lt(twiceShifted, denom);
                 twiceShifted = add(shifted, shifted)) {
                shifted = twiceShifted;
                scale = add(scale, scale);
            }

            // 0.5 <= shifted/denom < 1.
            var rounded = divide(round(shifted), scale);
            if (isNegative(x))
                rounded = negate(rounded);
            x = rounded;
        }

        // Then make it inexact unless there is #e.
        if (!exact)
            x = toInexact(x);

        return x;
    }

    // Common cases first.
    if (!radix || radix === 10) {
        if (/^-?[0-9]{1,15}$/.test(s)) {
            if (exact === false)
                return toFlonum(_parseInt(s, 10));
            return nativeToExactInteger(_parseInt(s, 10));
        }
        radix = 10;
    }

    var i = 0;

    try {
        while (s[i] === "#") {
            switch (s[i+1]) {
            case 'i': case 'I': setExact(false); break;
            case 'e': case 'E': setExact(true ); break;
            case 'b': case 'B': setRadix( 2); break;
            case 'o': case 'O': setRadix( 8); break;
            case 'd': case 'D': setRadix(10); break;
            case 'x': case 'X': setRadix(16); break;
            default: return false;
            }
            i += 2;
        }
        return parseComplex(s.substring(i));
    }
    catch (e) {
        if (e === PARSE_ERROR)
            return false;
        if (s == undefined)
            raise("&assertion", "missing argument");
        throw e;
    }
}

// SN: private alias for the public SchemeNumber object.
function SN(obj) {
    if (obj instanceof N) {
        return obj;
    }

    var ret = obj;

    if (typeof ret !== "string") {
        if (typeof ret === "number") {
            return toFlonum(ret);
        }
        if (ret instanceof Number) {
            return toFlonum(+ret);
        }

        if (ret == null) {
            // XXX Rethink this.
            return (ret === null ? INEXACT_ZERO : NAN);
        }

        ret = ret.valueOf();
        if (typeof ret === "number") {
            return toFlonum(ret);
        }
        ret = String(ret);
    }
    ret = stringToNumber(ret);
    if (ret === false) {
        raise("&assertion", "not a number", obj);
    }
    return ret;
}
// For NaturalDocs:
var SchemeNumber = SN;

SN.disp = disp;// XXX debugging

/*
    Property: VERSION
    Library version as an array of integers.

    For example, *[1,2,4]* corresponds to Version 1.2.4.
*/
SchemeNumber.VERSION = [1,3,0];

function assertReal(x) {
    if (!isReal(x))
        raise("&assertion", "not a real number", x);
    return x;
}

function toReal(x) {
    x = SN(x);
    isReal(x) || assertReal(x);
    return x;
}

function assertInteger(n) {
    n = SN(n);
    if (!isInteger(n))
        raise("&assertion", "not an integer", n);
    return n;
}

function toInteger(n) {
    n = SN(n);
    isInteger(n) || assertInteger(n);
    return n;
}

function assertExact(z) {
    if (isInexact(z))
        raise("&assertion", "inexact number", z);
    return z;
}

/*
    Property: raise
    Function that translates a Scheme exception to ECMAScript.

    When a library function encounters a situation where the Scheme
    specification requires it to raise an exception with a certain
    condition type, the function calls <SchemeNumber.raise>.

    Programs may assign a custom function to <SchemeNumber.raise> to
    intercept such exceptions.

    Parameters:

        conditionType - The specified condition, for example, "&assertion".
        message       - A string describing the error.
        irritants...  - Zero or more erroneous data arguments.

    Returns:

        The default <SchemeNumber.raise> function simply throws an
        *Error*.

    See Also:

        <fn>, <SchemeNumber>
*/
SchemeNumber.raise = defaultRaise;

function defaultRaise(conditionType, message, irritant) {
    var msg = "SchemeNumber: " + conditionType + ": " + message;
    if (arguments.length > 2) {
        if (isNumber(irritant))
            irritant = numberToString(irritant);
        msg += ": " + irritant;
    }
    throw new Error(msg);
}

function raise() {
    var len = arguments.length;
    var args = new Array(len);
    while (len--)
        args[len] = arguments[len];

    // Call the exception hook.
    SN.raise.apply(SN, args);

    // Oops, it returned.  Fall back to our known good raiser.
    defaultRaise.apply(this, args);
}

/*
    Property: maxIntegerDigits
    Maximum size of integers created by the <fn.expt(z1, z2)>
    function.

    To avoid using up all system memory, exact results of a call to
    <fn.expt(z1, z2)> are capped at a configurable number of digits,
    by default one million.  <SchemeNumber.maxIntegerDigits> holds
    this limit.

    The size limit does *not* currently protect against other means of
    creating large exact integers.  For example, when passed
    "#e1e9999999", the <SchemeNumber> function tries to allocate 10
    million digits, regardless of <maxIntegerDigits>.

    In a future release, cases such as the preceeding example may be
    checked.  If there is any possibility of legitimately creating
    such large integers, either as number objects or components
    thereof, code should increase <maxIntegerDigits>.

    Default Value:

        - 1000000 (1e6 or 1 million)
*/

// Configurable maximum integer magnitude.
SN.maxIntegerDigits = 1e6;  // 1 million digits.

/*
    Method: toString(radix)
    Converts this Scheme number to a string.

    The *toString* method converts inexact numbers as in JavaScript
    and exact numbers as if by <fn["number->string"](z, radix)>.

    Method: toFixed(fractionDigits)
    Returns this Scheme number as a string with *fractionDigits*
    digits after the decimal point.

    Examples:

    > SchemeNumber("#e1.2").toFixed(2)  // "1.20"
    > SchemeNumber("1/7").toFixed(24)   // "0.142857142857142857142857"

    Specified by: <ECMA-262, 5th edition at http://www.ecma-international.org/publications/standards/Ecma-262.htm>

    Method: toExponential(fractionDigits)
    Converts this Scheme number to scientific "e" notation with
    *fractionDigits* digits after the decimal point.

    Examples:

    > SchemeNumber("1/11").toExponential(3)  // "9.091e-2"
    > SchemeNumber("1/2").toExponential(2)   // "5.00e-1"

    Specified by: <ECMA-262, 5th edition at http://www.ecma-international.org/publications/standards/Ecma-262.htm>

    Method: toPrecision(precision)
    Converts this Scheme number to decimal (possibly "e" notation)
    with *precision* significant digits.

    Examples:

    > SchemeNumber("12300").toPrecision(2)  // "1.2e+4"
    > SchemeNumber("12300").toPrecision(4)  // "1.230e+4"
    > SchemeNumber("12300").toPrecision(5)  // "12300"
    > SchemeNumber("12300").toPrecision(6)  // "12300.0"

    Specified by: <ECMA-262, 5th edition at http://www.ecma-international.org/publications/standards/Ecma-262.htm>
 */

/*
    Property: fn
    Container of <Scheme functions>.

    The <SchemeNumber> object contains a property, <SchemeNumber.fn>,
    which in turn contains the functions implementing the Scheme
    numeric types.

    These functions are stored in <fn> under their Scheme names, so
    ["quotation"] is needed where the names contain characters that
    are incompatible with dot.notation.  (In JavaScript, *X.Y* and
    *X["Y"]* are equivalent expressions where Y is a valid identifier.
    Not all Scheme function names are valid JavaScript identifiers, so
    one needs the second syntax to extract them from <fn>.)

    You may find it convenient to copy <SchemeNumber>, <fn>, and the
    output function <number->string> into short-named variables, by
    convention *sn*, *fn*, and *ns*.  The rest of this section assumes
    you have done this:

    > var sn = SchemeNumber;
    > var fn = sn.fn;
    > var ns = fn["number->string"];

    Functions that require a Scheme number argument automatically
    filter the argument through <SchemeNumber>.

    For example, *"2"* (string) would be exact (parsed as Scheme) but
    *2* (equal to *2.0*) would be inexact, as demonstrated:

    > a1 = fn["exact?"]("2");       // a1 === true
    > a1 = fn["exact?"](sn("2"));   // same
    > 
    > a2 = fn["exact?"](2);         // a2 === false
    > a2 = fn["exact?"]("2.0");     // same
    > a2 = fn["exact?"](sn("2.0")); // same

    Note that the following functions accept arguments of any type and
    therefore do not apply <SchemeNumber> to their arguments:

    - <eqv?>
    - <number?>
    - <complex?>
    - <real?>
    - <rational?>
    - <integer?>
    - <real-valued?>
    - <rational-valued?>
    - <integer-valued?>

    Here, for example, is 2 to the 1,024th power, as a decimal
    string:

    > a3 = ns(fn.expt("2", "1024"));

    Fractional
    arithmetic:

    > a4 = fn["+"]("1/3", "4/5");  // 17/15

    Numerator and denominator of a floating-point value,
    hexadecimal:

    > a5 = ns(fn.numerator(1/3), "16");    // "#i15555555555555"
    > a6 = ns(fn.denominator(1/3), "16");  // "#i40000000000000"

    The *#i* prefix denotes an inexact number, as detailed in <R6RS at
    http://www.r6rs.org/>.  Since 1/3 is a native JavaScript number,
    the library regards it as inexact, and operations such as
    numerator yield inexact integer results.  If we used *"1/3"*
    (quoted) instead of *1/3*, the numerator and denominator would be
    the mathematically correct 1 and 3.

    Functions specified to return two values (such as <div-and-mod>
    and <exact-integer-sqrt>) return a two-element array as per
    JavaScript conventions.

    Caveats:

      o Arcane features such as explicit mantissa widths or complex
        transcendental functions, while believed complete, are
        unoptimized.

      o The library exhibits other visible behaviors besides those
        described herein.  However, they are not part of its public
        API and may change or disappear from one release to the next.

      o In particular, Scheme numbers' *toString* property sometimes
        produces output that is incorrect in the Scheme sense.  (This
        stems from the decision to represent inexact reals as
        unadorned native numbers.)

    To serialize numbers as Scheme would, use
    <SchemeNumber.fn["number->string"]>.

    > "" + SchemeNumber(2);                  // "2"
    > SchemeNumber.fn["number->string"](2);  // "2."

    To test a Scheme number for numerical equality with another Scheme
    number or a native value, use <fn["="]>.  Likewise for <fn[">"]>
    etc.

    See Also:

        <Scheme functions>
*/
SchemeNumber.fn = {

/*
    About: Function list

    All <Scheme functions> are specified by <R6RS at
    http://www.r6rs.org/>.  In the list below, argument names indicate
    applicable types as follows:

    obj - any value
    z - any Scheme number
    x - a real number
    y - a real number
    q - a rational number (excludes infinities and NaN)
    n - an integer
    k - an exact, non-negative integer
    radix - an exact integer, either 2, 8, 10, or 16
    precision - an exact, positive integer

    Functions: Scheme functions
    Elements of <fn>.

    Refer to the argument type key under <Function list>.

    fn["number?"](obj)   - Returns true if *obj* is a Scheme number.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_440>.

    fn["complex?"](obj)  - Returns true if *obj* is a Scheme complex number.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_442>.

    fn["real?"](obj)     - Returns true if *obj* is a Scheme real number.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_444>.

    fn["rational?"](obj) - Returns true if *obj* is a Scheme rational number.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_446>.

    fn["integer?"](obj)  - Returns true if *obj* is a Scheme integer.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_448>.

    fn["real-valued?"](obj) - Returns true if *obj* is a Scheme complex number
                              and *fn["imag-part"](obj)* is zero.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_450>.

    fn["rational-valued?"](obj) - Returns true if *obj* is real-valued and
                                  *fn["real-part"](obj)* is rational.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_452>.

    fn["integer-valued?"](obj)  - Returns true if *obj* is real-valued and
                                  *fn["real-part"](obj)* is an integer.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_454>.

    fn["exact?"](z)   - Returns true if *z* is exact.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_456>.

    fn["inexact?"](z) - Returns true if *z* is inexact.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_458>.

    fn.inexact(z) - Returns an inexact number equal to *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_460>.

    fn.exact(z)   - Returns an exact number equal to *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_462>.

    fn["eqv?"](obj1, obj2) - Returns true if *obj1 === obj2* or both arguments
                             are Scheme numbers and behave identically.
                             Specified by <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_428>.

    fn["="](z, z, z...) - Returns true if all arguments are mathematically
                          equal, though perhaps differing in exactness.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_464>.

    fn["<"](x, x, x...) - Returns true if arguments increase monotonically.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_466>.

    fn[">"](x, x, x...) - Returns true if arguments decrease monotonically.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_468>.

    fn["<="](x, x, x...) - Returns true if arguments are monotonically
                           nondecreasing.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_470>.

    fn[">="](x, x, x...) - Returns true if arguments are monotonically
                           nonincreasing.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_472>.

    fn["zero?"](z)      - Returns true if *z* equals zero.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_474>.

    fn["positive?"](x)  - Returns true if *x* is positive.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_476>.

    fn["negative?"](x)  - Returns true if *x* is negative.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_478>.

    fn["odd?"](n)       - Returns true if *n* is odd.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_480>.

    fn["even?"](n)      - Returns true if *n* is even.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_482>.

    fn["finite?"](x)    - Returns true if *x* is finite.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_484>.

    fn["infinite?"](x)  - Returns true if *x* is plus or minus infinity.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_486>.

    fn["nan?"](x)       - Returns true if *x* is a NaN.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_488>.

    fn.max(x, x...)     - Returns the greatest argument.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_490>.

    fn.min(x, x...)     - Returns the least argument.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_492>.

    fn["+"](z...)       - Returns the sum of the arguments.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_494>.

    fn["*"](z...)       - Returns the product of the arguments.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_496>.

    fn["-"](z)          - Returns the negation of *z* (-*z*).
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_498>.

    fn["-"](z1, z2...)  - Returns *z1* minus the sum of the number(s) *z2*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_500>.

    fn["/"](z)          - Returns the reciprocal of *z* (1 / *z*).
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_502>.

    fn["/"](z1, z2...)  - Returns *z1* divided by the product of the number(s)
    *z2*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_504>.

    fn.abs(x)           - Returns the absolute value of *x*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_506>.

    fn["div-and-mod"](x, y) - Returns *fn.div(x, y)* and *fn.mod(x, y)*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_508>.

    fn.div(x, y)        - Returns the greatest integer less than or equal to
                          *x* / *y*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_510>.

    fn.mod(x, y)        - Returns *x* - (*y* * fn.div(*x*, *y*)).
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_512>.

    fn["div0-and-mod0"](x, y) - Returns *fn.div0(x, y)* and *fn.mod0(x, y)*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_514>.

    fn.div0(x, y)       - Returns the integer nearest *x* / *y*, ties go lower.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_516>.

    fn.mod0(x, y)       - Returns *x* - (*y* * fn.div0(*x*, *y*)).
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_518>.

    fn.gcd(n...) - Returns the arguments' greatest common non-negative divisor.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_520>.

    fn.lcm(n...) - Returns the arguments' least common positive multiple.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_522>.

    fn.numerator(q)     - Returns *q* * *fn.denominator(q)*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_524>.

    fn.denominator(q)   - Returns the smallest positive integer which when
                          multiplied by *q* yields an integer.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_526>.

    fn.floor(x)         - Returns the greatest integer not greater than *x*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_528>.

    fn.ceiling(x)       - Returns the least integer not less than *x*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_530>.

    fn.truncate(x)      - Returns the closest integer between 0 and *x*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_532>.

    fn.round(x)         - Returns the closest integer to *x*, ties go even.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_534>.

    fn.rationalize(x, y) - Returns the simplest fraction within *y* of *x*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_536>.

    fn.exp(z)           - Returns e to the *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_540>.

    fn.log(z)           - Returns the natural logarithm of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_542>.

    fn.log(z1, z2)      - Returns the base-*z2* logarithm of *z1*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_544>.

    fn.sin(z)           - Returns the sine of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_546>.

    fn.cos(z)           - Returns the cosine of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_548>.

    fn.tan(z)           - Returns the tangent of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_550>.

    fn.asin(z)          - Returns a number whose sine is *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_552>.

    fn.acos(z)          - Returns a number whose cosine is *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_554>.

    fn.atan(z)          - Returns a number whose tangent is *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_556>.

    fn.atan(y, x)       - Returns the angle that passes through *(x,y)*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_558>.

    fn.sqrt(z)          - Returns the square root of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_560>.

    fn["exact-integer-sqrt"](k) - Returns maximal exact s and non-negative r
                                  such that s*s + r = *k*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_562>.

    fn.expt(z1, z2) - Returns *z1* to the power *z2*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_564>.

    fn["make-rectangular"](x, y) - Returns the complex number *x + iy*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_566>.

    fn["make-polar"](r, theta) - Returns the complex number with magnitude *r*
                                 and angle *theta*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_568>.

    fn["real-part"](z) - Returns x such that *z* = x + iy.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_570>.

    fn["imag-part"](z) - Returns y such that *z* = x + iy.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_572>.

    fn.magnitude(z)    - Returns the magnitude of *z*.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_574>.

    fn.angle(z)        - Returns *fn.atan(y,x)* where *z* = x + iy.
    Specified by: <R6RS at http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_576>.

    Function: fn["number->string"](z)
    Converts *z* to a string, base 10.

    For exact *z*, *number->string* retains full precision.  Exact
    fractions are expressed as numerator + "/" + denominator.
    Examples:

    > fn["number->string"](fn["string->number"]("#e1.2"))  // "6/5"
    > fn["number->string"](fn["/"]("12", "-8"))            // "-3/2"

    Infinities are "+inf.0" and "-inf.0".  NaN is "+nan.0".

    The result always yields a number equal to *z* (in the sense of
    <fn["eqv?"](obj1, obj2)>) when passed to
    <fn["string->number"](string)>.

    Specified by: <R6RS at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_578>

    See Also: <fn["string->number"](string)>.

    Function: fn["number->string"](z, radix)
    Converts *z* to a string, base *radix*.
    *radix* must be exact 2, 8, 10, or 16.

    The output never contains an explicit radix prefix.

    The result always yields a value equal to *z* (in the sense of
    <fn["eqv?"](obj1, obj2)>) when converted back to a number by
    <fn["string->number"](string, radix)>.

    Specified by: <R6RS at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_580>

    See Also: <fn["string->number"](string, radix)>.

    Function: fn["number->string"](z, radix, precision)
    Converts and suffixes *z* with a count of significant bits.

    Appends "|p" to each inexact real component of *z* where p is the
    smallest mantissa width not less than *precision* needed to
    represent the component exactly.

    Specified by: <R6RS at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_582>

    Function: fn["string->number"](string)
    Parses *string* as a Scheme number.  Returns *false* if unable.

    Examples:

    > "1"       - exact 1.
    > "1."      - inexact 1, same as "1.0".
    > "1/2"     - exact one-half, same as "2/4" etc.
    > "0.5"     - inexact 0.5.
    > "12e3"    - inexact 12000.
    > "i"       - the imaginary unit.
    > "-2+1/2i" - exact complex number.
    > "2.@1"    - complex in polar coordinates, r=2.0, theta=1.0.
    > "+inf.0"  - positive infinity.
    > "-inf.0"  - negative infinity.
    > "+nan.0"  - IEEE NaN (not-a-number).
    > "#e0.5"   - exact one-half, forced exact by prefix #e.
    > "#i1/2"   - 0.5, inexact by prefix #i.
    > "#x22"    - exact 34; prefix #x hexadecimal.
    > "#o177"   - exact 127; prefix #o octal.
    > "#b101"   - exact 5; prefix #b binary.
    > "#i#b101" - inexact 5.0.
    > "#b#i101" - same.
    > "1.2345678|24" - rounded as if to single-precision (about 1.23456776).

    Specified by: <R6RS at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_584>

    See Also: <fn["number->string"](z)>, <R6RS section 4.2.8: Lexical
    syntax: Numbers at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-7.html#node_sec_4.2.8>

    Function: fn["string->number"](string, radix)
    Parses *string* as a Scheme number using *radix* as default radix.

    *radix* must be exact 2, 8, 10, or 16.  If *string* contains a
    radix prefix, the prefix takes precedence over *radix*.

    Specified by: <R6RS at
    http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_idx_586>

    See Also: <fn["number->string"](z, radix)>.
*/

    "eqv?"      : fn_isEqv,
    "number?"   : fn_isNumber,
    "complex?"  : fn_isComplex,
    "real?"     : fn_isReal,
    "rational?" : fn_isRational,
    "integer?"  : fn_isInteger,
    "real-valued?"     : fn_isRealValued,
    "rational-valued?" : fn_isRationalValued,
    "integer-valued?"  : fn_isIntegerValued,

    "exact?"   : makeUnary(isExact),
    "inexact?" : makeUnary(isInexact),

    inexact : makeUnary(toInexact),
    exact   : makeUnary(toExact),

    "="  : fn_equals,
    "<"  : makeComparator(lt),
    ">"  : makeComparator(gt),
    "<=" : makeComparator(le),
    ">=" : makeComparator(ge),

    "zero?"     : makeUnary(isZero),
    // XXX All these makeUnary functions should assert their argument type.
    "positive?" : makeUnary(isPositive),
    "negative?" : makeUnary(isNegative),
    "odd?"      : makeUnary(isOdd),
    "even?"     : makeUnary(isEven),
    "finite?"   : makeUnary(SN_isFinite),
    "infinite?" : makeUnary(SN_isInfinite),
    "nan?"      : makeUnary(SN_isNaN),

    max : makeMaxMin(gt),
    min : makeMaxMin(lt),

    "+" : function() {
        var ret = ZERO;
        var len = arguments.length;
        var i = 0;
        while (i < len)
            ret = add(ret, SN(arguments[i++]));
        return ret;
    },

    "*" : function() {
        var ret = ONE;
        var len = arguments.length;
        var i = 0;
        while (i < len)
            ret = multiply(ret, SN(arguments[i++]));
        return ret;
    },

    "-" : function(a) {
        var len = arguments.length;

        switch (len) {
        case 0: args1plus(arguments);
        case 1: return negate(SN(a));
        }
        var ret = SN(a);
        var i = 1;
        while (i < len)
            ret = subtract(ret, SN(arguments[i++]));
        return ret;
    },

    "/" : function(a) {
        var len = arguments.length;

        switch (len) {
        case 0: args1plus(arguments);
        case 1: return reciprocal(SN(a));
        case 2: return divide(SN(a), SN(arguments[1]));
        }
        var product = ONE;
        var i = 1;
        while (i < len)
            product = multiply(product, SN(arguments[i++]));
        return divide(SN(a), product);
    },

    abs             : makeUnary(abs),
    "div-and-mod"   : makeDivMod(false, 2),
    div             : makeDivMod(false, 0),
    mod             : makeDivMod(false, 1),
    "div0-and-mod0" : makeDivMod(true, 2),
    div0            : makeDivMod(true, 0),
    mod0            : makeDivMod(true, 1),

    gcd : function() {
        var ret = ZERO;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && isExact(arg);
            ret = gcdNonnegative(ret, toExact(abs(arg)));
        }
        ret = abs(ret);
        return (exact ? ret : toInexact(ret));
    },

    lcm : function() {
        var ret = ONE;
        var len = arguments.length;
        var exact = true;
        for (var i = 0; i < len; i++) {
            var arg = toInteger(arguments[i]);
            exact = exact && isExact(arg);
            arg = toExact(abs(arg));
            ret = divide(multiply(ret, arg), gcdNonnegative(ret, abs(arg)));
        }
        return (exact ? ret : toInexact(ret));
    },

    numerator   : makeUnary(numerator),
    denominator : makeUnary(denominator),
    floor       : makeUnary(floor),
    ceiling     : makeUnary(ceiling),
    truncate    : makeUnary(truncate),
    round       : makeUnary(round),
    rationalize : rationalize,
    exp         : makeUnary(exp),

    log : function(z, base) {
        var ret = log(SN(z));
        switch (arguments.length) {
        case 2: ret = divide(ret, log(SN(base)));  // fall through
        case 1: return ret;
        default: wrongArgCount("1-2", arguments);
        }
    },

    sin  : makeUnary(sin),
    cos  : makeUnary(cos),
    tan  : makeUnary(tan),
    asin : makeUnary(asin),
    acos : makeUnary(acos),

    atan : function(y, x) {
        switch (arguments.length) {
        case 1: return atan(SN(y));
        case 2: return atan2(toReal(y), toReal(x));
        default: wrongArgCount("1-2", arguments);
        }
    },

    sqrt : makeUnary(sqrt),
    "exact-integer-sqrt" : makeUnary(exactIntegerSqrt),
    expt : makeBinary(expt),

    "make-rectangular" : function(x, y) {
        arguments.length === 2 || args2(arguments);
        return makeRectangular(toReal(x), toReal(y));
    },

    "make-polar" : function(r, theta) {
        arguments.length === 2 || args2(arguments);
        return makePolar(toReal(r), toReal(theta));
    },

    "real-part" : makeUnary(realPart),
    "imag-part" : makeUnary(imagPart),
    magnitude   : makeUnary(magnitude),
    angle       : makeUnary(angle),

    "number->string" : function(z, radix, precision) {
        var r = radix;
        switch (arguments.length) {
        case 3:
            precision = toInteger(precision);
            assertExact(precision);
            // fall through
        case 2:
            r = assertExact(toInteger(r)).valueOf();
            if (!uintegerPattern[r])
                raise("&assertion", "invalid radix", radix);
            // fall through
        case 1: break;
        default: wrongArgCount("1-3", arguments);
        }
        return numberToString(SN(z), r, precision);
    },

    "string->number" : function(s, radix) {
        switch (arguments.length) {
        case 1:
        case 2: return stringToNumber(String(s), radix);
        default: wrongArgCount("1-2", arguments);
        }
    }
};

// Scheme function helpers.

function wrongArgCount(expected, a) {
    var msg = "Function"

    for (name in fn) {
        if (fn[name] === a.callee) {
            msg += " '" + name + "'";
            break;
        }
    }
    raise("&assertion", msg + " expected " + expected +
          " argument" + (expected == "1" ? "" : "s") + ", got " + a.length);
}

function args1(a) { a.length === 1 || wrongArgCount(1, a); }
function args2(a) { a.length === 2 || wrongArgCount(2, a); }

function args1plus(a) { a.length > 0 || wrongArgCount("1 or more", a); }
function args2plus(a) { a.length > 1 || wrongArgCount("2 or more", a); }

function fn_isEqv(a, b) {
    arguments.length === 2 || args2(arguments);
    if (a === b)
        return true;
    if (!isNumber(a) || !isNumber(b))
        return false;
    return (eq(a, b) && isExact(a) === isExact(b));
}

function fn_isNumber(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x);
}

function fn_isComplex(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x) && isComplex(x);
}

function fn_isReal(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x) && isReal(x);
}

function fn_isRational(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x) && isRational(x);
}

function fn_isInteger(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x) && isInteger(x);
}

function fn_isRealValued(x) {
    arguments.length === 1 || args1(arguments);
    return isNumber(x) && isComplex(x) && isZero(imagPart(x));
}

function fn_isRationalValued(x) {
    arguments.length === 1 || args1(arguments);
    return fn_isRealValued(x) && isRational(realPart(x));
}

function fn_isIntegerValued(x) {
    arguments.length === 1 || args1(arguments);
    return fn_isRealValued(x) && isInteger(realPart(x));
}

function fn_equals(a, b) {
    var len = arguments.length;
    len > 1 || args2plus(arguments);
    a = SN(a);
    for (var i = 1; i < len; i++) {
        if (!eq(a, SN(arguments[i])))
            return false;
    }
    return true;
}

function makeUnary(func) {
    function unary(a) {
        arguments.length === 1 || args1(arguments);
        return func(SN(a));
    }
    return unary;
}

function makeBinary(func) {
    function binary(a, b) {
        arguments.length === 2 || args2(arguments);
        return func(SN(a), SN(b));
    }
    return binary;
}

function makeComparator(cmp) {
    function comparator(a, b) {
        var len = arguments.length;
        len > 1 || args2plus(arguments);
        b = toReal(b);
        if (!cmp(toReal(a), b))
            return false;
        for (var i = 2; i < len; i++) {
            var c = toReal(arguments[i]);
            if (!cmp(b, c))
                return false;
            b = c;
        }
        return true;
    }
    return comparator;
}

function makeMaxMin(cmp) {
    function maxMin(a) {
        var len = arguments.length;
        len > 0 || args1plus(arguments);

        var ret = toReal(a);
        var exact = isExact(ret);

        for (var i = 1; i < len; i++) {
            var x = toReal(arguments[i]);
            if (SN_isNaN(x))
                return x;
            if (exact) {
                exact = isExact(x);
                if (!exact)
                    ret = toInexact(ret);  // XXX Cheaper comparisons?
            }
            if (cmp(x, ret) !== false) {
                ret = x;
            }
        }
        return exact ? ret : toInexact(ret);
    }
    return maxMin;
}

function divModArg2Zero(arg) {
    raise("&assertion", "div/mod second argument is zero", arg);
}

function makeDivMod(is0, which) {
    function divMod(x, y) {
        arguments.length === 2 || args2(arguments);
        x = toReal(x);
        y = toReal(y);

        if (!isFinite(x))
            raise("&assertion", "div/mod first argument is not finite", x);
        if (isZero(y))
            divModArg2Zero(y);

        if (!is0) {
            switch (which) {
            case 0: return div(x, y);
            case 1: return mod(x, y);
            case 2: default: return divAndMod(x, y);
            }
        }

        var dm = divAndMod(x, y);
        var m = dm[1];
        var yabs = abs(y);

        if (ge(add(m, m), yabs)) {
            switch (which) {
            case 0: return add(dm[0], isNegative(y) ? M_ONE : ONE);
            case 1: return subtract(m, yabs);
            case 2: default: return [add(dm[0], isNegative(y) ? M_ONE : ONE),
                                     subtract(m, yabs)];
            }
        }
        switch (which) {
        case 0: return dm[0];
        case 1: return m;
        case 2: default: return dm;
        }
    }
    return divMod;
}

/* Rationalize is not a method, because I consider it broken by design.
   It should operate on an open, not closed interval. */

function rationalize(x, delta) {
    args2(arguments);
    x = SN(x);
    delta = SN(delta);

    // Handle weird cases first.
    if (!isFinite(x) || !isFinite(delta)) {
        assertReal(x);
        assertReal(delta);
        if (isInfinite(delta))
            return (isFinite(x) ? INEXACT_ZERO : NAN);
        if (SN_isNaN(delta))
            return delta;
        return x;
    }

    if (isZero(delta))
        return x;

    delta = abs(delta);  // It's what PLT and Mosh seem to do.

    var x0 = subtract(x, delta);
    var x1 = add(x, delta);
    var a = floor(x0);
    var b = floor(x1);

    if (ne(a, b)) {
        var negative = isNegative(a);
        if (isNegative(b) != negative)
            return (isExact(a) ? ZERO : INEXACT_ZERO);
        return (negative ? b : ceiling(x0));
    }
    var cf = [];  // Continued fraction, b implied.

    while (true) {
        x0 = subtract(x0, a);
        if (isZero(x0))
            break;
        x1 = subtract(x1, a);
        if (isZero(x1))
            break;

        x0 = reciprocal(x0);
        x1 = reciprocal(x1);
        a = floor(x0);

        switch (compare(a, floor(x1))) {
        case -1: cf.push(ceiling(x0)); break;
        case  1: cf.push(ceiling(x1)); break;
        case 0: default:
            cf.push(a);
            continue;
        }
        break;
    }
    var ret = ZERO;
    var i = cf.length;
    while (i--)
        ret = reciprocal(add(ret, cf[i]));
    return add(ret, b);
}

function raiseDivisionByExactZero() {
    raise("&assertion", "division by exact zero");
}

function complexExpt(b, p) {
    if (isZero(b)) {
        if (isZero(p))
            return isExact(b) && isExact(p) ? ONE : INEXACT_ONE;
        if (isPositive(realPart(p)))
            return isExact(p) ? b : INEXACT_ZERO;
        raise("&implementation-restriction", "invalid power for zero expt", p);
    }
    return exp(multiply(log(b), p));
}

function complexExpt_method(p) {
    return complexExpt(this, p);
}

function complexAsin(z) {
    return multiply(M_I, log(add(multiply(I, z),
                                 sqrt(subtract(ONE, square(z))))));
}

function complexAcos(z) {
    return subtract(divide(PI, TWO), complexAsin(z));
}

function complexAtan(z) {
    var iz = multiply(I, z);
    return multiply(divide(subtract(log(add(ONE, iz)),
                                    log(subtract(ONE, iz))), TWO), M_I);
}

function complexLog(z) {
    return makeRectangular(log(magnitude(z)), angle(z));
};

// Return a string of "0" and "1" characters, possibly including a "."
// and possibly a leading "-", that in base 2 equals x.  This works by
// calling Number.prototype.toString with a radix of 2.  Specification
// ECMA-262 Edition 5 (December 2009) does not strongly assert that
// this works.  As an alternative, should this prove non-portable,
// nativeDenominator could instead do:
// for (d = 1; x !== floor(x); d *= 2) { x *= 2; } return d;
function numberToBinary(x) {
    return x.toString(2);
}

function nativeDenominatorLog2(x) {
    //assert(typeof x === "number");
    //assert(_isFinite(x));
    var s = numberToBinary(natAbs(x));
    var i = s.indexOf(".");
    if (i === -1)
        return 0;
    return s.length - i - 1;
}

function nativeDenominator(x) {
    // Get the "denominator" of a floating point value.
    // The result will be a power of 2.
    //assert(_isFinite(x));
    return natPow(2, nativeDenominatorLog2(x));
}

/*
    Property: pluginApi
    Container of functions and objects used (and, in some cases,
    extended) by number type implementations.

    interfaces - the first argument passed to <makeBase>

    defClass - TO DO: document.

    defGeneric - TO DO: document.

    stringToNumber     - see <makeBase>

    parseInexact       - see <makeBase>

    toFlonum           - see <makeBase>

    parseExactInteger  - see <makeBase>

    nativeToExactInteger - see <makeBase>

    divideReduced      - see <makeBase>

    I                  - see <makeBase>

    MINUS_I            - see <makeBase>

    exactRectangular   - see <makeBase>

    inexactRectangular - see <makeBase>

    makePolar          - see <makeBase>

    raise - function(conditionType, message, irritants...)
    forwards its arguments to <SchemeNumber.raise> and handles errors
    in that function, namely returning when it shouldn't.

    raiseDivisionByExactZero - function()
    raises an exception to report division by exact zero

    TO DO: cleanup/document the rest.
*/
SN.pluginApi = {

    interfaces         : interfaces,

    defClass           : disp.defClass,
    defGeneric         : disp.defGeneric,
    getConstructor     : disp.getConstructor,

    stringToNumber     : stringToNumber,
    parseInexact       : parseInexact,
    toFlonum           : toFlonum,
    parseExactInteger  : parseExactInteger,
    nativeToExactInteger : nativeToExactInteger,
    parserExp10        : parserExp10,
    divideReduced      : divideReduced || divide,
    I                  : I,
    MINUS_I            : M_I,
    exactRectangular   : exactRectangular,
    inexactRectangular : inexactRectangular,
    makePolar          : makePolar,

    pureVirtual        : pureVirtual,
    raise              : raise,
    raiseDivisionByExactZero: raiseDivisionByExactZero,

    complexExpt        : complexExpt,
    complexExpt_method : complexExpt_method,
    complexAcos        : complexAcos,
    complexAsin        : complexAsin,
    complexAtan        : complexAtan,
    complexLog         : complexLog,
    numberToBinary     : numberToBinary,
    nativeDenominatorLog2: nativeDenominatorLog2,
    nativeDenominator  : nativeDenominator,

    numberToString     : numberToString,
    isExact            : isExact,
    isInexact          : isInexact,
    toExact            : toExact,
    toInexact          : toInexact,
    isComplex          : isComplex,
    isReal             : isReal,
    isRational         : isRational,
    isInteger          : isInteger,
    isZero             : isZero,
    negate             : negate,
    reciprocal         : reciprocal,
    square             : square,
    debug              : debug,
    eq                 : eq,
    ne                 : ne,
    add                : add,
    subtract           : subtract,
    multiply           : multiply,
    divide             : divide,
    expt               : expt,
    realPart           : realPart,
    imagPart           : imagPart,
    exp                : exp,
    magnitude          : magnitude,
    angle              : angle,
    sqrt               : sqrt,
    log                : log,
    asin               : asin,
    acos               : acos,
    atan               : atan,
    sin                : sin,
    cos                : cos,
    tan                : tan,
    isFinite           : SN_isFinite,
    isInfinite         : SN_isInfinite,
    isNaN              : SN_isNaN,
    abs                : abs,
    isPositive         : isPositive,
    isNegative         : isNegative,
    sign               : sign,
    floor              : floor,
    ceiling            : ceiling,
    truncate           : truncate,
    round              : round,
    compare            : compare,
    gt                 : gt,
    lt                 : lt,
    ge                 : ge,
    le                 : le,
    divAndMod          : divAndMod,
    div                : div,
    mod                : mod,
    atan2              : atan2,
    numerator          : numerator,
    denominator        : denominator,
    isUnit             : isUnit,
    isEven             : isEven,
    isOdd              : isOdd,
    exactIntegerSqrt   : exactIntegerSqrt,
    exp10              : exp10,
    gcdNonnegative     : gcdNonnegative,
};

return SN;
}


/*
    Function: makeTower(SN)
    A continuation of <makeBase>, this function registers the core
    interface classes with the dispatch system and defines functions
    on them where required by R6RS.

    Where a function does not have a reasonable generic implementation
    for a given class, *makeTower* defines it as abstract.

    *makeTower* defines the methods toFixed, toExponential, and
    toPrecision (specified by ECMAScript for Number) on exact reals.

    *SN* should be the result of a call to <makeBase>.

    See Also: <makeInterfaces>.
 */
function makeTower(SN) {

var pluginApi = SN.pluginApi;

var interfaces         = pluginApi.interfaces;
var N                  = interfaces.N;

var toFlonum           = pluginApi.toFlonum;
/*
var parseExactInteger  = pluginApi.parseExactInteger;
*/
var nativeToExactInteger = pluginApi.nativeToExactInteger;
var I                  = pluginApi.I;
var M_I                = pluginApi.MINUS_I;
/*
var exactRectangular   = pluginApi.exactRectangular;
var inexactRectangular = pluginApi.inexactRectangular;
*/
var makePolar          = pluginApi.makePolar;

var pureVirtual        = pluginApi.pureVirtual;
var raise              = pluginApi.raise;

var complexExpt        = pluginApi.complexExpt;
var complexExpt_method = pluginApi.complexExpt_method;
var complexAcos        = pluginApi.complexAcos;
var complexAsin        = pluginApi.complexAsin;
var complexAtan        = pluginApi.complexAtan;
var complexLog         = pluginApi.complexLog;

var defClass           = pluginApi.defClass;
/*
var defGeneric         = pluginApi.defGeneric;
*/

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

var ZERO = nativeToExactInteger(0);
var ONE  = nativeToExactInteger(1);
var TWO  = nativeToExactInteger(2);
var M_ONE = nativeToExactInteger(1);

var INEXACT_ZERO = toFlonum(0);
var INEXACT_ONE  = toFlonum(1);
var PI           = toFlonum(Math.PI);

var natFloor  = Math.floor;
var LN10      = Math.LN10;
var _parseInt = parseInt;

function retFalse()   { return false; }
function retTrue()    { return true;  }
function retThis()    { return this; }
function retZero()    { return ZERO; }
function retOne()     { return ONE; }

//
// SchemeNumber: everything for which fn["number?"] returns true.
//

defClass("SchemeNumber", {ctor: N});
function subclass(name, base) {
    return defClass(name, {extends: base, ctor: interfaces[name]});
}
var Complex       = subclass("Complex",       "SchemeNumber");
var Real          = subclass("Real",          "Complex");
var InexactReal   = subclass("InexactReal",   "Real");
var ExactReal     = subclass("ExactReal",     "Real");
var ExactRational = subclass("ExactRational", "ExactReal");
var ExactInteger  = subclass("ExactInteger",  "ExactRational");

numberToString.def("SchemeNumber", pureVirtual);

N.prototype.toFixed       = pureVirtual;
N.prototype.toExponential = pureVirtual;
N.prototype.toPrecision   = pureVirtual;

isExact.def(   "SchemeNumber", pureVirtual);
isComplex.def( "SchemeNumber", pureVirtual);
isReal.def(    "SchemeNumber", pureVirtual);
isRational.def("SchemeNumber", pureVirtual);
isInteger.def( "SchemeNumber", pureVirtual);
isZero.def(    "SchemeNumber", pureVirtual);

toExact.def(   "SchemeNumber", pureVirtual);
toInexact.def( "SchemeNumber", pureVirtual);
negate.def(    "SchemeNumber", pureVirtual);
reciprocal.def("SchemeNumber", pureVirtual);

eq.def(      "SchemeNumber", "SchemeNumber", pureVirtual);
add.def(     "SchemeNumber", "SchemeNumber", pureVirtual);
multiply.def("SchemeNumber", "SchemeNumber", pureVirtual);

// Definable in terms of the above:

N.prototype.toString       = pureVirtual;
N.prototype.toLocaleString = pureVirtual;

isInexact.def("SchemeNumber", pureVirtual);
square.def(   "SchemeNumber", pureVirtual);

ne.def(       "SchemeNumber", "SchemeNumber", pureVirtual);
subtract.def( "SchemeNumber", "SchemeNumber", pureVirtual);
divide.def(   "SchemeNumber", "SchemeNumber", pureVirtual);
// XXX expt should also accept inexact integer powers.
expt.def(     "SchemeNumber", "ExactInteger", pureVirtual);

// Not pureVirtual, since its absence from a particular class is not an error.
debug.def("SchemeNumber", function() {
    return "SchemeNumber(" + numberToString(this) + ")";
});

// Useful default implementations of some of the above:

N.prototype.toString = function(radix) {
    return numberToString(this, radix);
};

N.prototype.toLocaleString = function() {
    return this.toString();
};

function expt_N_EI(z, p) {
    // Return z raised to the power of integer p.
    var bits = abs(p);
    var squarer = z;
    var ret = ONE;
    while (isPositive(bits)) {
        if (isOdd(bits))
            ret = multiply(ret, squarer);
        squarer = square(squarer);
        bits = div(bits, TWO);
    }
    return (isNegative(p) ? reciprocal(ret) : ret);
}
function expt_N_EI_method(p) {
    return expt_N_EI(this, p);
}

expt.def("SchemeNumber", "ExactInteger", expt_N_EI_method);

square.def("SchemeNumber", function() {
    return multiply(this, this);
});

// Not-so-useful defaults, typically overridden:

isInexact.def("SchemeNumber", function() {
    return !isExact(this);
});

ne.def("SchemeNumber", "SchemeNumber", function(n) {
    return !eq(this, n);
});

subtract.def("SchemeNumber", "SchemeNumber", function(n) {
    return add(this, negate(n));
});

divide.def("SchemeNumber", "SchemeNumber", function(n) {
    return multiply(this, reciprocal(n));
});


//
// Complex: Abstract base class of complex numbers.
//

isComplex.def("Complex", retTrue);

realPart.def("Complex", pureVirtual);
imagPart.def("Complex", pureVirtual);

// Definable in terms of the above:

Complex.prototype.valueOf = pureVirtual;

expt.def("Complex", "Complex", pureVirtual);

exp.def(      "Complex", pureVirtual);
magnitude.def("Complex", pureVirtual);
angle.def(    "Complex", pureVirtual);
sqrt.def(     "Complex", pureVirtual);

log.def( "Complex", pureVirtual);
asin.def("Complex", pureVirtual);
acos.def("Complex", pureVirtual);
atan.def("Complex", pureVirtual);

sin.def("Complex", pureVirtual);
cos.def("Complex", pureVirtual);
tan.def("Complex", pureVirtual);

// Useful default implementations:

Complex.prototype.valueOf = function() {
    if (isZero(imagPart(this)))
        return realPart(this).valueOf();
    return NaN;
};
// If Real inherits the above function, it will loop infinitely.
Real.prototype.valueOf = pureVirtual;

sqrt.def("Complex", function() {
    return makePolar(sqrt(magnitude(this)), divide(angle(this), TWO));
});

// Complex transcendental functions here for completeness, not optimized.

log.def( "Complex", function() { return complexLog (this); });
asin.def("Complex", function() { return complexAsin(this); });
acos.def("Complex", function() { return complexAcos(this); });
atan.def("Complex", function() { return complexAtan(this); });

// The following expt definition is invalid for (ExactReal, ExactInteger)...
expt.def("Complex", "Complex", complexExpt_method);

// ... so override it.
expt.def("ExactReal", "ExactInteger", expt_N_EI_method);

// Avoid lots of work for inexact bases.
expt.def("Complex", "ExactInteger", function(n) {
    if (isExact(this))
        return expt_N_EI(this, n);
    return complexExpt(this, n);
});

sin.def("Complex", function() {
    var iz = multiply(I, this);
    return multiply(divide(subtract(exp(iz), exp(negate(iz))), TWO), M_I);
});

cos.def("Complex", function() {
    var iz = multiply(I, this);
    return divide(add(exp(iz), exp(negate(iz))), TWO);
});

tan.def("Complex", function() {
    return divide(sin(this), cos(this));
});


//
// Real: Abstract base class of real numbers.
//

isReal.def("Real", retTrue);

realPart.def("Real", retThis);
imagPart.def("Real", retZero);

SN_isFinite.def(  "Real", pureVirtual);
SN_isInfinite.def("Real", pureVirtual);

compare.def("Real", "Real", pureVirtual);
floor.def(  "Real", pureVirtual);

// Definable in terms of the above:

SN_isNaN.def("Real", pureVirtual);

isUnit.def(    "Real", pureVirtual);
abs.def(       "Real", pureVirtual);
isPositive.def("Real", pureVirtual);
isNegative.def("Real", pureVirtual);
sign.def(      "Real", pureVirtual);
ceiling.def(   "Real", pureVirtual);
truncate.def(  "Real", pureVirtual);
round.def(     "Real", pureVirtual);

gt.def(       "Real", "Real", pureVirtual);
lt.def(       "Real", "Real", pureVirtual);
ge.def(       "Real", "Real", pureVirtual);
le.def(       "Real", "Real", pureVirtual);
divAndMod.def("Real", "Real", pureVirtual);
div.def(      "Real", "Real", pureVirtual);
mod.def(      "Real", "Real", pureVirtual);
atan2.def(    "Real", "Real", pureVirtual);

// Useful default implementations:

isUnit.def("Real", function() {
    return eq(ONE, this) || eq(M_ONE, this);
});

magnitude.def("Real", function() {
    return abs(this);
});

angle.def("Real", function() {
    return isNegative(this) ? PI : ZERO;
});

isPositive.def("Real", function() {
    return sign(this) > 0;
});
isNegative.def("Real", function() {
    return sign(this) < 0;
});
sign.def("Real", function() {
    return compare(this, ZERO);
});

eq.def("Real", "Real", function(x) { return compare(this, x) === 0; });
ne.def("Real", "Real", function(x) { return compare(this, x) !== 0; });
gt.def("Real", "Real", function(x) { return compare(this, x) > 0; });
lt.def("Real", "Real", function(x) { return compare(this, x) < 0; });
ge.def("Real", "Real", function(x) { return compare(this, x) >= 0; });
le.def("Real", "Real", function(x) { return compare(this, x) <= 0; });

function div_R_R(x, y) {
    return (isNegative(y) ? ceiling(divide(x, y)) : floor(divide(x, y)));
}

divAndMod.def("Real", "Real", function(y) {
    var div = div_R_R(this, y);
    return [div, subtract(this, multiply(div, y))];
});
div.def("Real", "Real", function(y) {
    return div_R_R(this, y);
});
mod.def("Real", "Real", function(y) {
    return subtract(this, multiply(div_R_R(this, y), y));
});

// Commonly overridden default implementations:

SN_isNaN.def("Real", function() {
    return !SN_isFinite(this) && !SN_isInfinite(this);
});

abs.def("Real", function() {
    return isNegative(this) ? negate(this) : this;
});

ceiling.def("Real", function() {
    return isInteger(this) ? this : add(ONE, floor(this));
});
truncate.def("Real", function() {
    return isNegative(this) ? ceiling(this) : floor(this);
});
round.def("Real", function() {
    var ret = floor(this);
    var diff = subtract(this, ret);
    var twice = add(diff, diff);
    switch (compare(twice, ONE)) {
    case -1: return ret;
    case  1: return add(ONE, ret);
    case 0: default: return (isEven(ret) ? ret : add(ONE, ret));
    }
});

//
// InexactReal: Abstract base class of inexact real numbers.
//

isExact.def(  "InexactReal", retFalse);
isInexact.def("InexactReal", retTrue);
toInexact.def("InexactReal", retThis);


//
// ExactReal: Abstract base class of exact real numbers.
//

isExact.def(  "ExactReal", retTrue);
isInexact.def("ExactReal", retFalse);
toExact.def(  "ExactReal", retThis);

SN_isNaN     .def("ExactReal", retFalse);
SN_isFinite  .def("ExactReal", retTrue);
SN_isInfinite.def("ExactReal", retFalse);

function zeroes(count) {
    var ret = "000000000000000".substring(0, count & 15);
    if (count > 15)
        ret += new Array((count >> 4) + 1).join("0000000000000000");
    return ret;
}

// Specified by ECMA-262, 5th edition, 15.7.4.5.
ExactReal.prototype.toFixed = function(fractionDigits) {
    var f = (fractionDigits === undefined ? 0 : _parseInt(fractionDigits, 10));
    if (f > SN.maxIntegerDigits)
        throw new RangeError("fractionDigits exceeds " +
                             "SchemeNumber.maxIntegerDigits: " +
                             fractionDigits);

    var x = this;
    var s = "";
    if (isNegative(x)) {
        x = negate(x);
        s = "-";
    }

    var p = exp10(ONE, -f);
    var dm = divAndMod(x, p);
    var n = dm[0];
    if (ge(add(dm[1], dm[1]), p))
        n = add(ONE, n);
    if (isZero(n))
        return s + "0" +
            (fractionDigits > 0 ? "." + zeroes(fractionDigits) : "");
    n = numberToString(n);
    if (f === 0)
        return s + n;

    var z = f - n.length;
    if (f > 0) {
        if (z >= 0)
            n = zeroes(z + 1) + n;
        var point = n.length - f;
        return s + n.substring(0, point) + "." + n.substring(point);
    }
    return s + n + zeroes(-f);
};

ExactReal.prototype.toExponential = function(fractionDigits) {
    var f = (fractionDigits === undefined ? 20 : _parseInt(fractionDigits, 10));
    if (f < 0)
        throw new RangeError("SchemeNumber toExponential: negative " +
                             "argument: " + f);
    if (f > SN.maxIntegerDigits)
        throw new RangeError("fractionDigits exceeds " +
                             "SchemeNumber.maxIntegerDigits: " +
                             fractionDigits);

    var x = this;
    var s = "";
    if (isNegative(x)) {
        x = negate(x);
        s = "-";
    }
    else if (isZero(x))
        return "0" + (fractionDigits > 0 ? "." + zeroes(f) : "") + "e+0";

    var e = natFloor(log(x) / LN10);
    var p = exp10(ONE, e - f);
    var dm = divAndMod(x, p);
    var n = dm[0];
    if (ge(add(dm[1], dm[1]), p))
        n = add(ONE, n);
    n = numberToString(n);

    // Adjust for inaccuracy in log().
    if (n.length != f + 1) {
        //print("Guessed wrong length: " + n.length + " != " + (f + 1));
        e += n.length - (f + 1);
        p = exp10(ONE, e - f);
        dm = divAndMod(x, p);
        n = dm[0];
        if (ge(add(dm[1], dm[1]), p))
            n = add(ONE, n);
        n = numberToString(n);
        if (n.length != f + 1)
            throw new Error("Can not format as exponential: "
                            + numberToString(this));
    }

    if (fractionDigits === undefined)
        n = n.replace(/(\d)0+$/, "$1");
    if (n.length > 1)
        n = n[0] + "." + n.substring(1);
    return s + n + "e" + (e < 0 ? "" : "+") + e;
};

ExactReal.prototype.toPrecision = function(precision) {
    var p, x;
    if (precision === undefined) {
        x = toInexact(this);
        if (isFinite(x))
            return (+x).toString();
        p = 21;
    }
    else {
        p = _parseInt(precision, 10);
        if (p < 1)
            throw new RangeError("SchemeNumber toPrecision: expected a " +
                                 "positive precision, got: " + precision);
        if (p > SN.maxIntegerDigits)
            throw new RangeError("precision exceeds " +
                                 "SchemeNumber.maxIntegerDigits: " +
                                 precision);
    }

    x = this;
    var s = "";
    if (isNegative(x)) {
        x = negate(x);
        s = "-";
    }
    else if (isZero(x))
        return "0" + (p > 1 ? "." + zeroes(p - 1) : "");

    var ret = x.toExponential(p - 1);
    var eIndex = ret.indexOf('e');
    var exponent = _parseInt(ret.substring(eIndex + 1), 10);
    if (exponent >= -6 && exponent < p) {
        if (exponent === 0)
            ret = ret.substring(0, eIndex);
        else {
            ret = ret.substring(0, 1)
                + (ret.indexOf('.') === -1 ? "" : ret.substring(2, eIndex));
            if (exponent < 0)
                ret = "0." + zeroes(-1 - exponent) + ret;
            else if (exponent < p - 1)
                ret = ret.substring(0, exponent + 1) + "." +
                    ret.substring(exponent + 1);
        }
    }
    else if (precision === undefined) {
        ret = ret.substring(0, eIndex).replace(/\.?0+/, "")
            + ret.substring(eIndex);
    }

    return s + ret;
};


//
// ExactRational: Abstract base class of exact rational numbers.
//

isRational.def("ExactRational", retTrue);

numerator.def(  "ExactRational", pureVirtual);
denominator.def("ExactRational", pureVirtual);

// Default implementations:

numberToString.def("ExactRational", function(radix, precision) {
    var n = numerator(this);
    var d = denominator(this);
    if (isUnit(d))
        return numberToString(n, radix, precision);
    return (numberToString(n, radix, precision) +
            "/" + numberToString(d, radix, precision));
});

isInteger.def("ExactRational", function() {
    return isUnit(denominator(this));
});

eq.def("ExactRational", "ExactRational", function(q) {
    return eq(denominator(this), denominator(q)) &&
        eq(numerator(this), numerator(q));
});
compare.def("ExactRational", "ExactRational", function(q) {
    var signDiff = sign(this) - sign(q);
    if (signDiff !== 0)
        return (signDiff > 0 ? 1 : -1);
    var tn = numerator(this);
    var qn = numerator(q);
    var td = denominator(this);
    var qd = denominator(q);
    if (qd === td)  // cheap optimization
        return compare(tn, qn);
    return compare(multiply(tn, qd), multiply(td, qn));
});
isPositive.def("ExactRational", function() {
    return isPositive(numerator(this));
});
isNegative.def("ExactRational", function() {
    return isNegative(numerator(this));
});
isZero.def("ExactRational", function() {
    return isZero(numerator(this));
});

expt.def("ExactRational", "ExactReal", function (x) {
    if (isNegative(this))
        return complexExpt(this, x);
    return divide(expt(numerator(this), x), expt(denominator(this), x));
});
sqrt.def("ExactRational", function() {
    // This EQ may be too big for toValue(), but its square root may not be.
    return divide(sqrt(numerator(this)), sqrt(denominator(this)));
});
log.def("ExactRational", function() {
    return subtract(log(numerator(this)), log(denominator(this)));
});

// Avoid infinite loops in the above functions.
numberToString.def("ExactInteger", pureVirtual);
compare.def(   "ExactInteger", "ExactInteger", pureVirtual);
isPositive.def("ExactInteger", pureVirtual);
isNegative.def("ExactInteger", pureVirtual);
isZero.def(    "ExactInteger", pureVirtual);
expt.def(      "ExactInteger", "ExactReal", complexExpt_method);
expt.def(      "ExactInteger", "ExactInteger", expt_N_EI_method);
sqrt.def(      "ExactInteger", function() { return sqrt(toInexact(this)); });
log.def(       "ExactInteger", function() { return log( toInexact(this)); });
eq.def("ExactInteger", "ExactInteger", function(x) {
    return compare(this, x) === 0;
});

floor.def("ExactRational", function() {
    return div(numerator(this), denominator(this));
});


//
// ExactInteger: Abstract base class of exact integers.
//

isInteger.def("ExactInteger", retTrue);

isEven.def(   "ExactInteger", pureVirtual);
isOdd.def(    "ExactInteger", pureVirtual);
exp10.def(    "ExactInteger", pureVirtual);
gcdNonnegative.def("ExactInteger", "ExactInteger", pureVirtual);

numerator.def(  "ExactInteger", retThis);
denominator.def("ExactInteger", retOne);
floor.def(      "ExactInteger", retThis);
ceiling.def(    "ExactInteger", retThis);
round.def(      "ExactInteger", retThis);
truncate.def(   "ExactInteger", retThis);

// Useful default implementations:

exp10.def("ExactInteger", function(p) {
    return multiply(this, expt_N_EI(nativeToExactInteger(10),
                                    nativeToExactInteger(p)));
});

gcdNonnegative.def("ExactInteger", "ExactInteger", function(a, b) {
    //assert(!isNegative(a));
    //assert(!isNegative(b));
    var c;
    while (!isZero(a)) {
        c = a;
        a = mod(b, a);
        b = c;
    }
    return b;
});

return SN;
}


/*
    Function: implementNativeFlonums(args)
    Returns an object containing <parseInexact> and <toFlonum>
    properties suitable for use with <makeBase>, along with an
    <install> method for <implementSchemeNumbers>.

    The returned functions produce inexact numbers represented as
    native numbers using native operations, where applicable.

    *args.interfaces* should be the result of a call to
    <makeInterfaces> and should be used in any subsequent calls to
    <makeBase>.

    If *args* contains property *isDefaultInexactReal* with a true
    value, <install> creates <pluginApi> operations as follows.

    - The comparison operators (<eq>, <ne>, <gt>, <lt>, <ge>, <le>,
      and <compare>) may convert their arguments to native numbers and
      use native comparison when both are real and at least one is
      inexact.

    - The operators <add>, <subtract>, <multiply>, <divide>,
      <divAndMod>, <div>, <mod>, and <expt> may return an object
      created by this implementation when both arguments are real and
      at least one is inexact.

    - The operators <toInexact>, <atan>, <atan2>, <cos>, <exp>, <sin>,
      <tan>, <acos>, <asin>, <log>, and <sqrt> may return an object
      created by this implementation when passed any real arguments.
*/
function implementNativeFlonums(args) {

args = args || {};
var isDefaultInexactReal = args.isDefaultInexactReal;
var FlonumType           = args.className || "NativeInexactReal";
var Real                 = args.realName || "Real";
var R                    = (isDefaultInexactReal ? Real : FlonumType);
var InexactReal          = args.inexactRealName || "InexactReal";
var ExactReal            = args.exactRealName || "ExactReal";
var base                 = args.baseName || InexactReal;
var InexactRealConstructor = args.interfaces.InexactReal;

//
// NativeInexactReal: Inexact real as a native number.
//

var natFloor  = Math.floor;
var natCeil   = Math.ceil;
var natRound  = Math.round;
var natSqrt   = Math.sqrt;
var natAtan2  = Math.atan2;
var _isFinite = isFinite;
var _isNaN    = isNaN;
var _parseInt = parseInt;
var _parseFloat = parseFloat;

var toFlonum;
var flo = {};
var FLO_FUNCS = [[],
                 ["log", "floor", "ceil", "sqrt", "abs", "atan",
                  "cos", "sin", "tan", "exp"],
                 ["pow", "atan2"]];

function Flonum(x) {
    this._ = x;
}
Flonum.prototype = new InexactRealConstructor();

var INEXACT_ZERO = new Flonum(0);
toFlonum = function(x) {
    //assert(typeof x === "number");
    return (x === 0 ? INEXACT_ZERO : new Flonum(x));
};

FLO_FUNCS[1].forEach(function(name) {
        var math = Math[name];
        flo[name] = function(a) {
            return toFlonum(math(a));
        };
    });
FLO_FUNCS[2].forEach(function(name) {
        var math = Math[name];
        flo[name] = function(a, b) {
            return toFlonum(math(a, b));
        };
    });
["toFixed", "toExponential", "toPrecision"].forEach(function(name) {
        var number = Number.prototype[name];
        Flonum.prototype[name] = function(a) {
            return number.call(this._, a);
        };
    });
Flonum.prototype.valueOf = function() {
    return this._;
};

var floLog   = flo.log;
var floSqrt  = flo.sqrt;
var floAtan2 = flo.atan2;
var floAtan  = flo.atan;
var floCos   = flo.cos;
var floSin   = flo.sin;
var floTan   = flo.tan;
var floExp   = flo.exp;

var floAbs   = flo.abs;
var floFloor = flo.floor;
var floCeil  = flo.ceil;
var floPow   = flo.pow;

function install(SN) {

var pluginApi = SN.pluginApi;

//assert(this === pluginApi.toFlonum);
/*
var toFlonum           = pluginApi.toFlonum;
var parseExactInteger  = pluginApi.parseExactInteger;
var nativeToExactInteger = pluginApi.nativeToExactInteger;
var exactRectangular   = pluginApi.exactRectangular;
*/
var inexactRectangular = pluginApi.inexactRectangular;
/*
var makePolar          = pluginApi.makePolar;

var pureVirtual        = pluginApi.pureVirtual;
var raise              = pluginApi.raise;
*/

var defClass           = pluginApi.defClass;
/*
var defGeneric         = pluginApi.defGeneric;
*/

var numberToString     = pluginApi.numberToString;
var isExact            = pluginApi.isExact;
var isInexact          = pluginApi.isInexact;
var toExact            = pluginApi.toExact;
var toInexact          = pluginApi.toInexact;
/*
var isComplex          = pluginApi.isComplex;
var isReal             = pluginApi.isReal;
*/
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
/*
var realPart           = pluginApi.realPart;
var imagPart           = pluginApi.imagPart;
*/
var exp                = pluginApi.exp;
/*
var magnitude          = pluginApi.magnitude;
var angle              = pluginApi.angle;
*/
var sqrt               = pluginApi.sqrt;
var log                = pluginApi.log;
var asin               = pluginApi.asin;
var acos               = pluginApi.acos;
var atan               = pluginApi.atan;
var sin                = pluginApi.sin;
var cos                = pluginApi.cos;
var tan                = pluginApi.tan;
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
/*
var isUnit             = pluginApi.isUnit;
*/
var isEven             = pluginApi.isEven;
var isOdd              = pluginApi.isOdd;
/*
var exactIntegerSqrt   = pluginApi.exactIntegerSqrt;
var exp10              = pluginApi.exp10;
var gcdNonnegative     = pluginApi.gcdNonnegative;
*/

var complexExpt        = pluginApi.complexExpt;
var complexAcos        = pluginApi.complexAcos;
var complexAsin        = pluginApi.complexAsin;
var complexLog         = pluginApi.complexLog;
var numberToBinary     = pluginApi.numberToBinary;
var nativeDenominatorLog2 = pluginApi.nativeDenominatorLog2;
var nativeDenominator  = pluginApi.nativeDenominator;

defClass(FlonumType, {ctor: Flonum, extends: base});

// We'll need these (and more?) if we support primitive numbers, since
// Number does not inherit from any of our classes.
//isComplex.def(FlonumType, retTrue);
//isReal.def(   FlonumType, retTrue);

debug.def(FlonumType, function() {
    return FlonumType + "(" + numberToString(this) + ")";
});

// Real toInexact via valueOf.
if (isDefaultInexactReal) {
    toInexact.def(ExactReal, function() {
        return toFlonum(+this);
    });
}

numberToString.def(FlonumType, function(radix, precision) {
    if (radix && radix != 10 && _isFinite(this))
        return "#i" + numberToString(toExact(this), radix);

    if (!_isFinite(this)) {
        if (_isNaN(this))
            return("+nan.0");
        return (this > 0 ? "+inf.0" : "-inf.0");
    }

    var s = (+this).toString();

    if (s.indexOf('.') === -1) {
        // Force the result to contain a decimal point as per R6RS.
        var e = s.indexOf('e');
        if (e === -1)
            s += ".";
        else
            s = s.substring(0, e) + "." + s.substring(e);
    }

    if (precision != undefined) {
        if (precision < 53) {
            var bits = numberToBinary(+this).replace(/[-+.]/g, "")
                .replace(/^0+/, "").replace(/0+$/, "").length;
            if (precision < bits)
                precision = bits;
        }
        s += "|" + precision;
    }

    return s;
});

function assertRational(q) {
    if (!isRational(q))
        raise("&assertion", "not a rational number", q);
    return q;
}

denominator.def(FlonumType, function() {
    return floPow(2, nativeDenominatorLog2(+assertRational(this)));
});

numerator.def(FlonumType, function() {
    return toFlonum(this * nativeDenominator(+assertRational(this)));
});

isInteger.def(FlonumType, function() {
    return _isFinite(this) && this == natFloor(this);
});

function Flonum_isFinite() {
    return _isFinite(this);
}
pluginApi.isFinite.def(FlonumType, Flonum_isFinite);
isRational.def(FlonumType, Flonum_isFinite);

isZero.def(FlonumType, function() {
    return this == 0;
});

isPositive.def(FlonumType, function() {
    return this > 0;
});

isNegative.def(FlonumType, function() {
    return this < 0;
});

sign.def(FlonumType, function() {
    return (this == 0 ? 0 : (this > 0 ? 1 : -1));
});

pluginApi.isInfinite.def(FlonumType, function() {
    return !_isFinite(this) && !_isNaN(this);
});

pluginApi.isNaN.def(FlonumType, function() {
    return _isNaN(this);
});

isEven.def(FlonumType, function() {
    //assert(this == natFloor(this));
    return (this & 1) === 0;
});

isOdd.def(FlonumType, function() {
    //assert(this == natFloor(this));
    return (this & 1) === 1;
});

function define_binop(op, func) {
    op.def(FlonumType, FlonumType, func);
    op.def(Real, FlonumType, func);
    op.def(FlonumType, Real, func);
    if (isDefaultInexactReal) {
        op.def(Real, InexactReal, func);
        op.def(InexactReal, Real, func);
    }
}

define_binop(eq, function(x) { return +this == x; });
define_binop(ne, function(x) { return +this != x; });
define_binop(gt, function(x) { return this > x; });
define_binop(lt, function(x) { return this < x; });
define_binop(ge, function(x) { return this >= x; });
define_binop(le, function(x) { return this <= x; });

function Flonum_compare(x) {
    if (+this == x) return 0;
    if (this < x) return -1;
    if (this > x) return 1;
    return NaN;
};

define_binop(compare, Flonum_compare);

define_binop(add,      function(x) { return toFlonum(this + x); });
define_binop(subtract, function(x) { return toFlonum(this - x); });
define_binop(multiply, function(x) { return toFlonum(this * x); });
define_binop(divide,   function(x) { return toFlonum(this / x); });

negate.def(FlonumType, function() {
    return toFlonum(-this);
});

abs.def(FlonumType, function() {
    return (this < 0 ? toFlonum(-this) : this);
});

reciprocal.def(FlonumType, function() {
    return toFlonum(1 / this);
});

function div_native(x, y) {
    if (y > 0)
        return natFloor(x / y);
    if (y < 0)
        return natCeil(x / y);
    if (y == 0)
        divModArg2Zero(toFlonum(y));
    return NaN;
}
function Flonum_divAndMod(y) {
    var x = +this;
    y = +y;
    var div = div_native(x, y);
    return [toFlonum(div), toFlonum(x - (y * div))];
}
function Flonum_div(y) {
    var x = +this;
    y = +y;
    return toFlonum(div_native(x, y));
}
function Flonum_mod(y) {
    var x = +this;
    y = +y;
    return toFlonum(x - y * div_native(x, y));
}

define_binop(divAndMod, Flonum_divAndMod);
define_binop(div, Flonum_div);
define_binop(mod, Flonum_mod);

square.def(FlonumType, function() {
    return toFlonum(this * this);
});

function Flonum_expt(x) {
    // Return this number to the power of x.
    if (isNegative(this))
        return complexExpt(this, x);
    return floPow(this, x);
}

define_binop(expt, Flonum_expt);

round.def(FlonumType, function() {
    var ret = natFloor(this);
    var diff = this - ret;
    if (diff < 0.5) return toFlonum(ret);
    if (diff > 0.5) return toFlonum(ret + 1);
    return toFlonum(2 * natRound(this / 2));
});

truncate.def(FlonumType, function() {
    return this < 0 ? floCeil(this) : floFloor(this);
});

ceiling.def(FlonumType, function() {
    return floCeil(this);
});

floor.def(FlonumType, funcToMeth(floFloor));

// These functions are always allowed to return inexact.  We, however,
// override a few of these in ZERO and ONE.
// sqrt exp log sin cos tan asin acos atan atan2

function funcToMeth(fn) {
    return function() {
        return fn(this);
    };
}
atan.def( R, funcToMeth(floAtan));
cos.def(  R, funcToMeth(floCos));
exp.def(  R, funcToMeth(floExp));
sin.def(  R, funcToMeth(floSin));
tan.def(  R, funcToMeth(floTan));

function cplxFuncToMeth(mathFunc, complexFunc) {
    return function() {
        var ret = mathFunc(this);
        if (_isNaN(ret))
            return complexFunc(this);
        return toFlonum(ret);
    };
}
acos.def(R, cplxFuncToMeth(Math.acos, complexAcos));
asin.def(R, cplxFuncToMeth(Math.asin, complexAsin));

log.def(R, function() {
    var x = +this;
    if (x < 0)
        return complexLog(this);
    return floLog(this);
});

sqrt.def(R, function() {
    var x = +this;
    if (x >= 0)
        return floSqrt(x);
    if (_isNaN(x))
        return toFlonum(x);
    return inexactRectangular(INEXACT_ZERO, floSqrt(-x));
});

atan2.def(R, R, function(x) {
    return floAtan2(this, x);
});
}

function parseInexact(sign, string) {
    return toFlonum(sign * _parseFloat(string));
}

return {
    parseInexact: parseInexact,
    toFlonum:     toFlonum,
    install:      install,
};
}


/*
    Function: implementExactFractions(args)
    Returns an object containing a <divideReduced> property suitable
    for use with <makeBase>, along with an <install> method for
    <implementSchemeNumbers>.

    The returned function produces exact rationals represented as
    pairs of exact integers, numerator and positive denominator in
    lowest terms.

    *args.interfaces* should be the result of a call to
    <makeInterfaces> and should be used in any subsequent calls to
    <makeBase>.

    If *args* contains property *isDefaultRational* with a true
    value, <install> creates <pluginApi> operations as follows.

    - The operators <negate>, <square>, <reciprocal>, <sign>, <add>,
      <subtract>, <multiply>, and <divide> may return an object
      created by this implementation when passed any exact rational
      arguments.

    - The <expt> operator may return an object created by this
      implementation when passed any exact rational base and exact
      integer power.
*/
function implementExactFractions(args) {

var EIF               = args.className || "ExactIntegerFraction";
var base              = args.baseName || "ExactRational";
var EI                = args.exactIntegerName || "ExactInteger";
var isDefaultRational = args.isDefaultRational;
var ER                = (isDefaultRational ? base : EIF);
var ExactRational     = args.interfaces.ExactRational;

var _isNaN   = isNaN;
var natExp   = Math.exp;

//
// EQFraction: Exact rational as numerator (exact integer) and
// denominator (exact positive integer) with no factors in common.
//

// For bootstrapping, these must not depend on SN.
// So we break the multiple dispatch abstraction.
// XXX This would be fine if it were compiler output.

function EQFraction(n, d) {
    //assert(this instanceof arguments.callee);
    //assert(gt(d, ONE));
    //assert(eq(d["SN_ gcdNonnegative"](abs(n)), ONE));
    this._n = n;
    this._d = d;
}
EQFraction.prototype = new ExactRational();

function reduceEQ(n, d) {
    //assert(!d["SN_ isZero"]())

    var g = d["SN_ abs"]()["SN_ gcdNonnegative"](n["SN_ abs"]());

    n = g["SN_ div"](n);  // div(n, g)
    d = g["SN_ div"](d);  // div(d, g)

    if (d["SN_ isNegative"]())
        return canonicalEQ(n["SN_ negate"](), d["SN_ negate"]());
    return canonicalEQ(n, d);
}

function canonicalEQ(n, d) {
    return (d["SN_ isUnit"]() ? n : new EQFraction(n, d));
}

function install(SN) {

var pluginApi = SN.pluginApi;

/*
var toFlonum           = pluginApi.toFlonum;
var parseExactInteger  = pluginApi.parseExactInteger;
*/
var nativeToExactInteger = pluginApi.nativeToExactInteger;
/*
var exactRectangular   = pluginApi.exactRectangular;
var inexactRectangular = pluginApi.inexactRectangular;
var makePolar          = pluginApi.makePolar;

var pureVirtual        = pluginApi.pureVirtual;
var raise              = pluginApi.raise;
*/

var defClass           = pluginApi.defClass;
/*
var defGeneric         = pluginApi.defGeneric;
*/

var numberToString     = pluginApi.numberToString;
/*
var isExact            = pluginApi.isExact;
var isInexact          = pluginApi.isInexact;
var toExact            = pluginApi.toExact;
var toInexact          = pluginApi.toInexact;
var isComplex          = pluginApi.isComplex;
var isReal             = pluginApi.isReal;
var isRational         = pluginApi.isRational;
var isInteger          = pluginApi.isInteger;
*/
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
/*
var realPart           = pluginApi.realPart;
var imagPart           = pluginApi.imagPart;
var exp                = pluginApi.exp;
var magnitude          = pluginApi.magnitude;
var angle              = pluginApi.angle;
*/
var sqrt               = pluginApi.sqrt;
var log                = pluginApi.log;
/*
var asin               = pluginApi.asin;
var acos               = pluginApi.acos;
var atan               = pluginApi.atan;
var sin                = pluginApi.sin;
var cos                = pluginApi.cos;
var tan                = pluginApi.tan;
*/
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
/*
var divAndMod          = pluginApi.divAndMod;
*/
var div                = pluginApi.div;
/*
var mod                = pluginApi.mod;
var atan2              = pluginApi.atan2;
*/
var numerator          = pluginApi.numerator;
var denominator        = pluginApi.denominator;
var isUnit             = pluginApi.isUnit;
/*
var exp10              = pluginApi.exp10;
*/

var raiseDivisionByExactZero = pluginApi.raiseDivisionByExactZero;

var ZERO  = nativeToExactInteger(0);
var ONE   = nativeToExactInteger(1);
var M_ONE = nativeToExactInteger(-1);

defClass(EIF, {ctor: EQFraction, extends: base});

EQFraction.prototype.valueOf = function() {
    var n = this._n;
    var d = this._d;
    var ret = n / d;
    if (!_isNaN(ret))
        return ret;
    if (isNegative(n))
        return -natExp(log(negate(n)) - log(d));
    return natExp(log(n) - log(d));
};

debug.def(EIF, function() {
    return EIF + "(" + debug(this._n) + " / " + debug(this._d) + ")";
});

numerator.def(EIF, function() {
    return this._n;
});

denominator.def(EIF, function() {
    return this._d;
});

negate.def(ER, function() {
    return new EQFraction(negate(numerator(this)), denominator(this));
});

square.def(ER, function() {
    return new EQFraction(square(numerator(this)), square(denominator(this)));
});

reciprocal.def(ER, function() {
    var n = numerator(this);
    switch (sign(n)) {
    case -1: return canonicalEQ(negate(denominator(this)), negate(n));
    case 1: return canonicalEQ(denominator(this), n);
    case 0: default: raiseDivisionByExactZero();
    }
});

sign.def(ER, function() {
    return sign(numerator(this));
});

add.def(ER, ER, function(q) {
    var n1 = numerator(this);
    var d1 = denominator(this);
    var n2 = numerator(q);
    var d2 = denominator(q);
    return reduceEQ(add(multiply(n1, d2), multiply(n2, d1)),
                    multiply(d1, d2));
});
// XXX Should make integer ops pureVirtual again.

subtract.def(ER, ER, function(q) {
    var n1 = numerator(this);
    var d1 = denominator(this);
    var n2 = numerator(q);
    var d2 = denominator(q);
    return reduceEQ(subtract(multiply(n1, d2), multiply(n2, d1)),
                    multiply(d1, d2));
});

multiply.def(ER, ER, function(q) {
    return reduceEQ(multiply(numerator(this), numerator(q)),
                    multiply(denominator(this), denominator(q)));
});

divide.def(ER, ER, function(q) {
    var qn = numerator(q);
    if (isZero(qn))
        raiseDivisionByExactZero();
    return reduceEQ(multiply(numerator(this), denominator(q)),
                    multiply(denominator(this), qn));
});

// Optimize adding integer with fraction, no need to reduce.

add.def(ER, EI, function(n) {
    var den = denominator(this);
    return canonicalEQ(add(numerator(this), multiply(n, den)), den);
});
add.def(EI, ER, function(q) {
    var den = denominator(q);
    return canonicalEQ(add(multiply(this, den), numerator(q)), den);
});
subtract.def(ER, EI, function(n) {
    var den = denominator(this);
    return canonicalEQ(subtract(numerator(this), multiply(n, den)), den);
});
subtract.def(EI, ER, function(q) {
    var den = denominator(q);
    return canonicalEQ(subtract(multiply(this, den), numerator(q)), den);
});

expt.def(ER, EI, function (n) {
    if (isZero(n))
        return ONE;
    // Num and den are in lowest terms.
    return new EQFraction(expt(numerator(this), n), expt(denominator(this), n));
});

if (isDefaultRational) {

    reciprocal.def(EI, function() {
        switch (sign(this)) {
        case -1: return canonicalEQ(M_ONE, negate(this));
        case 1:  return canonicalEQ(ONE, this);
        case 0: default: return raiseDivisionByExactZero();
        }
    });

    divide.def(EI, EI, function(d) {
        return reduceEQ(this, d);
    });
}
}

return {
    install:       install,
    divideReduced: canonicalEQ,
};
}


/*
    Function: implementRectangular(args)
    Returns an object containing <exactRectangular>,
    <inexactRectangular>, <makePolar>, <I>, and <MINUS_I> properties
    suitable for use with <makeBase>, along with an <install> method
    for <implementSchemeNumbers>.

    The returned functions produce complex numbers represented as
    pairs of real numbers equaling the real and imaginary parts.

    *args.interfaces* should be the result of a call to
    <makeInterfaces> and should be used in any subsequent calls to
    <makeBase>.

    *args* must contain *nativeToExactInteger* and *toFlonum*
    *properties of the kind specified by <makeBase>.

    If *args* contains property *isDefaultComplex* with a true value,
    <install> creates <pluginApi> operations as follows.

    - The operator <numberToString> may return a representation in
      rectangular coordinates when passed any complex argument.

    - The operators <magnitude> and <angle> may convert their argument
      to rectangular coordinates before calculating a result for any
      complex argument.

    - The operators <add>, <subtract>, <multiply>, <divide>, <negate>,
      <square>, <reciprocal>, and <exp> may return an object created
      by this implementation when passed any complex arguments.
*/
function implementRectangular(args) {

args = args || {};
var Rect     = args.className || "Rectangular";
var base     = args.baseName || "Complex";
var Real     = args.realName || "Real";
var C        = (args.isDefaultComplex ? base : Rect);
var Complex  = args.interfaces.Complex;

var nativeToExactInteger = args.nativeToExactInteger;
var toFlonum   = args.toFlonum;

//
// Rectangular: Complex numbers as xy-coordinate pairs.
//

// For bootstrapping, these must not depend on SN.
// So we break the multiple dispatch abstraction.
// XXX This would be fine if it were compiler output.

function Rectangular(x, y) {
    //assert(this instanceof arguments.callee);
    //assert(x["SN_ isReal"]());
    //assert(y["SN_ isReal"]());
    //assert(x["SN_ isExact"]() === y["SN_ isExact"]());
    //assert(!x["SN_ isExact"]() || !x["SN_ isZero"]());
    this._x = x;
    this._y = y;
}
Rectangular.prototype = new Complex();

var ZERO = nativeToExactInteger(0);
var INEXACT_ZERO = toFlonum(0);

var I    = new Rectangular(ZERO, nativeToExactInteger(1));
var M_I  = new Rectangular(ZERO, nativeToExactInteger(-1));

/*
    Function: exactRectangular(x, y)
    This function behaves like the standard <make-rectangular> but
    assumes both arguments are exact reals.
 */
function exactRectangular(x, y) {
    //assert(x["SN_ isExact"]());
    //assert(y["SN_ isExact"]());
    if (y["SN_ isZero"]())
        return x;
    if (x["SN_ isZero"]() && y["SN_ isUnit"]()) {
        return y["SN_ isPositive"]() ? I : M_I;
    }
    return new Rectangular(x, y);
}

/*
    Function: inexactRectangular(x, y)
    This function behaves like the standard <make-rectangular> but
    assumes both arguments are inexact reals.
 */
function inexactRectangular(x, y) {
    //assert(!x["SN_ isExact"]());
    //assert(!y["SN_ isExact"]());
    return new Rectangular(x, y);
}

/*
    Function: makePolar(r, theta)
    This function behaves like the standard <make-polar> but assumes
    both its arguments are real.
*/
function makePolar(r, theta) {
    return inexactRectangular(
        theta["SN_ cos"]()["SN_ multiply"](r),
        theta["SN_ sin"]()["SN_ multiply"](r));
}

function install(SN) {

var pluginApi = SN.pluginApi;

//assert(pluginApi.exactRectangular === exactRectangular);

var toFlonum           = pluginApi.toFlonum;
/*
var parseExactInteger  = pluginApi.parseExactInteger;
var nativeToExactInteger = pluginApi.nativeToExactInteger;
var exactRectangular   = pluginApi.exactRectangular;
var inexactRectangular = pluginApi.inexactRectangular;
var makePolar          = pluginApi.makePolar;

*/
var pureVirtual        = pluginApi.pureVirtual;
/*
var raise              = pluginApi.raise;
*/

var defClass           = pluginApi.defClass;
/*
var defGeneric         = pluginApi.defGeneric;
*/

var numberToString     = pluginApi.numberToString;
var isExact            = pluginApi.isExact;
var isInexact          = pluginApi.isInexact;
var toExact            = pluginApi.toExact;
var toInexact          = pluginApi.toInexact;
/*
var isComplex          = pluginApi.isComplex;
*/
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
/*
var log                = pluginApi.log;
var asin               = pluginApi.asin;
var acos               = pluginApi.acos;
var atan               = pluginApi.atan;
var sin                = pluginApi.sin;
var cos                = pluginApi.cos;
var tan                = pluginApi.tan;
*/
var abs                = pluginApi.abs;
/*
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
*/
var atan2              = pluginApi.atan2;
/*
var numerator          = pluginApi.numerator;
var denominator        = pluginApi.denominator;
var isUnit             = pluginApi.isUnit;
var exp10              = pluginApi.exp10;
*/

defClass(Rect, {ctor: Rectangular, extends: base});

function retFalse()   { return false; }

realPart.def(Rect, function() { return this._x; });
imagPart.def(Rect, function() { return this._y; });

isExact  .def(Rect, function() { return isExact(this._x); });
isInexact.def(Rect, function() { return isInexact(this._x); });

toInexact.def(Rect, function() {
    if (isInexact(this._x))
        return this;
    return inexactRectangular(toInexact(this._x), toInexact(this._y));
});

toExact.def(Rect, function() {
    if (isExact(this._x))
        return this;
    return exactRectangular(toExact(this._x), toExact(this._y));
});

isReal.def(    Rect, retFalse);
isRational.def(Rect, retFalse);
isInteger.def( Rect, retFalse);

isZero.def(Rect, function() {
    return isZero(this._x) && isZero(this._y);
});

function toRectangular(x, y) {
    //assert(isReal(x));
    //assert(isReal(y));
    //assert(isExact(x) === isExact(y));
    if (isExact(x))
        return exactRectangular(x, y);
    return new Rectangular(x, y);
}

function xyToString(xString, yString) {
    if (yString[0] === '-' || yString[0] === '+')
        return xString + yString + "i";
    return xString + "+" + yString + "i";
}

numberToString.def(C, function(radix, precision) {
    return xyToString(numberToString(realPart(this), radix, precision),
                      numberToString(imagPart(this), radix, precision));
});

Rectangular.prototype.toString = function(radix) {
    radix = radix || 10;
    return xyToString(this._x.toString(radix), this._y.toString(radix));
};

debug.def(Rect, function() {
    return "Rectangular(" + debug(this._x) + ", " + debug(this._y) + ")";
});

Rectangular.prototype.toFixed = function(dig) {
    return xyToString(this._x.toFixed(dig), this._y.toFixed(dig));
};
Rectangular.prototype.toExponential = function(dig) {
    return xyToString(this._x.toExponential(dig), this._y.toExponential(dig));
};
Rectangular.prototype.toPrecision = function(prec) {
    return xyToString(this._x.toPrecision(prec), this._y.toPrecision(prec));
};

magnitude.def(C, function() {
    var x = realPart(this), y = imagPart(this);
    if (isZero(x))
        return abs(y);
    if (isZero(y))
        return abs(x);
    return sqrt(add(square(x), square(y)));
});

angle.def(C, function() {
    return atan2(imagPart(this), realPart(this));
});

eq.def(Rect, Rect, function(z) {
    return eq(this._x, z._x) && eq(this._y, z._y);
});
eq.def(Rect, Real, function(x) {
    return isZero(this._y) && eq(x, this._x);
});
eq.def(Real, Rect, function(z) {
    return isZero(z._y) && eq(z._x, this);
});

ne.def(Rect, Rect, function(z) {
    return ne(this._x, z._x) || ne(this._y, z._y);
});
ne.def(Rect, Real, function(x) {
    return !isZero(this._y) || ne(x, this._x);
});
ne.def(Real, Rect, function(z) {
    return !isZero(z._y) || ne(z._x, this);
});

function makeRectangular(x, y) {
    if (isInexact(x))
        return inexactRectangular(x, toInexact(y));
    if (isInexact(y))
        return inexactRectangular(toInexact(x), y);
    return exactRectangular(x, y);
}

add.def(Real, C, function(z) {
    return makeRectangular(add(this, realPart(z)), imagPart(z));
});
add.def(C, Real, function(x) {
    return makeRectangular(add(realPart(this), x), imagPart(this));
});
add.def(C, C, function(z) {
    return makeRectangular(add(realPart(this), realPart(z)),
                           add(imagPart(this), imagPart(z)));
});

subtract.def(Real, C, function(z) {
    return makeRectangular(subtract(this, realPart(z)),
                           negate(imagPart(z)));
});
subtract.def(C, Real, function(x) {
    return makeRectangular(subtract(realPart(this), x), imagPart(this));
});
subtract.def(C, C, function(z) {
    return makeRectangular(subtract(realPart(this), realPart(z)),
                           subtract(imagPart(this), imagPart(z)));
});

negate.def(C, function() {
    return makeRectangular(negate(realPart(this)), negate(imagPart(this)));
});

function complexMultiply(ax, ay, bx, by) {
    return makeRectangular(subtract(multiply(ax, bx), multiply(ay, by)),
                           add(     multiply(ax, by), multiply(ay, bx)));
}

multiply.def(Real, C, function(z) {
    return makeRectangular(multiply(realPart(z), this),
                           multiply(imagPart(z), this));
});
multiply.def(C, Real, function(x) {
    return makeRectangular(multiply(realPart(this), x),
                           multiply(imagPart(this), x));
});
multiply.def(C, C, function(z) {
    return complexMultiply(realPart(this), imagPart(this), realPart(z),
                           imagPart(z));
});

divide.def(C, Real, function(x) {
    return makeRectangular(divide(realPart(this), x),
                           divide(imagPart(this), x));
});

square.def(C, function() {
    var x = realPart(this), y = imagPart(this);
    var xy = multiply(x, y);
    return makeRectangular(subtract(square(x), square(y)), add(xy, xy));
});

reciprocal.def(C, function() {
    var x = realPart(this), y = imagPart(this);
    var m2 = add(square(x), square(y));
    return makeRectangular(divide(x, m2), negate(divide(y, m2)));
});

function complexDivide(x, y, z) {  // returns (x + iy) / z
    var zx = realPart(z), zy = imagPart(z);
    var m2 = add(square(zx), square(zy));
    return complexMultiply(x, y, divide(zx, m2), negate(divide(zy, m2)));
}

divide.def(Real, C, function(z) {
    return complexDivide(this, isExact(this) ? ZERO : INEXACT_ZERO, z);
});
divide.def(C, C, function(z) {
    return complexDivide(realPart(this), imagPart(this), z);
});

exp.def(C, function() {
    return makePolar(exp(realPart(this)), imagPart(this));
});

}

return {
    exactRectangular   : exactRectangular,
    inexactRectangular : inexactRectangular,
    makePolar          : makePolar,
    I                  : I,
    MINUS_I            : M_I,
    install            : install,
};
}


/*
    Function: implementHybridBigIntegers(args)
    Returns an object containing <parseExactInteger> and
    <nativeToExactInteger> properties suitable for use with
    <makeBase>, along with an <install> method for
    <implementSchemeNumbers>.

    The returned functions produce exact integers represented as
    native numbers in the range with absolute value less than 2^53.
    Outside this range, the implementation uses
    *args.BigIntegerConstructor* to create and operate on numbers.
    *BigIntegerConstructor* must behave like <BigInteger at
    https://github.com/silentmatt/javascript-biginteger>.

    *args.interfaces* should be the result of a call to
    <makeInterfaces> and should be used in any subsequent calls to
    <makeBase>.

    If *args* contains property *isDefaultInteger* with a true
    value, <install> creates <pluginApi> operations as follows.

    - The operator <toExact> may return an object created by this
      implementation when passed any inexact real argument.

    - The operators <compare>, <add>, <subtract>, <multiply>,
      <divAndMod>, <div>, <mod>, and <gcdNonnegative> may return an
      object created by this implementation when passed any two exact
      integer arguments.
*/
function implementHybridBigIntegers(args) {

var BigIntegerConstructor = args.BigIntegerConstructor;
var BigType               = args.BigIntegerName || "BigInteger";
var NativeType            = args.NativeName || "Proto" + BigType;
var HybridType            = args.HybridName || "Hybrid" + BigType;
var base                  = args.baseName || "ExactInteger";
var Real                  = args.realName || "Real";
var Complex               = args.complexName || "Complex";
var InexactReal           = args.inexactRealName || "InexactReal";
var EI                    = args.integerName || "ExactInteger";
var isDefaultInteger      = args.isDefaultInteger;
var MaybeEI               = (isDefaultInteger ? EI : HybridType);
var EIctor                = args.interfaces.ExactInteger;

var _parseInt = parseInt;
var _isFinite = isFinite;
var natAbs    = Math.abs;
var natFloor  = Math.floor;
var natCeil   = Math.ceil;
var natSqrt   = Math.sqrt;
var natPow    = Math.pow;
var natExp    = Math.exp;
var LN10      = Math.LN10;

function Hybrid(){}
Hybrid.prototype = new EIctor();

//
// EINative: Exact integers as native numbers.
//

function EINative(x) {
    //assert(this instanceof arguments.callee);
    //assert(x === natFloor(x));
    this._ = x;
}
EINative.prototype = new Hybrid();

function Zero(){}     
function One(){}
function MinusOne(){}

Zero.prototype     = new EINative(0);
One.prototype      = new EINative(1);
MinusOne.prototype = new EINative(-1);

var ZERO  = new Zero();
var ONE   = new One();
var TWO   = new EINative(2);
var M_ONE = new MinusOne();

var EINativeSmall = [ ZERO, ONE, TWO ];

function toEINative(n) {
    //assert(natFloor(n) === n);
    return EINativeSmall[n] || (n == -1 ? M_ONE : new EINative(n));
}

/*
    Function: parseExactInteger(sign, string, [radix])
    Returns *sign* times the result of parsing *string* as an exact
    integer.

    *radix* defaults to 10 and must be a valid radix. *string* must
    represent a positive integer in the given radix. *sign* must be -1
    or 1.
*/

function parseExactInteger(sign, string, radix) {
    var n = _parseInt(string, radix || 10);

    if (n < 9007199254740992)
        return toEINative(sign * n);

    n = BigIntegerConstructor.parse(string, radix);
    if (sign < 0)
        n = n.negate();
    return n;
}

/*
    Function: nativeToExactInteger(n)
    Returns an exact integer whose value is the native number *n*.
*/
function nativeToExactInteger(n) {
    //assert(n === natFloor(n));
    if (n < 9007199254740992 && n > -9007199254740992)
        return toEINative(n);
    return BigIntegerConstructor.parse(n.toString(16), 16);
}

function install(SN) {

var pluginApi = SN.pluginApi;

var toFlonum           = pluginApi.toFlonum;
/*
var parseExactInteger  = pluginApi.parseExactInteger;
var nativeToExactInteger = pluginApi.nativeToExactInteger;
*/
var divideReduced      = pluginApi.divideReduced;
/*
var exactRectangular   = pluginApi.exactRectangular;
*/
var I                  = pluginApi.I;
var inexactRectangular = pluginApi.inexactRectangular;
/*
var makePolar          = pluginApi.makePolar;

var pureVirtual        = pluginApi.pureVirtual;
*/
var raise              = pluginApi.raise;

var defClass           = pluginApi.defClass;
var defGeneric         = pluginApi.defGeneric;

var numberToString     = pluginApi.numberToString;
var isExact            = pluginApi.isExact;
var isInexact          = pluginApi.isInexact;
var toExact            = pluginApi.toExact;
var toInexact          = pluginApi.toInexact;
/*
var isComplex          = pluginApi.isComplex;
var isReal             = pluginApi.isReal;
var isRational         = pluginApi.isRational;
var isInteger          = pluginApi.isInteger;
*/
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
/*
var atan2              = pluginApi.atan2;
var numerator          = pluginApi.numerator;
var denominator        = pluginApi.denominator;
*/
var isUnit             = pluginApi.isUnit;
var isEven             = pluginApi.isEven;
var isOdd              = pluginApi.isOdd;
var exactIntegerSqrt   = pluginApi.exactIntegerSqrt;
var exp10              = pluginApi.exp10;
var gcdNonnegative     = pluginApi.gcdNonnegative;

var complexExpt_method = pluginApi.complexExpt_method;
var raiseDivisionByExactZero = pluginApi.raiseDivisionByExactZero;
var nativeDenominatorLog2 = pluginApi.nativeDenominatorLog2;
var nativeDenominator  = pluginApi.nativeDenominator;

defClass(HybridType, {ctor: Hybrid,   extends: base});
defClass(NativeType, {ctor: EINative, extends: HybridType});
defClass(   BigType, {ctor: BigIntegerConstructor,
                      extends: HybridType});

var     ZeroType = NativeType + "Zero";
var      OneType = NativeType + "One";
var MinusOneType = NativeType + "MinusOne";

defClass(ZeroType,     {ctor: Zero,     extends: NativeType})
defClass(OneType,      {ctor: One,      extends: NativeType})
defClass(MinusOneType, {ctor: MinusOne, extends: NativeType})

var INEXACT_ZERO = toFlonum(0);
var PI           = toFlonum(Math.PI);

function retFalse()   { return false; }
function retTrue()    { return true;  }
function retThis()    { return this; }
function retZero()    { return ZERO; }
function retOne()     { return ONE; }
function retFirst(a)  { return a; }

debug.def(ZeroType,     function() { return "Zero"; });
debug.def(OneType,      function() { return "One"; });
debug.def(MinusOneType, function() { return "MinusOne"; });

isZero.def(    ZeroType, retTrue);
isPositive.def(ZeroType, retFalse);
isNegative.def(ZeroType, retFalse);

compare.def(ZeroType, Real, function(x) {
    return -sign(x);
});
compare.def(Real, ZeroType, function(x) {
    return sign(this);
});

add.def(       ZeroType, Complex, retFirst);
add.def(       Complex, ZeroType, retThis);
subtract.def(  ZeroType, Complex, negate);
subtract.def(  Complex, ZeroType, retThis);
negate.def(    ZeroType, retThis);
abs.def(       ZeroType, retThis);
multiply.def(  ZeroType, Complex, retThis);
multiply.def(  Complex, ZeroType, retFirst);
square.def(    ZeroType, retThis);
reciprocal.def(ZeroType, raiseDivisionByExactZero);
divide.def(    Complex, ZeroType, raiseDivisionByExactZero);

divide.def(ZeroType, Complex, function(z) {
    if (isZero(z) && isExact(z))
        raiseDivisionByExactZero();
    return this;
});

expt.def(Complex, ZeroType, retOne);

// Little opportunity for optimization in 0 to power.  This is the same
// definition as expt(Complex,Complex).
expt.def(ZeroType, Complex, complexExpt_method);

sqrt.def(ZeroType, retThis);
exp.def( ZeroType, retOne);
sin.def( ZeroType, retThis);
cos.def( ZeroType, retOne);
tan.def( ZeroType, retThis);
asin.def(ZeroType, retThis);
atan.def(ZeroType, retThis);

isUnit.def(    OneType, retTrue);
abs.def(       OneType, retThis);
multiply.def(  OneType, Complex, retFirst);
multiply.def(  Complex, OneType, retThis);
reciprocal.def(OneType, retThis);
divide.def(    OneType, Complex, reciprocal);
divide.def(    Complex, OneType, retThis);
square.def(    OneType, retThis);
expt.def(      OneType, Complex, retThis);
expt.def(      Complex, OneType, retThis);
sqrt.def(      OneType, retThis);
log.def(       OneType, retZero);
acos.def(      OneType, retZero);

isUnit.def(     MinusOneType, retTrue);
abs.def(        MinusOneType, retOne);
multiply.def(   MinusOneType, Complex, negate);
multiply.def(   Complex, MinusOneType, function(x) { return negate(this); });
reciprocal.def( MinusOneType, retThis);
square.def(     MinusOneType, retOne);
sqrt.def(       MinusOneType, function() { return I; });
expt.def(      Complex, MinusOneType, function(x) { return reciprocal(this); });

expt.def(MinusOneType, EI, function(n) {
    return (isEven(n) ? ONE : M_ONE);
});

EINative.prototype.valueOf = function() {
    return this._;
};

numberToString.def(NativeType, function(radix, precision) {
    return this._.toString(radix || 10);
});

debug.def(NativeType, function() {
    return "EINative(" + this._ + ")";
});

isZero.def(NativeType, retFalse);  // The zero class overrides.

isPositive.def(NativeType, function() {
    return this._ > 0;
});

isNegative.def(NativeType, function() {
    return this._ < 0;
});

sign.def(NativeType, function() {
    return (this._ > 0 ? 1 : (this._ == 0 ? 0 : -1));
});

isEven.def(NativeType, function() {
    return (this._ & 1) === 0;
});

isOdd.def(NativeType, function() {
    return (this._ & 1) === 1;
});

eq.def(NativeType, NativeType, function(n) {
    return this._ === n._;
});
ne.def(NativeType, NativeType, function(n) {
    return this._ !== n._;
});
compare.def(NativeType, NativeType, function(n) {
    return (this._ === n._ ? 0 : (this._ > n._ ? 1 : -1));
});

function add_Natives(a, b) {
    var ret = a + b;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return BigIntegerConstructor.add(a, b);
}

add.def(NativeType, NativeType, function(n) {
    return add_Natives(this._, n._);
});

negate.def(NativeType, function() {
    return toEINative(-this._);
});

abs.def(NativeType, function() {
    return (this._ < 0 ? toEINative(-this._) : this);
});

subtract.def(NativeType, NativeType, function(n) {
    return add_Natives(this._, -n._);
});

function divAndMod_EINative(t, x, which) {
    if (x === 0)
        raiseDivisionByExactZero();

    var div = (x > 0 ? natFloor(t / x) : natCeil(t / x));
    if (which === 0)
        return toEINative(div);

    var tmp = x * div;
    var mod;

    if (tmp > -9007199254740992)
        mod = t - tmp;
    else if (div > 0)
        mod = (t - x) - (x * (div - 1));
    else
        mod = (t + x) - (x * (div + 1));

    mod = toEINative(mod);
    if (which === 1)
        return mod;

    return [toEINative(div), mod];
};

div.def(NativeType, NativeType, function(n) {
    return divAndMod_EINative(this._, n._, 0);
});
mod.def(NativeType, NativeType, function(n) {
    return divAndMod_EINative(this._, n._, 1);
});
divAndMod.def(NativeType, NativeType, function(n) {
    return divAndMod_EINative(this._, n._, 2);
});

exactIntegerSqrt.def(NativeType, function() {
    if (isNegative(this))
        raise("&assertion", "negative number", this);
    var n = natFloor(natSqrt(this._));
    return [toEINative(n), toEINative(this._ - n * n)];
});

var toBigInteger = defGeneric("BigInteger_import", 1);

toBigInteger.def(BigType, retThis);
toBigInteger.def(NativeType, function() {
    return BigIntegerConstructor(this._);
});
toBigInteger.def(EI, function() {
    return BigIntegerConstructor.parse(numberToString(this));
});

expt.def(HybridType, HybridType, function(p) {
    // Return this integer to the power of p.

    var s = sign(p);

    // If p != p.valueOf() due to inexactness, our result would
    // exhaust memory, since |n| is at least 2.  (expt is specialized
    // for -1, 0, and 1.)
    //assert(ge(abs(this), 2));
    p = natAbs(p);

    var result = natPow(this, p);
    var a;
    if (result > -9007199254740992 && result < 9007199254740992) {
        a = toEINative(result);
    }
    else {
        var newLog = log(this) * p;
        if (newLog > SN.maxIntegerDigits * LN10)
            raise("&implementation-restriction",
                  "exact integer would exceed limit of " +
                  (+SN.maxIntegerDigits) +
                  " digits; adjust SchemeNumber.maxIntegerDigits",
                  newLog / LN10);

        a = toBigInteger(this).pow(p);
    }
    return (s > 0 ? a : reciprocal(a));
});

multiply.def(NativeType, NativeType, function(n) {
    var ret = this._ * n._;
    if (ret > -9007199254740992 && ret < 9007199254740992)
        return toEINative(ret);
    return BigIntegerConstructor(this._).multiply(n._);
});

square.def(NativeType, function() {
    var ret = this._ * this._;
    if (ret < 9007199254740992)
        return toEINative(ret);
    return BigIntegerConstructor(this._).square();
});

// 2 to the power 53, top of the range of consecutive integers
// representable exactly as native numbers.
var FIRST_BIG_INTEGER = BigIntegerConstructor(9007199254740992);

function reduceBigInteger(n) {
    if (n.compareAbs(FIRST_BIG_INTEGER) >= 0)
        return n;
    return toEINative(n.toJSValue());
}

if (isDefaultInteger) {
    toExact.def(InexactReal, function() {
        var x = +this;

        if (!_isFinite(x))
            raise("&implementation-violation",
                  "inexact argument has no reasonably close exact equivalent",
                  x);

        var d = nativeDenominator(x);
        var n;

        if (d === 1)
            return nativeToExactInteger(x);

        if (_isFinite(d)) {
            n = x * d;
            d = nativeToExactInteger(d);
        }
        else {
            // Denormal x.
            var dl2 = nativeDenominatorLog2(x);
            n = x * 9007199254740992;
            n *= natPow(2, dl2 - 53);
            d = expt(TWO, toEINative(dl2));
        }
        //assert(_isFinite(n));
        return divideReduced(nativeToExactInteger(n), d);
    });
}

numberToString.def(BigType, function(radix) {
    return this.toString(radix);
});

isZero.def(    BigType, function() { return this.isZero(); });
isEven.def(    BigType, function() { return this.isEven(); });
isOdd.def(     BigType, function() { return this.isOdd(); });
sign.def(      BigType, function() { return this.sign(); });
isUnit.def(    BigType, function() { return this.isUnit(); });
isPositive.def(BigType, function() { return this.isPositive(); });
isNegative.def(BigType, function() { return this.isNegative(); });
negate.def(    BigType, function() { return this.negate(); });
abs.def(       BigType, function() { return this.abs(); });
square.def(    BigType, function() { return this.square(); });

compare.def(MaybeEI, MaybeEI, function(n) {
    return toBigInteger(this).compare(toBigInteger(n));
});

add.def(MaybeEI, MaybeEI, function(n) {
    return reduceBigInteger(toBigInteger(this).add(toBigInteger(n)));
});
subtract.def(MaybeEI, MaybeEI, function(n) {
    return reduceBigInteger(toBigInteger(this).subtract(toBigInteger(n)));
});
multiply.def(MaybeEI, MaybeEI, function(n) {
    return reduceBigInteger(toBigInteger(this).multiply(toBigInteger(n)));
});
divAndMod.def(MaybeEI, MaybeEI, function(d) {
    d = toBigInteger(d);
    var dm = toBigInteger(this).divRem(d);
    var div = dm[0];
    var mod = dm[1];

    if (mod.isNegative()) {
        mod = mod.add(d);
        div = div.prev();
    }
    return [reduceBigInteger(div), reduceBigInteger(mod)];
});
div.def(MaybeEI, MaybeEI, function(d) {
    return divAndMod(this, d)[0];
});
mod.def(MaybeEI, MaybeEI, function(d) {
    return divAndMod(this, d)[1];
});

log.def(BigType, function() {
    var x = toFlonum(this.abs().log());
    return this.isPositive() ? x : inexactRectangular(x, PI);
});

debug.def(BigType, function() {
    return BigType + "(" + this.toString() + ")";
});

exp10.def(NativeType, function(e) {
    if (this._ === 0 || e === 0)
        return this;

    if (e < 0) {
        var num = String(this._);
        var i = num.length - 1;

        if (num[i] === '0') {
            while (num[i] === '0' && e < 0) {
                e += 1;
                i -= 1;
            }
            num = toEINative(Number(num.substring(0, i + 1)));
            if (e === 0)
                return num;
        }
        else {
            num = this;
        }

        var den;
        if (e < -15)
            den = BigIntegerConstructor.ONE.exp10(-e);
        else
            // Could make this an array lookup.
            den = toEINative(Number("1000000000000000".substring(0, 1 - e)));
        return divide(num, den);
    }
    if (e < 16) {
        // Could make substring+parseInt an array lookup.
        var result = _parseInt("1000000000000000".substring(0, e + 1)) * this._;
        if (result > -9007199254740992 && result < 9007199254740992)
            return toEINative(result);
    }
    return BigIntegerConstructor(this._).exp10(e);
});

exp10.def(BigType, function(e) {
    //assert(e === natFloor(e));
    if (e === 0)
        return this;
    if (e > 0)
        return this.exp10(e);
    return divide(this, exp10(ONE, -e));
});

sqrt.def(BigType, function() {
    //assert(!isZero(this));
    var mag = toFlonum(natExp(this.abs().log() / 2));
    return (this.isNegative() ? inexactRectangular(INEXACT_ZERO, mag) : mag);
});

exactIntegerSqrt.def(BigType, function() {

    // I know of no use cases for this.  Be stupid.  Be correct.

    //assert(this.compareAbs(FIRST_BIG_INTEGER) >= 0);

    function doit(n, a) {
        while (true) {
            var dm = n.divRem(a);
            var b = dm[0];
            var diff = a.subtract(b); // n == b*b + b*diff + dm[1], dm[1] < b+1

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
    var l = this.log() / 2 / LN10;
    var a = BigInteger(natPow(10, l - natFloor(l)).toString()
                       + "e" + natFloor(l));
    return doit(this, a).map(reduceBigInteger);
});

function gcdNative(a, b) {
    //assert(a >= 0 && b >= 0)
    var c;
    while (a !== 0) {
        c = a;
        a = b % a;
        b = c;
    }
    return toEINative(b);
}

// a and b must be nonnegative, exact integers.
gcdNonnegative.def(NativeType, NativeType, function(n) {
    //assert(!isNegative(this));
    //assert(!isNegative(n));
    return gcdNative(this._, n._);
});

gcdNonnegative.def(MaybeEI, MaybeEI, function(n) {
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
});
}
return {
    install: install,
    parseExactInteger:    parseExactInteger,
    nativeToExactInteger: nativeToExactInteger,
};
}


/*
    Function: implementSchemeNumbers(interfaces, implementations)
    Creates and returns an object like <SchemeNumber> but using the
    supplied number implementations.

    *interfaces* should be an object returned by <makeInterfaces>.

    *implementations* should be an array of objects containing the
    properties needed by <makeBase>.  For each required or optional
    property, *implementations* is scanned in index order, and the
    first element that contains the property provides it to
    <makeBase>.

    After creating the SchemeNumber object, this function passes it to
    each implementation's *install* method as if by

    > implementation.install(SchemeNumber);

    The implementation might install methods using the plugin API
    (SchemeNumber.pluginApi).

    See Also: <implementNativeFlonums>, <implementHybridBigIntegers>,
    <implementExactFractions>, <implementRectangular>, <makeBase>,
    <pluginApi>

*/
function implementSchemeNumbers(interfaces, implementations) {
    var args = {};

    // Flatten the implementation array into the args object.
    implementations.forEach(function(impl) {
        if (impl) {
            for (a in impl) {
                if (impl.hasOwnProperty(a))
                    args[a] = impl[a];
            }
        }
    });

    var sn = makeTower(makeBase(interfaces, args));

    // Run each implementation's install procedure, if it has one.
    function install(impl) {
        if (impl && impl.install)
            impl.install(sn);
    }
    implementations.forEach(install);

    return sn;
}

// Grab the BigInteger library.
var BigInteger;
if (typeof require !== "undefined")
    BigInteger = require("biginteger").BigInteger;
else
    BigInteger = this.BigInteger;

if (!BigInteger) {
    if (typeof load !== "undefined")
        load("biginteger.js");
    else if (this.readFile)
        eval(this.readFile("biginteger.js"));
    else
        throw new Error("BigInteger is not defined.");
}

return (function() {

    // Build the SchemeNumber object piece by piece.

    var interfaces = makeInterfaces();

    var Flonums = implementNativeFlonums({
        interfaces:            interfaces,
        isDefaultInexactReal:  true,
    });

    var Integers = implementHybridBigIntegers({
        interfaces: interfaces,
        BigIntegerConstructor: BigInteger,
        isDefaultInteger:      true,
    });

    var Rationals = implementExactFractions({
        interfaces:            interfaces,
        isDefaultRational:     true,
    });

    var Complexes = implementRectangular({
        interfaces:            interfaces,
        isDefaultComplex:      true,
        nativeToExactInteger:  Integers.nativeToExactInteger,
        toFlonum:              Flonums.toFlonum,
    });

    var impls = [Integers, Rationals, Flonums, Complexes];

    //load("lib/decimal.js"); var Decimals = implementExactDecimals({interfaces:interfaces,nativeToExactInteger:Integers.nativeToExactInteger,isDefaultDecimal:true}); impls.unshift(Decimals);

    var sn = implementSchemeNumbers(interfaces, impls);

    sn.implementSchemeNumbers = implementSchemeNumbers;

    return sn;
})();
})();

if (typeof exports !== "undefined") {
    exports.SchemeNumber = SchemeNumber;
    for (var name in SchemeNumber.fn)
        exports[name] = SchemeNumber.fn[name];
}

// load for testing:
// load("biginteger.js");load("schemeNumber.js");sn=SchemeNumber;fn=sn.fn;ns=fn["number->string"];debug=sn.pluginApi.debug;1
