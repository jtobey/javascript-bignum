Scheme arithmetic library for JavaScript,  
https://github.com/jtobey/javascript-bignum.  
Copyright (c) 2010, 2011, 2012 John Tobey <jtobey@john-edwin-tobey.org>  
Copyright (c) 2009 Matthew Crumley <email@matthewcrumley.com>  
Licensed under the MIT license, file LICENSE.  
Big integer implementation based on javascript-biginteger,  
https://github.com/silentmatt/javascript-biginteger.


#What is it?

The Scheme language supports "exact" arithmetic and mixing exact with
inexact numbers.  Several basic operations, including add, subtract,
multiply, and divide, when given only exact arguments, must return an
exact, numerically correct result.  They are allowed to fail due to
running out of memory, but they are not allowed to return
approximations the way ECMAScript operators may.

For example, adding exact 1/100 to exact 0 one hundred times produces
exactly 1, not 1.0000000000000007 as in JavaScript.  Raising 2 to the
1024th power returns a 308-digit integer with complete precision, not
Infinity as in ECMAScript.

This implementation provides all functions listed in the [R6RS][1]
(I recommend the [PDF][2]) Scheme specification, Section 11.7, along 
with `eqv?` from Section 11.5. (`eqv?` uses JavaScript's `===` to
compare non-numbers.)

Exact numbers support the standard ECMA Number formatting methods
(`toFixed`, `toExponential`, and `toPrecision`) without a fixed upper
limit to precision.


#Implementation Details

This release contains a plugin API designed to support alternative
implementations of four broad types: exact integer, exact rational,
inexact real, and complex.  The plugin API is under heavy development
and neither complete nor documented.  A multiple dispatch system
supports specialization of basic operations by any operands' types.

Exact integers of absolute value less than 2 to the 53rd power
(9,007,199,254,740,992 or about 9e15) are represented as native
numbers.  Outside this range, exact integers are represented as
BigInteger objects: arrays base 10000000 with sign flag.

Exact rationals are represented as pairs of exact integers (numerator,
denominator) in lowest terms.

Non-real complex numbers are represented in rectangular coordinates,
either both exact or both inexact.

Inexact real numbers are represented as native numbers, wrapped to
provide a method space without affecting the standard Number.prototype
object.

Number objects may contain properties and methods other than the
standard toString, toFixed, etc.  Such properties have names beginning
with `_` or `SN_`.  They are private to the library, and applications
should not use them.  The Scheme functions are *not* methods of number
objects.


#Similar Projects

* Danny Yoo's Whalesong (http://hashcollision.org/whalesong/), a
  Racket (Scheme) to JavaScript compiler with its own Scheme numeric
  tower called js-numbers (https://github.com/dyoo/js-numbers).

* Leemon Baird's big integer library (http://www.leemon.com/crypto/BigInt.js).

* HOP (http://hop.inria.fr/), a framework containing a Scheme-to-JS
  compiler that did NOT implement the numeric tower as of 2011.

* node-gmp (https://github.com/postwait/node-gmp), node.js bindings
  for the GNU Multiple Precision Arithmetic Library.

* bignumber.js (https://github.com/MikeMcl/bignumber.js)

* strint (https://github.com/rauschma/strint), a JavaScript library for
  string-encoded integers.

* Any others out there???


#Installation

Copy biginteger.js and schemeNumber.js from this directory to your Web
or JavaScript directory.  Load biginteger.js first, then
schemeNumber.js.


#Usage

See documentation in schemeNumber.js, or view it on the Web at
http://john-edwin-tobey.org/Scheme/javascript-bignum/docs/files/schemeNumber-js.html,
or try to extract it to HTML using [NaturalDocs][2] and the build-docs
script in this directory.


#Changes

1.3.0 (unstable) - 2012-03-07

    * Unstable development branch containing new plugin API.

1.2.0 - 2012-03-04 - Current stable release based on 1.1.x.

1.1.5 (unstable) - 2012-03-01

    * Fixed parser bug affecting numbers like "#e.021".

1.1.2 (unstable) - 2011-03-19

    * Do not modify the standard Number.prototype object.

1.0.1 - 2011-02-10 - First numbered release.

See file CHANGES.md for more.

[1]: http://www.r6rs.org/
[2]: http://www.r6rs.org/final/r6rs.pdf
[3]: http://www.naturaldocs.org/.
