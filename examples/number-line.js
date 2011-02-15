/*  SVG scrollable, zoomable number line.

    Zoom out to a googol, and you can zoom in until the 100-digit
    numbers are consecutive.

    This file is number-line.js.  It requires biginteger.js and
    schemeNumber.js from javascript-bignum
    (https://github.com/jtobey/javascript-bignum).

    Refer to these files from SVG as follows, replacing the xlink:href
    values with correct URLs to the named files:

    <?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
    <svg xmlns="http://www.w3.org/2000/svg"
         xmlns:xlink="http://www.w3.org/1999/xlink"
         onload="init(this)">
      <script type="application/ecmascript" xlink:href="biginteger.js" />
      <script type="application/ecmascript" xlink:href="schemeNumber.js" />
      <script type="application/ecmascript" xlink:href="number-line.js" />
    </svg>

    Copyright (c) 2011 John Tobey <John.Tobey@gmail.com>
 */

// Arithmetic abstraction.
var WHICH_MATH;
if (typeof SchemeNumber == "undefined")
    WHICH_MATH = "native";
else
    WHICH_MATH = "Scheme";

var sn, fn, ns, trimPos;

if (WHICH_MATH === "native") {
    alert("Using native math");
    sn = function(s) { return Number(eval(s)); }
    fn = {
        exact    : Number,
        "number->string" : function(p) { return "" + p; },
        "+"      : function(x, y) { return +x + +y; },
        "-"      : function(x, y) { return arguments.length == 1 ? -x : x-y; },
        "*"      : function(x, y) { return x * y; },
        "/"      : function(x, y) { return arguments.length == 1 ? 1/x : x/y; },
        div      : function(x, y) { return Math.floor(x / y); },
        "zero?"  : function(x)    { return x == 0; },
        "="      : function(x, y) { return x == y; },
        "<="     : function(x, y) { return x <= y; },
        ">="     : function(x, y) { return x >= y; },
        "<"      : function(x, y) { return x < y; },
        ">"      : function(x, y) { return x > y; },
        "real?"  : function(x)    { return typeof x === "number"; },
        "positive?" : function(x) { return x > 0; },
        "negative?" : function(x) { return x < 0; },
        "finite?" : isFinite,
        "nan?"   : isNaN,
        "inexact?" : function(x) { return false; },
        log      : Math.log,
        floor    : Math.floor,
        ceiling  : Math.ceil,
        abs      : Math.abs,
        // XXX more needed?
    };
    ns = String;
    trimPos  = function(pos, len, h) { return pos; };
}
else {
    sn = SchemeNumber;
    fn = sn.fn;
    ns = fn["number->string"];

    trimPos = function(pos, len, h) {
        // Return pos, to within a pixel, simplified.
        if (fn["integer?"](pos))
            return pos;
        var d = Math.ceil(h / len);
        if (d < 1)
            d = 1;
        if (fn["<="](fn.denominator(pos), d))
            return pos;
        d = fn.exact(d);
        return fn["/"](fn.round(fn["*"](pos, d)), d);
    };
}
//var pos2text = fn["number->string"];
function pos2text(pos) {
    if (fn["negative?"](pos))
        return "-" + pos2text(fn["-"](pos));
    var n = fn.floor(pos);
    var f = fn["-"](pos, n);
    if (fn["zero?"](n))
        return ns(f);
    if (fn["zero?"](f))
        return ns(n);
    return ns(n) +  " " + ns(f);
}

var SVG_NS = "http://www.w3.org/2000/svg";
var XLINK_NS = "http://www.w3.org/1999/xlink";
var THIRTY = sn("30");
var HALF = sn("1/2");
var TWO = sn("2");
var ONE = sn("1");

function sync(f) {
    while (f)
        f = f();
}
function removeAllChildren(node) {
    while (node.firstChild != null)
        node.removeChild(node.firstChild);
}

