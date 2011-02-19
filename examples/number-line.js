/*  SVG scrollable, zoomable number line.

    Zoom out to a googol, and you can zoom in until the 100-digit
    numbers are consecutive.  Zoom in to see all the fractions.

    This file is number-line.js.  It requires biginteger.js and
    schemeNumber.js from javascript-bignum
    (https://github.com/jtobey/javascript-bignum).

    See number-line.svg in this directory for usage.

    Copyright (c) 2011 John Tobey <John.Tobey@gmail.com>
 */

var NumberLine = (function() {

// Arithmetic abstraction.
var WHICH_MATH;
if (typeof SchemeNumber == "undefined")
    WHICH_MATH = "native";
else
    WHICH_MATH = "Scheme";

var sn, trimPos;

if (WHICH_MATH === "native") {
    alert("NumberLine: Using native math.  This is not well tested.");
    sn = function(s) { return Number(eval(s)); }
    sn.fn = {
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
    trimPos  = function(pos, len, h) { return pos; };
}
else {
    sn = SchemeNumber;

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

var fn = sn.fn;
var ns = fn["number->string"];

var SVG_NS = "http://www.w3.org/2000/svg";
var NL_NS = "http://john-edwin-tobey.org/number-line";
var THIRTY = sn("30");
var HALF = sn("1/2");
var TWO = sn("2");

function removeAllChildren(node) {
    while (node.firstChild != null)
        node.removeChild(node.firstChild);
}

// Please tell <John.Tobey@gmail.com> if you know a reasonable way to
// get the <svg> dimensions in pixels!
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
    this._toDo = [];
    this.stats = {};
    this.updateDimensions();

    var elts = this._svg.getElementsByTagNameNS(NL_NS, '*');
    for (var i = 0; i < elts.length; i++) {
        var node = elts.item(i);
        var constructor = null;
        switch (node.localName) {
        case "fillHalf":       constructor = FillHalf;      break;
        case "fillTimeSince":  constructor = FillTimeSince; break;
        case "fractions":      constructor = Fractions;     break;
        }
        if (constructor) {
            var drawable = constructor(node);
            if (drawable)
                this.addDrawable(drawable);
        }
    }
    this.activate(args.windowTimers);
}
NL.Number = sn;
NL.ns = NL_NS;

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

    updateDimensions : NL_updateDimensions,
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

function NL_updateDimensions() {
    var dim = getSvgPixelDimensions(this._svg);
    this.width = dim[0];
    this.height = dim[1];
}

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
NL.AbstractDrawable = AbstractDrawable;
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

var captureEvents = ['mousedown', 'mouseup', 'click', 'mousemove',
                     'DOMMouseScroll'];
var bubbleEvents = ['resize'];

NL.prototype.activate = function(windowTimers) {
    var nl = this;
    nl.setTimeout   = windowTimers.setTimeout;
    nl.clearTimeout = windowTimers.clearTimeout;
    nl._listeners = {};

    function makeHandler(name) {
        var methodName = "handle_" + name;
        function handle(evt) {
            nl[methodName](evt);
        }
        return handle;
    }
    function doCapture(name) {
        nl._listeners[name] = makeHandler(name);
        nl._svg.addEventListener(name, nl._listeners[name], true);
    }
    function doBubble(name) {
        nl._listeners[name] = makeHandler(name);
        nl._svg.addEventListener(name, nl._listeners[name], false);
    }

    nl.beginDraw();
    captureEvents.forEach(doCapture);
    bubbleEvents.forEach(doBubble);
    nl.work();
};

NL.prototype.deactivate = function() {
    function doCapture(name) {
        nl._svg.removeEventListener(name, nl._listeners[name], true);
    }
    function doBubble(name) {
        nl._svg.removeEventListener(name, nl._listeners[name], false);
    }
    if (this._listeners) {
        captureEvents.forEach(doCapture);
        bubbleEvents.forEach(doBubble);
    }
};

NL.prototype.evt2pos = function(evt) {
    var y = evt.clientY;
    return fn["+"](this.loBound, fn["/"](fn["*"](fn.exact(this.height - y),
                                                 this.length),
                                         fn.exact(this.height)));
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

NL.prototype.handle_click = function(evt) {
    this.log("click", evt);
    if (evt.shiftKey)
        alert(this.statistics());

    if (this.dragged || evt.shiftKey || evt.button == 2) {
        this.dragged = false;
        return;
    }
    var zoomFactor = HALF;
    if (evt.button == 1 || evt.ctrlKey) {
        zoomFactor = TWO;
    }
    this.beginZoom(zoomFactor, this.evt2pos(evt));
    this.returnFromEvent();
};

NL.prototype.statistics = function() {
    alert("statistics");
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

NL.prototype.handle_mousedown = function(evt) {
    this.log("mousedown", evt);
    this.dragging = true;
    this.dragPos = this.evt2pos(evt);
    this.dragX = evt.clientX;
};
NL.prototype.handle_mousemove = function(evt) {
    this.log("mousemove", evt);
    if (this.dragging)
        this.handleDragEvent(evt);
};
NL.prototype.handle_mouseup = function(evt) {
    this.log("mouseup", evt);
    if (this.dragging) {
        this.handleDragEvent(evt);
        this.dragging = false;
    }
};

NL.prototype.handleDragEvent = function(evt) {
    var movePos = fn["-"](this.evt2pos(evt), this.dragPos);
    var moveX = evt.clientX - this.dragX;
    //dragging=false;alert("movePos " + movePos.debug());
    if (!fn["zero?"](movePos) || moveX) {
        this.beginPan(movePos, moveX);
        this.dragX = evt.clientX;
        this.dragged = true;
        this.returnFromEvent();
    }
}

NL.prototype.handle_DOMMouseScroll = function(evt) {
    this.log("mousescroll", evt);
    if (evt.axis === evt.VERTICAL_AXIS) {
        //alert("mousescroll vertical: " + evt.detail);
        var movePos = fn["/"](fn["*"](fn.exact(evt.detail), this.length),
                              THIRTY);
        this.beginPan(movePos, 0);
        this.returnFromEvent();
    }
};

return NL;
})();

var FillTimeSince = (function() {

function FTS(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);

    // XXX Should validate params.
    var unit = node.getAttributeNS(NumberLine.ns, "unit") || "minute";
    this._ms = 1000;
    switch (unit) {
    case "year":   case "years":   this._ms *= 365.2425;
    case "day":    case "days":    this._ms *= 24;
    case "hour":   case "hours":   this._ms *= 60;
    case "minute": case "minutes": this._ms *= 60;
    case "second": case "seconds":
        break;
    default: this._ms = unit;
    }
    this._time = +(node.getAttributeNS(NumberLine.ns, "time") || new Date());
    if (node.hasAttributeNS(null, "fill"))
        this._fill = node.getAttributeNS(null, "fill");
    if (node.hasAttributeNS(null, "fill-opacity"))
        this._opacity = +node.getAttributeNS(null, "fill-opacity");
}
FTS.prototype = new NumberLine.AbstractDrawable();

var fn = NumberLine.Number.fn;

FTS.prototype.beginDraw = function(dc) {
    var fts = this;
    var group = dc.g;
    var nl = dc.nl;
    var lo, len, hi;

    function advance() {
        if (nl.loBound !== fts.loBound || nl.length !== fts.length) {
            fts.loBound = nl.loBound;
            fts.length  = nl.length;
            lo  = fn.inexact(fts.loBound);
            len = fn.inexact(fts.length);
            hi  = fn.inexact(fn["+"](fts.loBound, fts.length));
        }
        if (hi <= 0) {
            //alert("advance: nothing to do! lo="+lo+",len="+len);
            dc.erase();
            return;
        }

        var yearsSince = (new Date() - fts._time) / fts._ms;
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
            var rect = fts._rect;
            if (!rect) {
                rect = dc.createSvgElt("rect");
                if (fts._opacity != null)
                    rect.setAttributeNS(null, "fill-opacity", fts._opacity);
                if (fts._fill != null)
                    rect.setAttributeNS(null, "fill", fts._fill);
            }
            rect.setAttributeNS(null, "x", 0);
            rect.setAttributeNS(null, "width", nl.width);
            rect.setAttributeNS(null, "y", rectTop);
            rect.setAttributeNS(null, "height", rectBottom - rectTop);
            //alert("set y="+rectTop+"; fill="+rect.getAttributeNS(null, "fill"));
            if (!fts._rect) {
                fts._rect = rect;
                //dc.out(rect);
                group.appendChild(rect);
            }
        }

        if (rectTop > 0) {
            var waitYears = len / nl.height / 10;  // 0.1 pixel
            var yearsToLo = lo - yearsSince;
            if (yearsToLo > 0)
                waitYears = yearsToLo;
            var waitTime = waitYears * fts._ms;
            if (waitTime < nl.restTimeslice)
                waitTime = nl.restTimeslice;
            //alert("waitTime=" + waitTime);
            fts._timeout = window.setTimeout(advance, waitTime);
        }
    }

    fts.stopDraw();
    //dc.erase();  // XXX
    advance();
};

FTS.prototype.stopDraw = function() {
    if (this._timeout) {
        window.clearTimeout(this._timeout);
        this._timeout = null;
    }
};

FTS.prototype.destroy = function() {
    this.stopDraw();
};

return FTS;
})();

function FillHalf(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);

    // XXX Should validate params.
    this._x = +(node.getAttributeNS(null, "x") || 0);
    if (node.hasAttributeNS(null, "fill"))
        this._fill = node.getAttributeNS(null, "fill");
    this._half = node.getAttributeNS(NumberLine.ns, "half") || "left";
};
FillHalf.prototype = new NumberLine.AbstractDrawable();

FillHalf.prototype.beginDraw = function(dc) {
    dc.erase();
    if (this._half == "right")
        alert("fillHalf: Sorry, only left halves are implemented");
    if (dc.nl.xshift > -this._x) {
        rect = dc.createSvgElt("rect");
        rect.setAttributeNS(null, "x", 0);
        rect.setAttributeNS(null, "y", 0);
        if (this._fill != null)
            rect.setAttributeNS(null, "fill", this._fill);
        rect.setAttributeNS(null, "width", dc.nl.xshift + this._x);
        rect.setAttributeNS(null, "height", dc.nl.height);
        dc.out(rect);
    }
};

var Fractions = (function() {

var sn = NumberLine.Number;
var fn = sn.fn;
var ns = fn["number->string"];

function Fractions(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);

    // XXX Should validate params.
    this.minTextPixels = +(node.getAttributeNS(NumberLine.ns, "minTextPixels")
                           || 12.5);
    this.maxTextPixels = +(node.getAttributeNS(NumberLine.ns, "maxTextPixels")
                           || 96);
}
Fractions.prototype = new NumberLine.AbstractDrawable();

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

return Fractions;

})();
