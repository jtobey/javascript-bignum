#! /usr/bin/perl

use strict;
use warnings; no warnings 'qw';
$| = 1;

my $lang = shift || "scheme";

my @SPEC =
    (
#       [qw( number? o )                                   ],
#       [qw( complex? o )                                  ],
#       [qw( real? o )                                     ],
#       [qw( rational? o )                                 ],
#       [qw( integer? o )                                  ],
#       [qw( real-valued? o )                              ],
#       [qw( rational-valued? o )                          ],
#       [qw( integer-valued? o )                           ],
#       [qw( exact? z )                                    ],
#       [qw( inexact? z )                                  ],
#       [qw( = z z )                                       ],
#       [qw( = z z z )                                     ],
#       [qw( < x x )                                       ],
#       [qw( < x x x )                                     ],
#       [qw( > x x )                                       ],
#       [qw( > x x x )                                     ],
#       [qw( <= x x )                                      ],
#       [qw( <= x x x )                                    ],
#       [qw( >= x x )                                      ],
#       [qw( >= x x x )                                    ],
#       [qw( zero? z )                                     ],
#       [qw( positive? x )                                 ],
#       [qw( negative? x )                                 ],
#       [qw( odd? n )                                      ],
#       [qw( even? n )                                     ],
#       [qw( finite? x )                                   ],
#       [qw( infinite? x )                                 ],
#       [qw( nan? x )                                      ],
#       [qw( max x x )                                     ],
#       [qw( max x x x )                                   ],
#       [qw( min x x )                                     ],
#       [qw( min x x x )                                   ],
#       [qw( + )                                           ],
#       [qw( + z )                                         ],
#       [qw( + z z )                                       ],
#       [qw( + z z z )                                     ],
#       [qw( * )                                           ],
#       [qw( * z )                                         ],
#       [qw( * z z )                                       ],
#       [qw( * z z z )                                     ],
#       [qw( - z )                                         ],
#       [qw( - z z )                                       ],
#       [qw( - z z z )                                     ],
#       [qw( / z )                                         ],
#       [qw( / z z )                                       ],
#       [qw( / z z z )                                     ],
#       [qw( abs x )                                       ],
#       [qw( div-and-mod x x )                             ],
#       [qw( div x x )                                     ],
#       [qw( mod x x )                                     ],
#       [qw( div0-and-mod0 x x )                           ],
#       [qw( div0 x x )                                    ],
#       [qw( mod0 x x )                                    ],
#       [qw( gcd )                                         ],
#       [qw( gcd n )                                       ],
#       [qw( gcd n n )                                     ],
#       [qw( gcd n n n )                                   ],
      [qw( lcm )                                         ],
      [qw( lcm n )                                       ],
      [qw( lcm n n )                                     ],
      [qw( lcm n n n )                                   ],
#       [qw( numerator q )                                 ],
#       [qw( denominator q )                               ],
#       [qw( floor x )                                     ],
#       [qw( ceiling x )                                   ],
#       [qw( truncate x )                                  ],
#       [qw( round x )                                     ],
      [qw( rationalize q q )                             ],
      [qw( exp z )                                       ],
      [qw( log z )                                       ],
      [qw( log z z )                                     ],
      [qw( sin z )                                       ],
      [qw( cos z )                                       ],
      [qw( tan z )                                       ],
      [qw( asin z )                                      ],
      [qw( acos z )                                      ],
      [qw( atan z )                                      ],
      [qw( atan x x )                                    ],
#       [qw( sqrt z )                                      ],
#       [qw( exact-integer-sqrt k )                        ],
#       [qw( expt z zsmall )                               ],
#       [qw( make-rectangular x x )                        ],
#       [qw( make-polar x x )                              ],
#       [qw( real-part z )                                 ],
#       [qw( imag-part z )                                 ],
#       [qw( magnitude z )                                 ],
#       [qw( angle z )                                     ],
#       [qw( number->string z )                            ],
#       [qw( number->string z radix )                      ],
#       [qw( number->string z radix ksmall )               ],
    );