// Please tell me if you know a reasonable way to get the <svg>
// dimensions in pixels!
function getSvgPixelDimensions(svg) {
    //Tried: window.getComputedStyle(svg, null).getPropertyCSSValue("width")
    //Tried: svg.height.baseVal.value
    //Tried: svg.getBoundingClientRect()
    var tmp, w = 0, h = 0;
    if (svg.hasAttributeNS(null, "height")) {
        tmp = svg.getAttributeNS(null, "height");
        if (/^[1-9][0-9]*$/.test(tmp))
            h = +tmp;
    }
    if (svg.hasAttributeNS(null, "width")) {
        tmp = svg.getAttributeNS(null, "width");
        if (/^[1-9][0-9]*$/.test(tmp))
            w = +tmp;
    }
    if ((!w || !h) && svg.ownerDocument && svg.ownerDocument.defaultView) {
        w = w || svg.ownerDocument.defaultView.innerWidth;
        h = h || svg.ownerDocument.defaultView.innerHeight;
    }
    w = w || 640;
    h = h || 480;
    return [w, h];
}

function NL(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this._drawables = [];
    this._svg = args.svg;
    this._drawn = this._svg.ownerDocument.createElementNS(SVG_NS, "g");
    this._svg.appendChild(this._drawn);
    var dim = getSvgPixelDimensions(this._svg);
    this.width = dim[0];
    this.height = dim[1];
    this._toDo = [];
    this.stats = {};
}

NL.prototype = {
    loBound        : sn("0"),
    //length         : fn["*"]("10", fn.expt("2","329")),
    length         : sn("10"),
    xshift         : 0,

    dragging       : false,
    dragPos        : undefined,
    dragX          : undefined,
    dragged        : false,

    workTimeslice  : 100,
    restTimeslice  : 100,

    //gobbling       : false,
    redrawCount    : 0,
    redrawTime     : 0,

    addDrawable    : NL_addDrawable,
    removeDrawable : NL_removeDrawable,

    beginDraw      : NL_beginDraw,
    beginPan       : NL_beginPan,
    beginZoom      : NL_beginZoom,
    beginResize    : NL_beginResize,

    doNext         : NL_doNext,
    doLast         : NL_doLast,
    workUntil      : NL_workUntil,
    workForMillis  : NL_workForMillis,
    work           : NL_work,
};

function NL_addDrawable(drawable) {
    var group = this._svg.ownerDocument.createElementNS(SVG_NS, "g");
    this._drawn.appendChild(group);
    this._drawables.push({drawable:drawable, group:group});
}

function NL_removeDrawable(drawable) {
    for (var i = 0; i < this._drawables.length; i++)
        if (this._drawables[i].drawable === drawable) {
            drawable.destroy();
            this._drawn.removeChild(this._drawables[i].group);
            this._drawables.splice(i, 1);
            return true;
        }
    return false;
}

// DC - drawing context.
function DC(nl, group) {
    if (!(this instanceof arguments.callee))
        return new arguments.callee(nl, group);
    this.nl = nl;
    this.g = group;
}
DC.prototype = new Object();
DC.prototype.erase = function() {
    removeAllChildren(this.g);
};
DC.prototype.out = function(elt) {
    this.g.appendChild(elt);
};
DC.prototype.createSvgElt = function(name) {
    return this.nl._svg.ownerDocument.createElementNS(SVG_NS, name);
};
DC.prototype.createTextNode = function(text) {
    return this.nl._svg.ownerDocument.createTextNode(text);
};

function NL_beginDraw() {
    var nl = this;
    var drawables = nl._drawables.slice(); // Copy the array.

    function draw() {
        var elt = drawables.shift();
        if (drawables.length > 0)
            nl.doNext(draw);
        var dc = DC(nl, elt.group);
        elt.drawable.beginDraw(dc);
    }
    nl.doNext(draw);
}

function beginXform(nl, xform, loBound, length, xshift, width, height) {
    var drawables = nl._drawables.slice(); // Copy the array.
    var old = new Object();
    old.loBound = nl.loBound;
    old.length  = nl.length;
    old.xshift  = nl.xshift;
    old.width   = nl.width;
    old.height  = nl.height;
    nl.loBound = loBound;
    nl.length  = length;
    nl.xshift  = xshift;
    nl.width   = width;
    nl.height  = height;

    function doit() {
        var elt = drawables.shift();
        if (drawables.length > 0)
            nl.doNext(doit);
        var dc = DC(nl, elt.group);
        dc.old = old;
        elt.drawable[xform](dc);
    }
    nl._toDo.length = 0;  // Cancel drawing in progress.  XXX
    nl.doNext(doit);
}

