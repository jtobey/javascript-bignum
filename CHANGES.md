1.3.1 (unstable) - 2012-03-22

    * Refactoring to support separation into modules.
    * Ported test suite to Node.js.

1.3.0 (unstable) - 2012-03-07

    * Unstable development branch containing new plugin API.
    * Major refactoring to support number type extensions.
    * Cleaned up and formalized the double-dispatch system.
    * Minor logic and performance fixes, but test suite performance
      lags that of 1.2.0 by about 20%.

1.2.0 - 2012-03-04

    * Stable release with unmodified Number.prototype.
    * Added test case for recent fix.

1.1.6 (unstable) - 2012-03-04

    * Fixed bug in fn["eqv?"] affecting non-numeric arguments.

1.1.5 (unstable) - 2012-03-01

    * Fixed parser bug affecting numbers like "#e.021" on platforms
      where parseInt("021") returns 17 instead of 21 as specified by
      ECMA.
    * Various minor improvements and reorganizations.

1.1.4 (unstable) - 2011-03-29

    * ECMAScript-like conversions: sn(new Date()) means sn(+new Date()).

1.1.2 (unstable) - 2011-03-19

    * Do not modify the standard Number.prototype object.

1.0.9 - 2011-03-19

    * Fixes backported from 1.1 branch:
    * Make sn("garbage") raise an appropriate exception.
    * Convert fn.atan second argument.
    * Avoid no-such-method in x.valueOf() for complex x.

1.1.1 (unstable) - 2011-03-19

    * Made code work without affecting Number.prototype (no API yet).

1.1.0 (unstable) - 2011-03-17

    * Unstable branch.
    * Wrap all(?) inexact real results with toFlonum.
    * Bug fix: Convert fn.atan second argument.

1.0.8 - 2011-03-16

    * Make sn("#e1@2") equivalent to fn.exact("1@2").

1.0.7 - 2011-03-04

    * parser: optimize simple integer parsing.

1.0.6 - 2011-02-13

    * toFixed: bug fix: include leading "-" in negatives rounded to zero.

1.0.5 - 2011-02-12

    * Fixed a bug in toFixed affecting rounding.

1.0.4 - 2011-02-11

    * Bugs fixed in SchemeNumber implementation of ECMAScript Number
      methods: toFixed, toPrecision, and toExponential.  Thanks to
      theonesmiley.

1.0.3 - 2011-02-10

    * Faster big integer arithmetic, courtesy of Vitaly Magerya.
      Approximately 20% test suite speedup.

1.0.2 - 2011-02-10

    * Moved argument conversion from internal methods to public
      functions.  Approximately 10% test suite speedup.

1.0.1 - 2011-02-10

    * Support ECMA standard formatting methods: toFixed,
      toExponential, toPrecision.
