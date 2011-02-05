#! /usr/bin/perl

use strict;
use warnings; no warnings 'qw';
$| = 1;

my $lang = shift || "scheme";

my @SPEC =
    (
     [qw( number? o )                                   ],
     [qw( complex? o )                                  ],
     [qw( real? o )                                     ],
     [qw( rational? o )                                 ],
     [qw( integer? o )                                  ],
     [qw( real-valued? o )                              ],
     [qw( rational-valued? o )                          ],
     [qw( integer-valued? o )                           ],
     [qw( exact? z )                                    ],
     [qw( inexact? z )                                  ],
     [qw( = z z )                                       ],
     [qw( = z z z )                                     ],
     [qw( < x x )                                       ],
     [qw( < x x x )                                     ],
     [qw( > x x )                                       ],
     [qw( > x x x )                                     ],
     [qw( <= x x )                                      ],
     [qw( <= x x x )                                    ],
     [qw( >= x x )                                      ],
     [qw( >= x x x )                                    ],
     [qw( zero? z )                                     ],
     [qw( positive? x )                                 ],
     [qw( negative? x )                                 ],
     [qw( odd? n )                                      ],
     [qw( even? n )                                     ],
     [qw( finite? x )                                   ],
     [qw( infinite? x )                                 ],
     [qw( nan? x )                                      ],
     [qw( max x x )                                     ],
     [qw( max x x x )                                   ],
     [qw( min x x )                                     ],
     [qw( min x x x )                                   ],
     [qw( + )                                           ],
     [qw( + z )                                         ],
     [qw( + z z )                                       ],
     [qw( + z z z )                                     ],
     [qw( * )                                           ],
     [qw( * z )                                         ],
     [qw( * z z )                                       ],
     [qw( * z z z )                                     ],
     [qw( - z )                                         ],
     [qw( - z z )                                       ],
     [qw( - z z z )                                     ],
     [qw( / z )                                         ],
     [qw( / z z )                                       ],
     [qw( / z z z )                                     ],
     [qw( abs x )                                       ],
#     [qw( div-and-mod x x )                             ],
     [qw( div x x )                                     ],
     [qw( mod x x )                                     ],
#     [qw( div0-and-mod0 x x )                           ],
     [qw( div0 x x )                                    ],
     [qw( mod0 x x )                                    ],
     [qw( gcd )                                         ],
     [qw( gcd n )                                       ],
     [qw( gcd n n )                                     ],
     [qw( gcd n n n )                                   ],
     [qw( lcm )                                         ],
     [qw( lcm n )                                       ],
     [qw( lcm n n )                                     ],
     [qw( lcm n n n )                                   ],
     [qw( numerator q )                                 ],
     [qw( denominator q )                               ],
     [qw( floor x )                                     ],
     [qw( ceiling x )                                   ],
     [qw( truncate x )                                  ],
     [qw( round x )                                     ],
#     [qw( rationalize x x )                             ],
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
     [qw( sqrt z )                                      ],
#     [qw( exact-integer-sqrt k )                        ],
     [qw( expt z zsmall )                               ],
     [qw( make-rectangular x x )                        ],
     [qw( make-polar x x )                              ],
     [qw( real-part z )                                 ],
     [qw( imag-part z )                                 ],
     [qw( magnitude z )                                 ],
     [qw( angle z )                                     ],
     [qw( number->string z )                            ],
     [qw( number->string z radix )                      ],
     [qw( number->string z radix ksmall )               ],
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
     xlarge => [qw(  +nan.0 +inf.0 -inf.0 'qlarge )],
     qsmall => [qw( -0.1 5/2 'nsmall )],
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
    print(qq{(import (rnrs base)\n});
    print(qq{        (rnrs io ports)\n});
    print(qq{        (rnrs io simple)\n});
    print(qq{        (rnrs exceptions))\n});
    print(qq{(define (outs s) (put-string (current-output-port) s))\n});
    print(qq{(define (outd d) (put-datum (current-output-port) d))\n});
    print(qq{(define (flush) (flush-output-port (current-output-port)))\n});
    for (@{$DATA{'o'}}, @{$DATA{'radix'}}) {
        (my $n=$_)=~tr/#/_/;
        print(qq/    (define-syntax C$n (identifier-syntax $_))\n/);
    }
}

sub gen_scheme {
    my ($fn, @args) = (@_);
    print(qq{(outs "(@_) ")(flush)});
    print(qq{(outd (guard (e (#t e)) (});
    print(join(" ", $fn, map { (my $n=$_)=~tr/#/_/; "C$n" } @args));
    print(qq{)))(newline)\n});
}

sub prolog_js {
    print(qq(load("schemeNumber.js");\n));
    print(qq(var sn = SchemeNumber.fn;\n));
    print(qq(var isNumber = sn["number?"];\n));
    print(qq(var numberToString = sn["number->string"];\n));
    print(qq/var nums = {\n/);
    for my $num (@{$DATA{'o'}}) {
        print(qq/    "$num":sn["string->number"]("$num"),\n/);
    }
    print(qq/};\n/);
    print(<<END);
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
        case 1: x = sn[fname]();        break;
        case 2: x = sn[fname](a);       break;
        case 3: x = sn[fname](a, b);    break;
        case 4: x = sn[fname](a, b, c); break;
        default: x = "Error - unhandled case " + len + " arguments";
        }
        if (x === true) line += "#t";
        else if (x === false) line += "#f";
        else if (isNumber(x)) line += numberToString(x);
        else line += '"' + x + '"';
    }
    catch(e) {
        line += e;
    }
    print(line);
}
END
    print(qq(var parse = sn["string->number"];\n));
    print(qq(var line = "";\n));
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