function NL_beginPan(movePos, moveX) {
    beginXform(this, "beginPan", fn["-"](this.loBound, movePos),
               this.length, this.xshift + moveX, this.width, this.height);
}

function NL_beginZoom(zoomFactor, zoomPos) {
    var newLength = fn["*"](zoomFactor, this.length);
    var newLoBound = fn["+"](zoomPos,
                             fn["*"](zoomFactor,
                                     fn["-"](this.loBound, zoomPos)));
    newLoBound = trimPos(newLoBound, this.length, this.height);
    beginXform(this, "beginZoom", newLoBound, newLength, this.xshift,
               this.width, this.height);
}

function NL_beginResize() {
    var dim = getSvgDimensionPixels(this._svg);
    beginXform(this, "beginResize", this.loBound, this.length, this.xshift,
               dim[0], dim[1]);
}

function NL_doNext(f) {
    this._toDo.unshift(f);
}

function NL_doLast(f) {
    this._toDo.push(f);
}

function NL_workUntil(end) {
    var ret = false;
    while (this._toDo.length > 0 && new Date() < end) {
        this._toDo.shift()();
        ret = true;
    }
    return ret;
}

function NL_workForMillis(ms) {
    return this.workUntil(+new Date() + ms);
}

function NL_work() {
    var nl = this;
    if (nl.workForMillis(nl.workTimeslice))
        window.setTimeout(function() { nl.work() }, nl.restTimeslice);
}

function AbstractDrawable() {
    if (!(this instanceof arguments.callee)) return new arguments.callee();
}
AbstractDrawable.prototype = {};
AbstractDrawable.prototype.beginDraw = function(dc) {
    //alert("Object doesn't override draw: " + this);
};
AbstractDrawable.prototype.beginPan = function(dc) {
    //dc.erase();
    //alert("AbstractDrawable.beginPan");
    return this.beginDraw(dc);
};
AbstractDrawable.prototype.beginZoom = AbstractDrawable.prototype.beginPan;
AbstractDrawable.prototype.beginResize = AbstractDrawable.prototype.beginPan;
AbstractDrawable.prototype.destroy = function() {};

function StaticText(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this._text = args.text;
}
StaticText.prototype = new AbstractDrawable();

StaticText.prototype.beginDraw = function(dc) {
    dc.erase();  // XXX
    var text = dc.createSvgElt("text");
    text.setAttributeNS(null, "x", dc.nl.width);
    text.setAttributeNS(null, "y", 0);
    text.setAttributeNS(null, "text-anchor", "end");
    text.setAttributeNS(null, "dominant-baseline", "text-before-edge");
    text.setAttributeNS(null, "font-style", "italic");
    //text.setAttributeNS(null, "font-size", intTextPixels);
    //text.setAttributeNS(null, "fill-opacity", opacity);
    text.appendChild(dc.createTextNode(this._text));
    dc.out(text);
}

function YearsSinceFiller(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this._time = args.time;
    this._fill = args.fill;
}
YearsSinceFiller.prototype = new AbstractDrawable();

// Number of seconds per mean Gregorian year.
var MILLIS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

