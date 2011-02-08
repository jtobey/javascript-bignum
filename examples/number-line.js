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
var makePos, pos2text, valueOf, add, subtract, multiply, divide, div;
var isZero, le, lt, gt, trimPos;
var WHICH_MATH = "Scheme";

if (WHICH_MATH === "Scheme") {
    var sf = SchemeNumber.fn;
    exact    = sf.exact;
    pos2text = sf["number->string"];
    add      = sf["+"];
    subtract = sf["-"];
    multiply = sf["*"];
    divide   = sf["/"];
    div      = sf.div;
    isZero   = sf["zero?"];
    le       = sf["<="];
    gt       = sf[">"];
    lt       = sf["<"];

    trimPos = function(pos, len, h) {
        // Return pos, to within a pixel, simplified.
        if (sf["integer?"](pos))
            return pos;
        var d = Math.ceil(h / len);
        if (d < 1)
            d = 1;
        if (le(sf.denominator(pos), d))
            return pos;
        d = exact(d);
        return divide(sf.round(multiply(pos, d)), d);
    };
}
else {  // Just native math, no schemeNumber.js or biginteger.js needed.
    exact    = Number;
    pos2text = String;
    add      = function(x, y) { return x + y; };
    subtract = function(x, y) { return x - y; };
    multiply = function(x, y) { return x * y; };
    divide   = function(x, y) { return x / y; };
    div = function(x, y) {
        return Math.floor(x / y);
    };
    isZero   = function(x)    { return x == 0; };
    le       = function(x, y) { return x <= y; };
    lt       = function(x, y) { return x < y; };
    gt       = function(x, y) { return x > y; };
    trimPos  = function(pos, len, h) { return pos; };
}

var svgNS = "http://www.w3.org/2000/svg";
var xlinkNS = "http://www.w3.org/1999/xlink";
var loBound = exact(0);
var length = exact(10);
var xshift = 0;
var textSize = 0.5;
var minIntTextPixels = 12.5;
var maxTextPixels = 96;
var dragging = false;
var dragPos;
var dragX;
var dragged = false;
var THIRTY = exact(30);
var HALF = exact(0.5);
var TWO = exact(2);
var ONE = exact(1);
var stats = new Object();
var gobbling = false;

function init(svg) {
    window.addEventListener('mousedown', mousedown, true);
    window.addEventListener('mouseup', mouseup, true);
    window.addEventListener('click', click, true);
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('DOMMouseScroll', mousescroll, true); // XXX firefox
    window.addEventListener('resize', function() { redraw(svg); }, false);
    draw(svg);
}

function getSvgHeight(svg) {
    if (svg.getComputedStyle)  // UNTESTED.
        return svg.getComputedStyle(svg, null).getPropertyValue("height");
    //return svg.height.baseVal.value;
    //var rect = svg.getBoundingClientRect(); return rect.bottom - rect.top;
    return svg.ownerDocument.defaultView.innerHeight;  // XXX firefox only
}

