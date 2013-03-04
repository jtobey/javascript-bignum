/*  SVG scrollable, zoomable number line.

    Zoom out to a googol, and you can zoom in until the 100-digit
    numbers are consecutive.  Zoom in to see all the fractions.

    This file is number-line.js.  It requires biginteger.js and
    schemeNumber.js from javascript-bignum
    (https://github.com/jtobey/javascript-bignum).

    See number-line.svg in this directory for usage.

    Copyright (c) 2011 John Tobey <jtobey@john-edwin-tobey.org>
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

function attrProperty(object, property, node, ns, attr, deser, ser, dflt) {
    function handle_DOMAttrModified(evt) {
        var attrVal = node.getAttributeNS(ns, attr);
        if (attrVal == null || attrVal == "")
            attrVal = dflt;
        object[property] = deser(attrVal);
    }
    function set(value) {
        node.setAttributeNS(ns, attr, ser(value));
    }
    handle_DOMAttrModified(null);
    node.addEventListener("DOMAttrModified", handle_DOMAttrModified, false);
    object["set" + property[0].toUpperCase() + property.substring(1)] = set;
}

function NL(args) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(args);
    this._drawables = [];
    this._node = args.node || args;
    this._toDo = [];
    this.stats = {};
    var dim = this.getDimensions();
    this.width = dim[0];
    this.height = dim[1];

    attrProperty(this, "loBound", this._node, NL_NS, "low-bound", sn, ns, "0");
    attrProperty(this, "length", this._node, NL_NS, "length", sn, ns, "2");
    attrProperty(this, "xshift", this._node, NL_NS, "dx", Number, String, "0");
    attrProperty(this, "workTimeslice", this._node, NL_NS, "work-timeslice",
                 Number, String, 100);
    attrProperty(this, "restTimeslice", this._node, NL_NS, "work-timeslice",
                 Number, String, 100);

    var elts = this._node.getElementsByTagNameNS(NL_NS, '*');
    for (var i = 0; i < elts.length; i++) {
        var node = elts.item(i);
        var constructor = null;
        switch (node.localName) {
        case "fractions":      constructor = Fractions;     break;
        case "line":           constructor = Line;          break;
        case "decimals":       constructor = Decimals;      break;
        }
        if (constructor) {
            var drawable = constructor(node);
            if (drawable)
                this.addDrawable(drawable, node);
        }
    }
    this.activate(args.windowTimers || window);
}
NL.Number = sn;
NL.ns = NL_NS;
NL.WHICH_MATH = WHICH_MATH;

NL.prototype = {
    dragging       : false,
    dragPos        : undefined,
    dragX          : undefined,
    dragged        : false,

    getDimensions  : NL_getDimensions,
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

function NL_getDimensions() {
    var nl = this;
    if (!nl._bbox) {
        nl._bbox = nl._node.ownerDocument.createElementNS(SVG_NS, "rect");
        nl._bbox.setAttributeNS(null, "width", "100%");
        nl._bbox.setAttributeNS(null, "height", "100%");
        nl._bbox.setAttributeNS(null, "opacity", "0");
        nl._node.appendChild(nl._bbox);
    }
    var bbox = nl._bbox.getBBox();
    return [bbox.width, bbox.height];
}

function NL_addDrawable(drawable, node) {
    var group = node.previousSibling;
    if (group == null || !group.getAttributeNS ||
        group.getAttributeNS(NL_NS, "drawn") != "true")
    {
        group = this._node.ownerDocument.createElementNS(SVG_NS, "g");
        group.setAttributeNS(NL_NS, "drawn", "true");
        node.parentNode.insertBefore(group, node);
    }
    this._drawables.push({drawable:drawable, group:group});
}

function NL_removeDrawable(drawable) {
    for (var i = 0; i < this._drawables.length; i++)
        if (this._drawables[i].drawable === drawable) {
            drawable.destroy();
            this._drawables[i].group.parentNode
                .removeChild(this._drawables[i].group);
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
    return this.nl._node.ownerDocument.createElementNS(SVG_NS, name);
};
DC.prototype.createTextNode = function(text) {
    return this.nl._node.ownerDocument.createTextNode(text);
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
    nl.setLoBound(loBound);
    nl.setLength(length);
    nl.setXshift(xshift);
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
    var dim = this.getDimensions();
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
        try {
            this._toDo.shift()();
        }
        catch (e) {
            //alert("Caught exception: " + e);
        }
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
    dc.erase();
    //alert("AbstractDrawable.beginPan");
    return this.beginDraw(dc);
};
AbstractDrawable.prototype.beginZoom = AbstractDrawable.prototype.beginPan;
AbstractDrawable.prototype.beginResize = AbstractDrawable.prototype.beginPan;
AbstractDrawable.prototype.destroy = function() {};

var events = ['SVGResize', 'mousedown', 'mouseup', 'click', 'mousemove',
              'DOMMouseScroll', 'mousewheel'];

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
    function listen(name) {
        nl._listeners[name] = makeHandler(name);
        nl._node.addEventListener(name, nl._listeners[name], false);
    }

    nl.beginDraw();
    events.forEach(listen);
    // Resize ineffective in Firefox.  Am I doing it wrong?
    try {
        window.addEventListener("resize", nl._listeners.SVGResize, false);
    } catch(e) {}
    nl.work();
};

NL.prototype.deactivate = function() {
    function unlisten(name) {
        nl._node.removeEventListener(name, nl._listeners[name], false);
    }
    if (this._listeners) {
        events.forEach(unlisten);
        try {
            window.removeEventListener("resize", nl._listeners.SVGResize,
                                       false);
        } catch(e) {}
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
    var ret = "";
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

NL.prototype.handle_mousewheel = function(evt) {
    this.log("mousewheel", evt);
    var movePos = fn["/"](fn["*"](fn.exact(evt.detail), this.length), "-3600");
    this.beginPan(movePos, 0);
    this.returnFromEvent();
};

NL.prototype.handle_DOMMouseScroll = function(evt) {
    this.log("mousewheel", evt);
    if (evt.axis === undefined || evt.axis === evt.VERTICAL_AXIS) {
        var movePos = fn["/"](fn["*"](fn.exact(evt.detail), this.length),
                              THIRTY);
        this.beginPan(movePos, 0);
        this.returnFromEvent();
    }
};

NL.prototype.handle_SVGResize = function(evt) {
    this.log("resize", evt);
    this.beginResize();
    this.returnFromEvent();
};

return NL;
})();

function Line(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);
    this._node = node;
};
Line.prototype = new NumberLine.AbstractDrawable();

Line.prototype.beginDraw = function(dc) {
    var node = this._node;
    var x = +(node.getAttributeNS(null, "x") || 0) + dc.nl.xshift;
    dc.erase();

    var i, attr, map = node.attributes;
    var line = dc.createSvgElt("line");

    for (i = 0; i < map.length; i++) {
        var attr = map[i];
        line.setAttributeNS(attr.namespaceURI, attr.localName, attr.value);
    }

    line.setAttributeNS(null, "x1", x);
    line.setAttributeNS(null, "y1", 0);
    line.setAttributeNS(null, "x2", x);
    line.setAttributeNS(null, "y1", dc.nl.height);

    dc.out(line);
};

var Fractions = (function() {

var sn = NumberLine.Number;
var fn = sn.fn;
var ns = fn["number->string"];

function Fractions(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);
    this._node = node;
}
Fractions.prototype = new NumberLine.AbstractDrawable();

Fractions.prototype.beginDraw = function(dc) {
    var node = this._node;
    var minScale = +(node.getAttributeNS(null, "min-scale") || 1.0);
    var maxScale = +(node.getAttributeNS(null, "max-scale") || 8.0);
    var spacing = +(node.getAttributeNS(null, "line-spacing") || 12.0);
    var littleOpacity = node.getAttributeNS(null, "little-opacity") || 0.2;
    var x = +(node.getAttributeNS(null, "x") || 0) + dc.nl.xshift;

    var heightInLines = dc.nl.height / spacing;
    var list = getFractions(dc.nl.loBound, dc.nl.length,
                            Math.floor(heightInLines));

    var logLen = fn.log(dc.nl.length);
    var logBigDenom = (Math.log(heightInLines) - logLen) / 2;

    dc.erase();  // XXX Start stupid, optimize later.

    while (true) {
        var fract = list.shift();
        if (!fract)
            break;

        // TODO: optimize.
        var value = fn["/"](fract.n, fract.d);
        var y = dc.nl.height * (1 - fn["/"](fn["-"](value, dc.nl.loBound),
                                            dc.nl.length));

        var opacity = 1;
        var scale = minScale;
        var logD = fract.logD();
        if (logD > logBigDenom) {
            if (logBigDenom > 0)  // Integers are always little-denom.
                opacity = littleOpacity;
        }
        else {
            scale *= Math.exp((logBigDenom - logD) / 4);
            if (scale > maxScale) {
                scale = maxScale;
            }
        }

        var g = dc.createSvgElt("g");
        g.setAttributeNS(null, "transform", "translate(" + x + "," + y +
                         "),scale(" + scale + ")");
        g.setAttributeNS(null, "fill-opacity", opacity);

        for (var child = node.firstChild; child != null;
             child = child.nextSibling) {
            g.appendChild(child.cloneNode(true));
        }

        var nodeList = g.getElementsByTagNameNS(NumberLine.ns, "output");
        var elt, i, text = null;
        for (i = 0; (elt = nodeList[i]) != null; i++) {
            if (text == null)
                text = pos2text(value);
            elt.parentNode.replaceChild(dc.createTextNode(text), elt);
        }
        dc.out(g);
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
    if (this.c !== undefined)
        return this.c;
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
        if (NumberLine.WHICH_MATH === "native" && q < 1e-10) {
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
    //alert("getFractions(" + ns(low) + "," + ns(len) + "," + count + ")");
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
                var midToBound = fn.abs(fn["-"](midSn, bound));
                var logMidToBound = fn.log(midToBound);
                var q = (boundIsUpper === xgty ? y : x);
                var logQd = q.logD();
                var logMidD = mid.logD();
                /*
                   Find largest N such that z = {n:N*q.n+mid.n, d:N*q.d+mid.d}
                   differs from mid by at most exp(logMidToBound).
                */
                logSpXdYd = logMidToBound + logQd + logMidD;
                logN = logMidToBound + (2 * logMidD) - Math.log(1 - Math.exp(logSpXdYd));
                if (isFinite(logN)) {
                    N = Math.exp(logN);
                    if (isFinite(N))
                        N = fn.exact(Math.floor(N));
                    else {
                        log10N = logN / Math.LN10;
                        exp = Math.floor(log10N);
                        N = sn("#e" + Math.exp(exp - log10N - 1e-17)
                               + "e" + exp);
                    }
                    midN = fn["+"](fn["*"](N, q.n), mid.n);
                    midD = fn["+"](fn["*"](N, q.d), mid.d);
                    mid = CF({n:midN, d:midD});
                    //print("new mid=" + mid);
                }
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