my %DATA =
    (
     o => [qw( cons 'z )],
     z => [qw( 'zsmall 'zlarge )],
     x => [qw( 'xsmall 'xlarge )],
     q => [qw( 'qsmall 'qlarge )],
     n => [qw( 'nsmall 'nlarge )],
     k => [qw( 'ksmall 'klarge )],
     zsmall => [qw( 1+2i -2/3+0.i 'xsmall )],
     zlarge => [qw( 'xlarge )],
     xsmall => [qw( 'qsmall )],
     xlarge => [qw( +nan.0 +inf.0 -inf.0 'qlarge )],
     qsmall => [qw( -0.1 5/2 -3.3e-99 #e1e-50 'nsmall )],
     qlarge => [qw( 'nlarge )],
     nsmall => [qw( -3 -1 0.0 'ksmall )],
     nlarge => [qw( 'klarge )],
     ksmall => [qw( 1 7 )],
     klarge => [qw( #e1e17 9007199254740992 )],
     radix => [qw( 2 8 10 16 )],
    );
sub splice_subtypes {
    my ($code) = (@_);
    my $array = $DATA{$code};
    for (my $i = 0; $i < @$array; $i++) {
        my $elt = $$array[$i];
        if (substr($elt, 0, 1) eq "'") {
            my $subarray = &splice_subtypes(substr($elt, 1));
            splice(@$array, $i, 1, @$subarray);
            $i += @$subarray - 1;
        }
    }
    return $array;
}
for my $code (sort(keys(%DATA))) {
    &splice_subtypes($code);
}

sub prolog_scheme {
    print(<<'END');
#!r6rs
(import (rnrs base)
        (rnrs io ports)
        (rnrs exceptions))
(define-syntax test
  (syntax-rules ()
    ((_ label body)
     (begin
       (put-string (current-output-port) label)
       (flush-output-port (current-output-port))
       (call-with-values
           (lambda ()
             (guard (e (1 e))
               body))
         (lambda (result . more)
           (put-datum (current-output-port) result)
           (for-each
             (lambda (v)
               (put-string (current-output-port) ",")
               (put-datum (current-output-port) v))
             more)
           (put-string (current-output-port) "\n")
           (flush-output-port (current-output-port))))))))
END
    my %seen;
    for my $array (values(%DATA)) {
        for (@$array) {
            next if $seen{$_}++;
            (my $n=$_)=~tr/#/_/;
            print(qq/(define C$n $_)\n/);
        }
    }
}

sub gen_scheme {
    my ($fn, @args) = (@_);
    print(qq/(test "(@_) " (/);
    print(join(" ", $fn, map { (my $n=$_)=~tr/#/_/; "C$n" } @args));
    print(qq/))\n/);
}

sub prolog_js {
    print(<<'END');
load("../biginteger.js");
load("../schemeNumber.js");
var sf = SchemeNumber.fn;
var isNumber = sf["number?"];
var ns = sf["number->string"];
var nums = {
END
    for my $num (@{$DATA{'o'}}) {
        print(qq/    "$num":sf["string->number"]("$num"),\n/);
    }
    print(<<'END');
};
function myNs(a) {
    return ns(a);  // Omit extra arguments.
}
function test(fname, a, b, c) {
    var line = "(" + fname;
    var len = arguments.length;
    for (var i = 1; i < len; i++) {
        var arg = arguments[i];
        line += " " + arg;
        var num = nums[arg];
        arguments[i] = (num === undefined ? arg : nums[arg]);
    }
    line += ") ";
    var x;
    try {
        switch(len) {
        case 1: x = sf[fname]();        break;
        case 2: x = sf[fname](a);       break;
        case 3: x = sf[fname](a, b);    break;
        case 4: x = sf[fname](a, b, c); break;
        default: x = "Error - unhandled case " + len + " arguments";
        }
        if (isNumber(x)) line += ns(x);
        else if (x === true) line += "#t";
        else if (x === false) line += "#f";
        else if (x instanceof Array) line += x.map(myNs).join(",");
        else line += '"' + x + '"';
    }
    catch(e) {
        line += e;
    }
    print(line);
}
END
}

sub gen_js {
    my ($fn, @args) = (@_);
    print(qq/test("/ . join('", "', $fn, @args) . qq/");\n/);
}

sub gen {
    my ($gen_lang, $fn, $args, $level) = (@_);
    if ($level == scalar(@$args)) {
        $gen_lang->($fn, @$args);
    }
    else {
        my $type = $$args[$level];
        for my $value (@{$DATA{$type}}) {
            $$args[$level] = $value;
            &gen($gen_lang, $fn, $args, $level + 1);
        }
        $$args[$level] = $type;
    }
}

sub gen_all {
    my ($gen_lang) = (@_);
    for my $spec (@SPEC) {
        my ($fn, @args) = @$spec;
        gen($gen_lang, $fn, \@args, 0);
    }
}

if ($lang eq 'scheme') {
    &prolog_scheme();
    &gen_all(\&gen_scheme);
}
elsif ($lang eq 'js') {
    &prolog_js();
    &gen_all(\&gen_js);
}
else {
    die("Usage: $0 { scheme | js }\n");
}