function draw(svg) {
    var doc = svg.ownerDocument;
    var hpx = getSvgHeight(svg);
    var i, x, y, rise, text, mark, intPixels, step, intTextPixels;
    var opacity, rect, count = 0;
    var hiBound = add(loBound, length);

    intPixels = divide(exact(hpx), length);
    step = add(div(exact(minIntTextPixels), intPixels), ONE);
    intTextPixels = textSize * intPixels;
    if (intTextPixels < minIntTextPixels)
        intTextPixels = minIntTextPixels;
    if (intTextPixels > maxTextPixels)
        intTextPixels = maxTextPixels;
    i = multiply(step, div(loBound, step));
    var limit = 3 * hpx / intTextPixels;
    for (; le(i, hiBound); i = add(i, step)) {
        if (count++ > limit) {
            alert("The numbers are getting too big! " +
                  [count, hpx, intTextPixels, pos2text(i)]);
            return;
        }
        y = hpx - multiply(subtract(i, loBound), intPixels);
        x = 2 * intTextPixels + xshift;
        rise = 0.2 * intTextPixels;
        opacity = 0.5;

        if (!doc.createElementNS) {
            print([i, xshift,x,y,rise]);
            continue;
        }
        mark = doc.createElementNS(svgNS, "polygon");
        mark.setAttributeNS(null, "fill-opacity", opacity);
        mark.setAttributeNS(null, "points", "" + xshift + "," + y +
                            " " + x + "," +
                            (y-rise) + " " + x + "," + (y+rise));
        svg.appendChild(mark);

        text = doc.createElementNS(svgNS, "text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "dominant-baseline", "middle");
        text.setAttributeNS(null, "font-size", intTextPixels);
        text.setAttributeNS(null, "fill-opacity", opacity);
        text.appendChild(doc.createTextNode(pos2text(i)));
        svg.appendChild(text);

        rect = doc.createElementNS(svgNS, "rect");
        rect.setAttributeNS(null, "x", 0);
        rect.setAttributeNS(null, "y", 0);
        rect.setAttributeNS(null, "width", xshift);
        rect.setAttributeNS(null, "height", hpx);
        svg.appendChild(rect);
    }
}
function clear(svg) {
    var elt, prev;
    prev = svg.firstChild;
    elt = prev.nextSibling;
    while (elt != null) {
        if (elt.nodeName != "script") {
            svg.removeChild(elt);
        }
        else {
            prev = elt;
        }
        elt = prev.nextSibling;
    }
}

var redrawCount = 0;
var redrawTime = 0;
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

function evt2svg(evt) {
    var svg = evt.target;
    while (svg.nodeName != "svg") {
        svg = svg.parentNode;
        if (svg == null) {
            alert("oops, no svg ancestor of " + evt.target.nodeName);
            return null;
        }
    }
    return svg;
}
function evt2pos(evt, h) {
    h = h || getSvgHeight(evt2svg(evt));
    var y = evt.clientY;
    return add(loBound, divide(multiply(exact(h - y), length), exact(h)));
}
function mousedown(evt) {
    log("mousedown", evt);
    dragging = true;
    dragPos = evt2pos(evt);
    dragX = evt.clientX;
}
function doDrag(svg, movePos, moveX) {
    loBound = subtract(loBound, movePos);
    loBound = trimPos(loBound, length, getSvgHeight(svg));
    xshift += moveX;
    redraw(svg);  // XXX Could move all elements instead.
}

function handleDragEvent(evt) {
    var svg = evt2svg(evt);
    var movePos = subtract(evt2pos(evt, getSvgHeight(svg)), dragPos);
    var moveX = evt.clientX - dragX;
    //dragging=false;alert("movePos " + movePos.debug());
    if (!isZero(movePos) || moveX) {
        doDrag(svg, movePos, moveX);
        dragX = evt.clientX;
        dragged = true;
    }
}

function mousemove(evt) {
    log("mousemove", evt);
    if (dragging)
        handleDragEvent(evt);
}
function mouseup(evt) {
    log("mouseup", evt);
    if (dragging) {
        handleDragEvent(evt);
        dragging = false;
    }
}
function click(evt) {
    log("click", evt);
    if (evt.shiftKey)
        alert(statistics());

    if (dragged || evt.shiftKey) {
        dragged = false;
        return;
    }
    var zoomFactor = TWO;
    if (evt.button == 2 || evt.button == 1 || evt.ctrlKey) {
        zoomFactor = HALF;
    }
    var svg = evt2svg(evt);
    var h = getSvgHeight(svg);
    var pos = evt2pos(evt, h);
    length = multiply(zoomFactor, length);
    loBound = add(pos, multiply(zoomFactor, subtract(loBound, pos)));
    loBound = trimPos(loBound, length, h);
    redraw(svg);
}
function mousescroll(evt) {
    log("mousescroll", evt);
    if (evt.axis === evt.VERTICAL_AXIS) {
        //alert("mousescroll vertical: " + evt.detail);
        var svg = evt2svg(evt);
        doDrag(svg, divide(multiply(exact(evt.detail), length), THIRTY), 0);
    }
}

function log(name, evt) {
    if (!stats[name])
        stats[name] = 0;
    stats[name]++;
}

function statistics() {
    var ret = "NUMBER LINE STATISTICS:\n";
    ret += "redraws: " + redrawCount + " avg " +
        (redrawTime / redrawCount / 1000).toFixed(3) + "s\n";
    ret += "redrawTime: " + redrawTime + "\n";
    ret += "loBound=" + loBound.SN_debug() + "\n";
    ret += "length=" + length.SN_debug() + "\n";
    var keys = []; for (var k in stats) keys.push(k);
    keys.sort().forEach(function(k) {
            ret += k + "=" + stats[k] + "\n";
        });
    return ret;
}