YearsSinceFiller.prototype.beginDraw = function(dc) {
    var ysf = this;
    var group = dc.g;
    var nl = dc.nl;
    var lo, len, hi;

    function advance() {
        if (nl.loBound !== ysf.loBound || nl.length !== ysf.length) {
            ysf.loBound = nl.loBound;
            ysf.length  = nl.length;
            lo  = fn.inexact(ysf.loBound);
            len = fn.inexact(ysf.length);
            hi  = fn.inexact(fn["+"](ysf.loBound, ysf.length));
        }
        if (hi <= 0) {
            //alert("advance: nothing to do! lo="+lo+",len="+len);
            dc.erase();
            return;
        }

        var yearsSince = (new Date() - ysf._time) / MILLIS_PER_YEAR;
        var rectTop = 0, rectBottom = 0;

        if (yearsSince > lo) {
            rectBottom = nl.height;
            if (lo < 0 && len != 0)
                rectBottom *= 1 + (lo / len);
        }
        if (yearsSince < hi)
            rectTop = (hi - yearsSince) * (nl.height / len);

        if (rectTop < rectBottom) {
            //alert("group.firstChild="+group.firstChild);
            var rect = ysf._rect;
            if (!rect) {
                rect = dc.createSvgElt("rect");
                rect.setAttributeNS(null, "fill-opacity", 0.25);
                rect.setAttributeNS(null, "fill", ysf._fill);
            }
            rect.setAttributeNS(null, "x", 0);
            rect.setAttributeNS(null, "width", nl.width);
            rect.setAttributeNS(null, "y", rectTop);
            rect.setAttributeNS(null, "height", rectBottom - rectTop);
            //alert("set y="+rectTop+"; fill="+rect.getAttributeNS(null, "fill"));
            if (!ysf._rect) {
                ysf._rect = rect;
                //dc.out(rect);
                group.appendChild(rect);
            }
        }

        if (rectTop > 0) {
            var waitYears = len / nl.height / 10;  // 0.1 pixel
            var yearsToLo = lo - yearsSince;
            if (yearsToLo > 0)
                waitYears = yearsToLo;
            var waitTime = waitYears * MILLIS_PER_YEAR;
            if (waitTime < nl.restTimeslice)
                waitTime = nl.restTimeslice;
            //alert("waitTime=" + waitTime);
            ysf._timeout = window.setTimeout(advance, waitTime);
        }
    }

    ysf.stopDraw();
    //dc.erase();  // XXX
    advance();
};

YearsSinceFiller.prototype.stopDraw = function() {
    if (this._timeout) {
        window.clearTimeout(this._timeout);
        this._timeout = null;
    }
};

YearsSinceFiller.prototype.destroy = function() {
    this.stopDraw();
};

function BlackLeft(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this._x = +args.x;
}
BlackLeft.prototype = new AbstractDrawable();

BlackLeft.prototype.beginDraw = function(dc) {
    dc.erase();
    if (dc.nl.xshift > -this._x) {
        rect = dc.createSvgElt("rect");
        rect.setAttributeNS(null, "x", 0);
        rect.setAttributeNS(null, "y", 0);
        rect.setAttributeNS(null, "width", dc.nl.xshift + this._x);
        rect.setAttributeNS(null, "height", dc.nl.height);
        dc.out(rect);
    }
};

function Fractions(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this.textSize = args.textSize;
    this.minTextPixels = args.minTextPixels;
    this.maxTextPixels = args.maxTextPixels;
}
Fractions.prototype = new AbstractDrawable();

