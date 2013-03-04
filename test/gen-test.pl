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
     [qw( = bigint bigint )                             ],
     [qw( < x x )                                       ],
     [qw( < x x x )                                     ],
     [qw( < bigint bigint )                             ],
     [qw( > x x )                                       ],
     [qw( > x x x )                                     ],
     [qw( > bigint bigint )                             ],
     [qw( <= x x )                                      ],
     [qw( <= x x x )                                    ],
     [qw( <= bigint bigint )                            ],
     [qw( >= x x )                                      ],
     [qw( >= x x x )                                    ],
     [qw( >= bigint bigint )                            ],
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
     [qw( div-and-mod x x )                             ],
     [qw( div-and-mod dm1 dm2 )                         ],
     [qw( div x x )                                     ],
     [qw( mod x x )                                     ],
     [qw( div0-and-mod0 x x )                           ],
     [qw( div0-and-mod0 dm1 dm2 )                       ],
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
     [qw( sqrt z )                                      ],
     [qw( exact-integer-sqrt k )                        ],
     [qw( expt z zsmall )                               ],
     [qw( make-rectangular x x )                        ],
     [qw( make-polar x x )                              ],
     [qw( real-part z )                                 ],
     [qw( imag-part z )                                 ],
     [qw( magnitude z )                                 ],
     [qw( angle z )                                     ],
     [qw( number->string z+big )                        ],
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
     xlarge => [qw( +nan.0 +inf.0 -inf.0 'qlarge )],
     qsmall => [qw( -0.1 5/2 -3.3e-99 #e1e-50 'nsmall )],
     qlarge => [qw( 'nlarge )],
     nsmall => [qw( -3 -1 0.0 2.0 'ksmall )],
     nlarge => [qw( 'klarge )],
     ksmall => [qw( 1 7 )],
     klarge => [qw( #e1e17 9007199254740992 )],
     radix => [qw( 2 8 10 16 )],
     'z+big' => [qw( 'z 'bigint 'bd1 )],
     big1 => ['2273201718951068473231554543576467700230703002423341552'],
     big2 => ['2273201718951068473231548191215506418319396854124635512'],
     bigint => [qw( 'big1 'big2 )],
     bd1 => ['#e1234567890.123456789'],
     dm1 => [qw( -9007199254740991 -8888888888888887 )],
     dm2 => [qw( -4503599627370496 6655321077788899 )],
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

my $num_tests = 0;

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

sub prolog_html {
    print(<<'END');
<html><head>
<meta charset="UTF-8"></meta>
<script src="../biginteger.js"></script>
<script src="../schemeNumber.js"></script>
<script>
var expect, expected;
var okElt, nokElt, triedElt, timeElt, statusElt;
var ok, tried, started, update_time;
var ww_script, worker;

function log_error(expr, out) {
    console.log(expr + " " + out + ", expected " + expected);
}
function ww_expect(output, fname, a, b, c) {
    //if (ww_script.length > 4000) return;  // XXX testing.
    ww_script += "expected='" + output + "'; test('" + fname + "'";
    for (var i = 2; i < arguments.length; i++)
        ww_script += ",'" + arguments[i] + "'";
    ww_script += ");\n";
}
function immediate_expect(output, fname, a, b, c) {
    expected = output;
    switch (arguments.length) {
    case 2: test(fname);          break;
    case 3: test(fname, a);       break;
    case 4: test(fname, a, b);    break;
    case 5: test(fname, a, b, c); break;
    }
}
function update_stats() {
    triedElt.innerHTML = String(tried);
    okElt.innerHTML = String(ok);
    nokElt.innerHTML = String(tried - ok);
    timeElt.innerHTML = String((update_time - started) / 1000);
}
function show_result(expr, out) {
    // non-ww version.
    tried++;
    if (out == expected)
        ok++;
    else
        log_error(expr, out);
}
function set_status(status) {
    statusElt.innerHTML = status;
}
function done() {
    update_stats();
    var msg = (ok == tried ? "Success!" : "see web console for details.");
    set_status(msg);
}
function handle_message(event) {
    var ts = event.timeStamp;
    if (ts > 1e12) ts /= 1000;  // XXX accommodate microseconds
    event.data.split('\n').forEach(function(line) {
        var match = /^(\S*)(?: (.*))?$/.exec(line);
        switch (match[1]) {
        case "start":
            started = ts;
            update_time = started;
            set_status("running...");
            break;
        case "ok":  ok++;  // Fall through.
        case "nok": tried++;
            if (ts >= update_time) {
                update_time = ts;
                update_stats();
                update_time += 500;
            }
            break;
        case "done":
            done();
            break;
        case "status":
            set_status(match[2]);  // for testing
            break;
        }
        if (match[2])
            console.log(match[2]);
    });
}
function enable_use_ww() {
    var elt = document.getElementById('use_ww');
    elt.checked = (typeof Worker === "function");
    use_ww_onchange(elt);
    elt.disabled = false;
}
function use_ww_onchange(elt) {
    document.getElementById('stop_button').disabled = !elt.checked;
}
function stop_tests() {
    if (worker) {
        worker.terminate();
        worker = undefined;
    }
}
END
    print(setup_js());
    print(<<'END');
function run_tests() {
    okElt = document.getElementById('ok');
    nokElt = document.getElementById('nok');
    triedElt = document.getElementById('tried');
    timeElt = document.getElementById('time');
    statusElt = document.getElementById('status');
    ok = 0;
    tried = 0;
    if (document.getElementById('use_ww').checked) {
        expect = ww_expect;
        var url = document.URL;
        ww_script = 'var url = \"' + url.replace(/"/g, '\\"') + '\";\n';
END
    my $script = <<'END';
url = url.replace(/\/[^\/]*$/, '/');
importScripts(url + "biginteger.js", url + "schemeNumber.js");
var expected, msgbuf = '', next_flush = (new Date).getTime();
END
    $script .= setup_js() . <<'END';
function flush() {
    postMessage(msgbuf);
    msgbuf = '';
}
function show_result(expr, out) {
    var msg = "ok";
    if (out != expected)
        msg = "nok " + expr + " " + out + ", expected " + expected;
    msgbuf += msg + '\n';
    var now = (new Date).getTime();
    if (now > next_flush || msgbuf.length > 10000) {
        flush();
        next_flush = now + 500;
    }
}
postMessage("start");
END
    $script =~ s/\\/\\\\/g;
    $script =~ s/\n/\\n/g;
    $script =~ s/\'/\\'/g;
    $script =~ s{</script>}{</'+'script>}g;
    print("        ww_script += '$script';\n");
    print(<<'END');
        do_tests();  // build script
        ww_script += "flush();\npostMessage('done');\n";
        var url = "data:," + encodeURIComponent(ww_script);
        worker = new Worker(url);
        worker.onmessage = handle_message;
    }
    else {
        expect = immediate_expect;
        started = (new Date).getTime();
        do_tests();
        update_time = (new Date).getTime();
        done();
    }
}
function do_tests() {
END
}

sub prolog_js {
    print(<<'END');
var BigInteger, SchemeNumber;

if (typeof require === "undefined") {
    load("../biginteger.js");
    load("../schemeNumber.js");
} else {
    SchemeNumber = require('../schemeNumber').SchemeNumber;
}
var show_result;
if (typeof print !== "undefined")
    show_result = function(expr, out) { print(expr + " " + out) };
else {
    try {
        process.stdout.flush();
        show_result = function(expr, out) {
            console.log(expr + " " + out);
            process.stdout.flush(); // required for legacy support (Node <0.5)?
        };
    }
    catch (exc) {
        show_result = function(expr, out) {
            console.log(expr + " " + out);
        };
    }
}
END
    print(setup_js());
}

sub setup_js {
    my $setup = <<'END';
var fn = SchemeNumber.fn;
var isNumber = fn["number?"];
var ns = fn["number->string"];
var nums = {
END
    for my $num (@{$DATA{'o'}}) {
        $setup .= qq/    "$num":fn["string->number"]("$num"),\n/;
    }
    $setup .= <<'END';
};
function myNs(a) {
    return ns(a);  // Omit extra arguments.
}
function test(fname, a, b, c) {
    var expr = "(" + fname;
    var len = arguments.length;
    for (var i = 1; i < len; i++) {
        var arg = arguments[i];
        expr += " " + arg;
        var num = nums[arg];
        arguments[i] = (num === undefined ? arg : nums[arg]);
    }
    expr += ")";
    var x, out;
    try {
        switch(len) {
        case 1: x = fn[fname]();        break;
        case 2: x = fn[fname](a);       break;
        case 3: x = fn[fname](a, b);    break;
        case 4: x = fn[fname](a, b, c); break;
        default: x = "Error - unhandled case " + len + " arguments";
        }
        if (isNumber(x)) out = ns(x);
        else if (x === true) out = "#t";
        else if (x === false) out = "#f";
        else if (x instanceof Array) out = x.map(myNs).join(",");
        else out = '"' + x + '"';
    }
    catch(e) {
        out = e;
    }
    show_result(expr, out);
}
END
    return($setup);
}

sub gen_js {
    my ($fn, @args) = (@_);
    print(qq/test("/ . join('", "', $fn, @args) . qq/");\n/);
}

sub gen_html {
    # XXX Perl can't find the right answers, expect them on stdin.
    my $line = <>;
    return if !defined($line);
    if ($line !~ /^\((.*)\) (.+)$/) {
        warn("ignored line: $line");
        return;
    }
    my ($answer, $fn, @args) = ($2, split(/ /, $1));
    $answer =~ s/\"/\\\"/g;
    print(qq/expect("/ . join('", "', $answer, $fn, @args) . qq/");\n/);
    $num_tests++;
}

sub epilog_js {
    print(<<'END');
for (var i in this) {
    print("namespace pollution: " + i);
}
END
}

sub epilog_html {
    print(<<END);
}  // end of function do_tests()
</script>
</head><body onload="enable_use_ww()">
<p>Passed: <span id="ok">0</span></p>
<p>Failed: <span id="nok">0</span></p>
<p>Total: <span id="tried">0</span></p>
<p>Time: <span id="time">0</span></p>
<p>Status: <span id="status"></span></p>
<p><label><input type="checkbox" id="use_ww" disabled="disabled" onchange="use_ww_onchange(this)" />
 Use worker thread</label></p>
<p><button onclick="run_tests()">Go</button>
   <button onclick="stop_tests()" id="stop_button" disabled="disabled">Stop</button></p>
</body></html>
END
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
    &epilog_js();
}
elsif ($lang eq 'html') {
    &prolog_html();
    &gen_all(\&gen_html);
    &epilog_html();
}
else {
    die("Usage: $0 { scheme | js | html }\n");
}