//this.getFractions = getFractions; // testing
return Fractions;
})();

var Decimals = (function() {

var sn = NumberLine.Number;
var fn = sn.fn;
var ns = fn["number->string"];

function D(node) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(node);
    this._node = node;
}
D.prototype = new NumberLine.AbstractDrawable();

D.prototype.beginDraw = function(dc) {
    var node = this._node;
    var minScale = +(node.getAttributeNS(null, "min-scale") || 1.0);
    var maxScale = +(node.getAttributeNS(null, "max-scale") || 8.0);
    var scale5 = +(node.getAttributeNS(null, "scale-5") || 1.2);
    var scale10 = +(node.getAttributeNS(null, "scale-10") || 1.6);
    var numberSpacing = +(node.getAttributeNS(null, "line-spacing") || 20.0);
    var markSpacing = +(node.getAttributeNS(null, "mark-spacing") || 3.0);
    var x = +(node.getAttributeNS(null, "x") || 0) + dc.nl.xshift;

    var heightInMarks = dc.nl.height / markSpacing;
    var list = getDecimals(dc.nl.loBound, dc.nl.length,
                           Math.floor(heightInMarks));

    var logLen = fn.log(dc.nl.length);
    var logPixelLen = logLen - Math.log(dc.nl.height);
    var logMarkSpace = logPixelLen + Math.log(markSpacing);
    var minTextScale = minScale * Math.pow(scale10, Math.ceil(Math.log(numberSpacing / markSpacing) / Math.LN10));

    dc.erase();  // XXX Start stupid, optimize later.

    while (true) {
        var num = list.shift();
        if (!num)
            break;

        // TODO: optimize.
        var value = sn("#e" + num.m + "e" + num.e);
        var y = dc.nl.height * (1 - fn["/"](fn["-"](value, dc.nl.loBound),
                                            dc.nl.length));

        var scale = minScale;
        scale *= Math.pow(scale10, num.e - logMarkSpace / Math.LN10);
        if (num.m[num.m.length - 1] == '5')
            scale *= scale5;
        if (scale > maxScale || num.m == "0")
            scale = maxScale;

        var g = dc.createSvgElt("g");
        g.setAttributeNS(null, "transform", "translate(" + x + "," + y +
                         "),scale(" + scale + ")");

        for (var child = node.firstChild; child != null;
             child = child.nextSibling) {
            g.appendChild(child.cloneNode(true));
        }

        var nodeList = g.getElementsByTagNameNS(NumberLine.ns, "output");
        var elt, i, text = null;
        for (i = 0; (elt = nodeList[i]) != null; i++) {
            if (text == null)
                text = num2text(num);
            if (scale < minTextScale)
                elt.parentNode.removeChild(elt);
            else
                elt.parentNode.replaceChild(dc.createTextNode(text), elt);
        }
        dc.out(g);
    }
};

function num2text(num) {
    var s = "";
    var m = num.m;
    var e = num.e;

    if (num.m[0] == '-') {
        m = m.substring(1);
        s = "-";
    }
    if (e < 0) {
        while (m.length <= -e)
            m = "0" + m;
        m = m.substring(0, m.length + e) + "." + m.substring(m.length + e);
    }
    if (m != 0) {
        while (e > 0) {
            m += "0";
            e--;
        }
    }
    return s + m;
}

function getDecimals(low, len, count) {
    var logSpace = fn.log(len) - Math.log(count);

    // Number of digits after the decimal point:
    var numDigits = Math.floor(-logSpace / Math.LN10);
    var p10 = fn.expt("10", fn.exact(numDigits));
    var x = fn.ceiling(fn["*"](low, p10));
    var end = fn["*"](fn["+"](low, len), p10);
    var s, m, e, mLen, ret = [];

    for (; fn["<="](x, end); x = fn["+"](x, "1")) {
        if (fn["negative?"](x)) {
            m = ns(fn.abs(x));
            s = "-";
        }
        else {
            m = ns(x);
            s = "";
        }
        e = -numDigits;
        for (mLen = m.length; mLen > 1 && m[mLen-1] == '0'; mLen--)
            e++;
        if (mLen != m.length)
            m = m.substring(0, mLen);
        if (m == "0")
            e = 0;

        ret.push({ e:e, m: s+m });
    }
    return ret;
}

return D;
})();