Fractions.prototype.beginDraw = function(dc) {
    dc.erase();  // XXX Start stupid, optimize later.
    var heightInLines = dc.nl.height / this.minTextPixels;
    var count = Math.floor(heightInLines);
    var list = getFractions(dc.nl.loBound, dc.nl.length, count);
    var logBigDenom = (Math.log(heightInLines) - fn.log(dc.nl.length)) / 2;
    while (true) {
        var fract = list.shift();
        if (!fract)
            break;

        var value = fn["/"](fract.n, fract.d);
        var y = dc.nl.height * (1 - fn["/"](fn["-"](value, dc.nl.loBound),
                                            dc.nl.length));

        var opacity = 0.5;
        var textSize = this.minTextPixels;
        var markWidth = 2 * textSize;
        var maxMarkWidth = dc.nl.width / 2;
        var logD = fract.logD();
        if (logD > logBigDenom) {
            if (logBigDenom > 0)
                opacity = 0.25;
        }
        else {
            textSize *= Math.exp((logBigDenom - logD) / 4);
            if (textSize > this.maxTextPixels)
                textSize = this.maxTextPixels;
        }
        markWidth *= Math.exp((logBigDenom - logD) / 2);
        if (markWidth > maxMarkWidth)
            markWidth = maxMarkWidth;
        markWidth = Math.floor(markWidth);
        var x = markWidth + dc.nl.xshift;
        rise = 0.2 * textSize;

        var mark = dc.createSvgElt("polygon");
        mark.setAttributeNS(null, "fill-opacity", opacity);
        mark.setAttributeNS(null, "points", "" + dc.nl.xshift + "," + y +
                            " " + x + "," +
                            (y-rise) + " " + x + "," + (y+rise));
        dc.out(mark);

        var text = dc.createSvgElt("text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "dominant-baseline", "middle");
        text.setAttributeNS(null, "font-size", textSize);
        text.setAttributeNS(null, "fill-opacity", opacity);
        text.appendChild(dc.createTextNode(pos2text(value)));
        dc.out(text);
    }
};

function init(svg) {
    function resize() {
        svg.nl.redraw();
    }

    svg.nl = NL({ svg:svg });
    // XXX This stuff belongs in number-line.svg, in XML format.
    svg.nl.addDrawable(StaticText({text:"Number Line"}));
    svg.nl.addDrawable(YearsSinceFiller({ time:0,
                                          fill:"blue" }));
    svg.nl.addDrawable(BlackLeft({ x:0 }));
    svg.nl.addDrawable(Fractions({ textSize: 0.5,
                                   minTextPixels: 12.5,
                                   maxTextPixels: 96 }));

    svg.nl.beginDraw();
    //window.addEventListener('resize',         resize, false);
    window.addEventListener('mousedown',      mousedown,   true);
    window.addEventListener('mouseup',        mouseup,     true);
    window.addEventListener('click',          click,       true);
    window.addEventListener('mousemove',      mousemove,   true);
    window.addEventListener('DOMMouseScroll', mousescroll, true);
    svg.nl.work();
}

function evt2svg(evt) {
    var svg = evt.target;
    while (!(svg.nl instanceof NL)) {
        svg = svg.parentNode;
        if (svg == null) {
            alert("oops, no svg ancestor of " + evt.target.nodeName);
            return null;
        }
    }
    return svg;
}
function evt2pos(evt, nl) {
    var y = evt.clientY;
    return fn["+"](nl.loBound, fn["/"](fn["*"](fn.exact(nl.height - y),
                                               nl.length),
                                       fn.exact(nl.height)));
}

NL.prototype.log = function(name, evt) {
    if (!this.stats[name])
        this.stats[name] = 0;
    this.stats[name]++;
};

// XXX poorly named
NL.prototype.returnFromEvent = function() {
    if (this._evtPause)
        window.clearTimeout(this._evtPause);
    var nl = this;
    this._evtPause = window.setTimeout(function() { nl.work(); }, 40);
};

function click(evt) {
    var svg = evt2svg(evt);
    svg.nl.log("click", evt);
    if (evt.shiftKey)
        alert(svg.nl.statistics());

    if (svg.nl.dragged || evt.shiftKey || evt.button == 2) {
        svg.nl.dragged = false;
        return;
    }
    var zoomFactor = HALF;
    if (evt.button == 1 || evt.ctrlKey) {
        zoomFactor = TWO;
    }
    svg.nl.beginZoom(zoomFactor, evt2pos(evt, svg.nl));
    svg.nl.returnFromEvent();
}

NL.prototype.statistics = function() {
    var ret = "";
    ret += "redraws: " + this.redrawCount + " avg " +
        (this.redrawTime / this.redrawCount / 1000).toFixed(3) + "s\n";
    ret += "redrawTime: " + this.redrawTime + "\n";
    ret += "loBound=" + this.loBound.SN_debug() + "\n";
    ret += "length=" + this.length.SN_debug() + "\n";
    var stats = this.stats;
    var keys = []; for (var k in this.stats) keys.push(k);
    keys.sort().forEach(function(k) {
            ret += k + "=" + stats[k] + "\n";
        });
    return ret;
};

function mousedown(evt) {
    var svg = evt2svg(evt);
    svg.nl.log("mousedown", evt);
    svg.nl.dragging = true;
    svg.nl.dragPos = evt2pos(evt, svg.nl);
    svg.nl.dragX = evt.clientX;
}
function mousemove(evt) {
    var svg = evt2svg(evt);
    svg.nl.log("mousemove", evt);
    if (svg.nl.dragging)
        handleDragEvent(svg, evt);
}
function mouseup(evt) {
    var svg = evt2svg(evt);
    svg.nl.log("mouseup", evt);
    if (svg.nl.dragging) {
        handleDragEvent(svg, evt);
        svg.nl.dragging = false;
    }
}

function handleDragEvent(svg, evt) {
    var movePos = fn["-"](evt2pos(evt, svg.nl), svg.nl.dragPos);
    var moveX = evt.clientX - svg.nl.dragX;
    //dragging=false;alert("movePos " + movePos.debug());
    if (!fn["zero?"](movePos) || moveX) {
        svg.nl.beginPan(movePos, moveX);
        svg.nl.dragX = evt.clientX;
        svg.nl.dragged = true;
        svg.nl.returnFromEvent();
    }
}

function mousescroll(evt) {
    var svg = evt2svg(evt);
    svg.nl.log("mousescroll", evt);
    if (evt.axis === evt.VERTICAL_AXIS) {
        //alert("mousescroll vertical: " + evt.detail);
        var movePos = fn["/"](fn["*"](fn.exact(evt.detail), svg.nl.length),
                              THIRTY);
        svg.nl.beginPan(movePos, 0);
        svg.nl.returnFromEvent();
    }
}

if (false) {

function draw(svg) {
    var doc = svg.ownerDocument;
    var hpx = getSvgHeight(svg);
    var i, x, y, rise, text, mark, intPixels, step, intTextPixels;
    var opacity, rect, count = 0;
    var hiBound = fn["+"](loBound, length);

    intPixels = fn["/"](fn.exact(hpx), length);
    step = fn["+"](fn.div(fn.exact(minIntTextPixels), intPixels), ONE);
    intTextPixels = textSize * intPixels;
    if (intTextPixels < minIntTextPixels)
        intTextPixels = minIntTextPixels;
    if (intTextPixels > maxTextPixels)
        intTextPixels = maxTextPixels;
    i = fn["*"](step, fn.div(loBound, step));
    var limit = 2 * hpx / intTextPixels;
    for (; fn["<="](i, hiBound); i = fn["+"](i, step)) {
        if (count++ > limit) {
            alert("The numbers are getting too big! " + [count,
    hpx, intTextPixels]);
            return;
        }
        y = hpx - fn["*"](fn["-"](i, loBound), intPixels);
        x = 2 * intTextPixels + xshift;
        rise = 0.2 * intTextPixels;
        opacity = 0.5;

        if (!doc.createElementNS) {
            print([i, xshift,x,y,rise]);
            continue;
        }
        mark = doc.createElementNS(SVG_NS, "polygon");
        mark.setAttributeNS(null, "fill-opacity", opacity);
        mark.setAttributeNS(null, "points", "" + xshift + "," + y +
                            " " + x + "," +
                            (y-rise) + " " + x + "," + (y+rise));
        svg.appendChild(mark);

        text = doc.createElementNS(SVG_NS, "text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "dominant-baseline", "middle");
        text.setAttributeNS(null, "font-size", intTextPixels);
        text.setAttributeNS(null, "fill-opacity", opacity);
        text.appendChild(doc.createTextNode(pos2text(i)));
        svg.appendChild(text);

        rect = doc.createElementNS(SVG_NS, "rect");
        rect.setAttributeNS(null, "x", 0);
        rect.setAttributeNS(null, "y", 0);
        rect.setAttributeNS(null, "width", xshift);
        rect.setAttributeNS(null, "height", hpx);
        svg.appendChild(rect);
    }
}

function redraw(svg) {
    if (!gobbling) {
        var start = new Date().getTime();
        clear(svg);
        draw(svg);
        redrawCount++;
        redrawTime += new Date().getTime() - start;
        gobbling = true;
        window.setTimeout(stopGobbling, 100, loBound, length, xshift, svg);
    }
}

function stopGobbling(lb, len, xs, svg) {
    gobbling = false;
    if (lb !== loBound || len !== length || xs !== xshift) {
        log("gobble-redraw");
        redraw(svg);
    }
    else {
        log("empty-gobble");
    }
}

}

function CF(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    for (var p in args) {
        this[p] = args[p];
    }
}
var INF   = CF({ n:sn("1"),  d:sn("0"), c:null, l:0 });
var M_INF = CF({ n:sn("-1"), d:sn("0"), c:null, l:0 });
CF.prototype.toString = function() {
    return ns(this.n) + "/" + ns(this.d) + " " +
        /*+fn["/"](this.n, this.d).toPrecision(20)*/
        + (this.n / this.d) +  " [" + this.getC() + "]";
};
CF.prototype.logD = function() {
    return fn.log(this.d);
};
CF.prototype.getC = function() {
    var q = fn["/"](this.n, this.d);
    //print(this.n+"/"+this.d+"="+q);
    var cf = [];
    if (!fn["finite?"](q))
        return cf;
    while (true) {
        var f = fn.floor(q);
        //print("q=" + q);
        if (fn["nan?"](q))
            throw new Error("NaN");
        cf.push(f);
        q = fn["-"](q, f);
        //print("frac(q)=" + q);
        if (fn["zero?"](q))
            return cf;
        if (WHICH_MATH === "native" && q < 1e-10) {
            if (cf[cf.length - 1] == 1) {
                cf[cf.length - 2]++;
                cf.length--;
            }
            return cf;
        }
        q = fn["/"](q);
    }
};

function arrayToList(a) {
    var len = a.length;
    var ret = null;
    for (var i = 0; i < len; i++)
        ret = [a[i], ret];
    return ret;
}

function getFractions(low, len, count) {
    low = sn(low);
    len = sn(len);

    if (!fn["real?"](len))
        throw new TypeError("len is not a real number: " + len);
    if (!fn["real?"](low))
        throw new TypeError("low is not a real number: " + low);

    if (!fn["positive?"](len))
        throw new RangeError("len is not positive: " + ns(len));
    if (!fn["finite?"](len))
        throw new RangeError("len is not finite: " + ns(len));
    if (!fn["finite?"](low))
        throw new RangeError("low is not finite: " + ns(low));

    if (fn["inexact?"](len))
        throw new TypeError("len is not exact: " + ns(len));
    if (fn["inexact?"](low))
        throw new TypeError("low is not exact: " + ns(low));

    if (count < 1)
        return [];

    var logSpace = fn.log(len) - Math.log(count);
    var high = fn["+"](low, len);
    var lo = low;
    var hi = high;
    var loFloor, hiFloor, tmp, cf = [];

    while (true) {
        loFloor = fn.floor(lo);
        hiFloor = fn.floor(hi);
        if (!fn["="](loFloor, hiFloor)) {
            if (cf.length === 0) {
                if (!fn["positive?"](hi))
                    cf.push(fn["-"](fn.ceiling(hi), "1"));
                else if (fn["negative?"](loFloor))
                    cf.push(sn("0"));
                else
                    cf.push(fn["+"](loFloor, "1"));
            }
            else
                cf.push(fn["+"](loFloor, "1"));
            break;
        }
        cf.push(loFloor);
        lo = fn["-"](lo, loFloor);
        if (fn["zero?"](lo))
            break;
        hi = fn["-"](hi, hiFloor);
        if (fn["zero?"](hi))
            break;

        tmp = fn["/"](lo);
        lo = fn["/"](hi);
        hi = tmp;
    }

    var n = sn("1");
    var d = sn("0");
    var i = cf.length;
    while (i--) {
        // Set n/d = cf[len] + d/n = ((n*cf[len])+d)/n.
        var tmp = n;
        n = fn["+"](fn["*"](n, cf[i]), d);
        d = tmp;
    }

    var c = arrayToList(cf);
    var mid = CF({n:n, d:d, c:c, l:cf.length});
    var bottom = simpler(mid, false);
    var top = simpler(mid, true);

    function between(x, y, xgty, bound, boundIsUpper) {
        //print("between([" + x + "], [" + y + "], " + xgty + ", " + bound + ", " + boundIsUpper + ")");
        //assert(fn["<="](x.d, y.d));
        //assert(fn["<"](x.d, y.d) || fn["<"](fn.abs(x.n), fn.abs(y.n)));
        var logXd = x.logD();
        var logYd = y.logD();
        var logDiff = -(logXd + logYd);
        //print("logDiff="+logDiff+", logSpace+Math.LN2="+(logSpace + Math.LN2));
        if (logDiff < logSpace + Math.LN2) {
            //print("returning empty");
            return [];
        }

        //assert(fn["="](fn["-"](fn["*"](x.n,y.d), fn["*"](x.d,y.n)), xgty ? "1" : "-1"));

        /* Find smallest N such that z = {n:N*x.n+y.n, d:N*x.d+y.d}
           differs from y by at least exp(logSpace).
           sp = N / (z.d * y.d) = N / (N*x.d*y.d + y.d*y.d)
           N*sp*x.d*y.d + sp*y.d*y.d = N
           sp*y.d*y.d = N * (1 - sp*x.d*y.d)
           N = ceil( (space * y.d * y.d) / (1 - (space * x.d * y.d)) )
        */
        var logSpXdYd = logSpace + logXd + logYd;
        //assert(logSpXdYd < 0);
        var logN = logSpace + (2 * logYd) - Math.log(1 - Math.exp(logSpXdYd));
        var N = Math.exp(logN);
        if (isFinite(N))
            N = fn.exact(Math.ceil(N));
        else {
            var log10N = logN / Math.LN10;
            var exp = Math.floor(log10N);
            N = sn("#e" + Math.exp(exp - log10N) + "e" + exp);
        }

        //assert(fn[">="](N, "1"));
        var midN = fn["+"](fn["*"](N, x.n), y.n);
        var midD = fn["+"](fn["*"](N, x.d), y.d);
        var mid = CF({n:midN, d:midD});
        //print("mid=" + mid);

        var ySide, xSide;

        if (bound === undefined) {
            ySide = between(y, mid, !xgty);
            xSide = between(x, mid, xgty);
        }
        else {
            var midSn = fn["/"](midN, midD);
            //print("midSn=" + midSn + ", bound=" + bound + ", " + boundIsUpper);
            if (fn[boundIsUpper ? ">" : "<"](midSn, bound)) {
                //print("range does not include mid, xgty=" + xgty);
                return (boundIsUpper === xgty ?
                        between(y, mid, !xgty, bound, boundIsUpper) :
                        between(x, mid, xgty, bound, boundIsUpper))
            }
            if (boundIsUpper === xgty) {
                ySide = between(y, mid, !xgty);
                xSide = between(x, mid, xgty, bound, boundIsUpper);
            }
            else {
                ySide = between(y, mid, !xgty, bound, boundIsUpper);
                xSide = between(x, mid, xgty);
            }
        }
        return (xgty ?
                ySide.concat([mid]).concat(xSide) :
                xSide.concat([mid]).concat(ySide));
    }

    //print("mid=" + mid);
    return (between(bottom, mid, false, low, false)
            .concat([mid])
            .concat(between(top, mid, true, high, true)));
}

// Return the nearest fraction to *f* that is simpler than *f* and
// greater than *f* (if *higher* is true) or less than *f* (if
// *higher* is false).  Positive and negative infinity are the
// simplest of all, having denominator zero.
function simpler(f, higher) {
    var c, l = f.l;
    if (f.l == 1) {  // integer
        if ((higher ? 1 : -1) * f.c[0] >= 0)
            return (higher ? INF : M_INF);
        c = [fn[higher ? "+" : "-"](f.c[0], "1"), null];
    }
    else if ((f.l & 1) ^ higher) {
        if (fn["="](f.c[0], "2")) {
            c = [fn["+"](f.c[1][0], "1"), f.c[1][1]];
            l--;
        }
        else
            c = [fn["-"](f.c[0], "1"), f.c[1]];
    }
    else {
        if (fn["="](f.c[1][0], "1") && f.l > 2) {
            c = [fn["+"](f.c[1][1][0], "1"), f.c[1][1][1]];
            l += 2;
        }
        else  {
            c = f.c[1];
            l++;
        }
    }

    var n = sn("1");
    var d = sn("0");
    var i;

    for (i = c; i != null; i = i[1]) {
        // Set n/d = cf[len] + d/n = ((n*cf[len])+d)/n.
        var tmp = n;
        n = fn["+"](fn["*"](n, i[0]), d);
        d = tmp;
    }
    return CF({n:n, d:d, c:c, l:l});
}
