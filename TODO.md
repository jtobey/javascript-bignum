TODO:

* Fix (expt 0 0) in maint branches as per the example in R6RS.

* Backport fix: (angle 1.0) must be inexact.

* Decimal: Test and debug.

* Leemon Baird BigInt wrapper: optimize.  Add exactIntegerSqrt.

* Provide a choice among different implementations of complex numbers
  and inexact reals.

* Support primitive numbers as exact values using conditionals,
  typeof, and lifting as in js-numbers.

* Create integer and rational implementations using the GMP plug-in.
  Consider hybrid implementations with runtime optimal threshold
  discovery, since the plugin may be out-of-process, incurring 100x
  per-call overhead.  Implement lazy evaluation using expression
  objects that batch operations into scripts.

* Consider avoidance or mitigation of GMP calls to abort(),
  division-by-zero, square-root-of-negative, anything else?

* Add MPFR functions to the GMP plugin.  Create a high-precision
  inexact number implementation on MPFR.

* Reimplement the performance benefit of using Number.prototype for
  inexact, but make it optional.

* Implement (rnrs arithmetic bitwise) functions.

* Think about what to do with "#e1@1".

* Consider supporting a configuration where inexact reals are returned
  as primitive numbers but Number.prototype is not used.

* Consider supporting primitive numbers as exact values using
  Number.prototype.

* Avoid "x in y" out of concern for Object.prototype use.

* Consider supporting continuation-passing style for the benefit of
  Scheme(?) and PPAPI.

* Consider merging the plugin architecture into D. Yoo's js-numbers.

* Consider type implementations that dynamically measure usage and
  change representations on-the-fly to improve performance (run-time
  optimization).
