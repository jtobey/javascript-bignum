/* Copyright(C) 2013 John Tobey <jtobey@john-edwin-tobey.org>

   Let the user specify a Moebius transformation by mouse actions.
   Draw transformed shapes.
 */

"use strict";

var SVG_NS = "http://www.w3.org/2000/svg";
var MOEBIUS_NS = "http://john-edwin-tobey.org/moebius";

function Moebius(args) {
    if (args) {
        var type;
        if (args instanceof SVGSVGElement) type = "svg";
        else if (args.svg) return new SvgMoebius(args);
        else if (args.tagName === "svg") type = "svg";
        else if (("" + args.tagName).toLowerCase().indexOf(":svg") > 0)
            type = "svg";
        if (type === "svg") return new SvgMoebius({ svg: args });
        throw "Moebius: must pass svg, not " + args;
    }
}

Moebius.prototype = {};

function updateDimensions(t) {
    var dim = t.getDimensions();
    t.width = dim[0];
    t.height = dim[1];
}

function startWorker(workerScript) {
    try {
        return new Worker(workerScript);
        // XXX Should ask the worker if it's okay.
    }
    catch (e) {
        var errmsg;
        if (typeof Worker !== "function") {
            errmsg = "This browser seems not to support Web Workers.\n";
            errmsg += "Please try a recent version of Firefox or Chrome.";
        }
        else {
            errmsg = "Failed to start worker using " + workerScript + ": " + e;
        }
        // XXX Should report it another way, such as by text in the canvas.
        alert(errmsg);
        throw e;
    }
}

var MoebiusApp;

Moebius.prototype.init = function() {
    var t = this;

    t.app = MoebiusApp;
    updateDimensions(t);

    // XXX Should be configurable via custom tags in <svg>.
    var SIDE = 2.25;
    var SIDE_PIXELS = Math.min(t.width, t.height);
    t.x = -SIDE/2;
    t.y = SIDE * (0.5 - t.height/SIDE_PIXELS);

    t.anchors = [];
    t.redraw();

    var captureEvents = ['mousedown', 'mouseup', 'mousemove', 'dblclick',
                         'SVGResize'];
    var bubbleEvents = [];

    t.drag = new Hover(t);

    var listeners = {};
    function doHandler(name, capture) {
        var methodName = "handle_" + name;
        function handle(evt) {
            t[methodName](evt);
        }
        t.node.addEventListener(name, handle, capture);
        listeners[name] = handle;
    }
    function doCapture(name) { doHandler(name, true); }
    function doBubble(name) { doHandler(name, false); }
    captureEvents.forEach(doCapture);
    bubbleEvents.forEach(doBubble);

    // Work around FF and Chrome quirk.
    try {
        window.addEventListener("resize", listeners.SVGResize, false);
    } catch(e) {}
};

Moebius.prototype.send = function(action, params) {
    var t = this;
    t.seqno++;
    //console.log(">> " + action + ": " + JSON.stringify(params));
    t.worker.postMessage({ action: action, cookie: t.seqno, params: params });
}

function logReceived(event) {
    var msg = event.data, maxlen = 100;
    if (msg.length > maxlen) {
        msg = msg.substr(0, maxlen - 4) + " ...";
    }
    console.log("<< " + msg);
}

Moebius.prototype.handleMessage = function(event) {
    var t = this;
    //logReceived(event);
    t.handleMessageObject(JSON.parse(event.data));
};

Moebius.prototype.handleMessageObject = function(msg) {
    var t = this;
    try {
        if (msg.logmsg !== undefined) {
            console.log("worker: " + msg.logmsg);
        }
        alert('huh? message received');
    }
    catch (e) {
        console.log("Exception in handleMessage: " + e + ": " + event.data);
    }
};

function Anchor() {}

Anchor.prototype = {};

//Anchor.prototype.getLocation = function() { return [0, 0]; };
//Anchor.prototype.contains = function(x, y) { return false; };
//Anchor.prototype.moveToPoint = function(x, y) {};
Anchor.prototype.drop = function() {};

// Returns the anchor at (x,y) or undefined if none.
Moebius.prototype.inAnchor = function(x, y) {
    var t = this, i, anchors = t.anchors;
    for (i = 0; i < anchors.length; i++) {
        if (anchors[i].contains(x, y)) {
            return anchors[i];
        }
    }
    return undefined;
};

Moebius.prototype.invalidate = (function() {
    var NeedsRedraw = false;

    function invalidate() {
        var t = this;
        function redraw() {
            NeedsRedraw = false;
            t.redraw();
        }
        if (!NeedsRedraw) {
            NeedsRedraw = setTimeout(redraw);
        }
    }
    return invalidate;
})();

Moebius.prototype.squeeze = function(x0, y0, x1, y1, anchor1, anchor2) {
    var t = this;
    if (x0 === y0 && x1 === y1) {
        return;
    }
    t.app.map3({ from1: { x: x0, y: y0 },
                 to1:   { x: x1, y: y1 },
                 from2: anchor1,
                 to2:   anchor1,
                 from3: anchor2,
                 to3:   anchor2 });
    t.invalidate();
};

Moebius.prototype.getEventPoint = function(event) {
    return [ event.clientX, y = event.clientY ];  // if only it were so simple
};

Moebius.prototype.removeAnchor = function(anchor) {
    var t = this, anchors = t.anchors, i;
    for (i = 0; i < anchors.length; i++) {
        if (anchors[i] === anchor) {
            anchors.splice(i, 1);
            i--;
        }
    }
};

function Drag() {}

Drag.prototype = {};

// Subclasses override these.
Drag.prototype.drag = function(fromX, fromY, toX, toY) {}
Drag.prototype.drop = function(x, y) {}

Drag.prototype.initDrag = function(graphic, fromX, fromY) {
    var drag = this;
    drag.graphic = graphic;
    drag.start = [fromX, fromY];
};

Drag.prototype.handleDragEvent = function(event) {
    var drag = this, p = drag.graphic.getEventPoint(event);
    drag.maybeDragTo(p);
    return p;
};

Drag.prototype.mousemove = function(event) {
    var drag = this;
    drag.handleDragEvent(event);
};

Drag.prototype.mouseup = function(event) {
    var drag = this, p = drag.handleDragEvent(event);
    drag.drop(p[0], p[1]);
};

Drag.prototype.doDragTo = function(p) {
    var drag = this;
    drag.drag(drag.start[0], drag.start[1], p[0], p[1]);
    drag.start = p;
};

Drag.prototype.maybeDragTo = function(p) {
    var drag = this;
    if (drag.start[0] != p[0] || drag.start[1] != p[1]) {
        drag.doDragTo(p);
    }
};

function Hover(graphic) {
    var hover = this;
    hover.initDrag(graphic, -1, -1);
}

Hover.prototype = new Drag();

Hover.prototype.drag = function(fromX, fromY, toX, toY) {
    var hover = this;
    this.graphic.hover(toX, toY);
};

function SqueezeDrag(graphic, fromX, fromY, anchor1, anchor2) {
    var drag = this;
    drag.initSqueezeDrag(graphic, fromX, fromY, anchor1, anchor2);
}

SqueezeDrag.prototype = new Drag();

SqueezeDrag.prototype.initSqueezeDrag = function(
    graphic, fromX, fromY, anchor1, anchor2) {
    var drag = this;
    drag.initDrag(graphic, fromX, fromY);
    drag.anchor1 = anchor1;
    drag.anchor2 = anchor2;
};

SqueezeDrag.prototype.drag = function(fromX, fromY, toX, toY) {
    var drag = this;
    // XXX Could hold off on multiple squeezes between messages.
    drag.graphic.squeeze(fromX, fromY, toX, toY, drag.anchor1, drag.anchor2);
};

function AnchorDrag(graphic, fromX, fromY, anchor) {
    var drag = this;
    drag.initDrag(graphic, fromX, fromY);
    drag.anchor = anchor;
}

AnchorDrag.prototype = new Drag();

AnchorDrag.prototype.drag = function(fromX, fromY, toX, toY) {
    var drag = this;
    var p = drag.anchor.getLocation();
    drag.anchor.moveToPoint(p.x + toX - fromX, p.y + toY - fromY);
};

AnchorDrag.prototype.drop = function(x, y) {
    var drag = this;
    drag.anchor.drop();
};

Moebius.prototype.handle_mousedown = function(event) {
    var t = this, p = t.getEventPoint(event), x = p[0], y = p[1];

    //if (evt.button == 2 || evt.button == 1 || evt.ctrlKey)

    // Prevent a containing HTML document from letting us drag the
    // SVG "image".
    event.preventDefault();

    var anchor = t.inAnchor(x, y);
    if (anchor) {
        t.drag = new AnchorDrag(t, x, y, anchor);
        return;
    }

    var anchorPoints = [], i, anchor;

    for (i = 0; i < t.anchors.length; i++) {
        anchor = t.anchors[i];
        p = anchor.getLocation();
        if (p === "infinity") {
            continue;
        }
        anchorPoints.push(p);
    };

    switch (anchorPoints.length) {
    case 0:
        t.drag = new SqueezeDrag(t, x, y, "infinity", "infinity");
        break;
    case 1:
        t.drag = new SqueezeDrag(t, x, y, anchorPoints[0], "infinity");
        break;
    case 2:
        t.drag = new SqueezeDrag(t, x, y, anchorPoints[0], anchorPoints[1]);
        break;
    }
};

Moebius.prototype.handle_mousemove = function(event) {
    var t = this;
    t.drag.mousemove(event);
};

Moebius.prototype.handle_mouseup = function(event) {
    var t = this;
    t.drag.mouseup(event);
    t.drag = new Hover(t);
};

Moebius.prototype.handle_dblclick = function(event) {
    var t = this, p = t.getEventPoint(event), x = p[0], y = p[1];
    var anchor = t.inAnchor(x, y);

    if (anchor) {
        t.removeAnchor(anchor);
    }
    else {
        t.createAnchor(x, y);
    }
};

Moebius.prototype.handle_SVGResize = function(evt) {
    var t = this, oy = t.y, oheight = t.height;
    updateDimensions(t);
    t.y = oy + oheight - t.height;
    //alert("resize: " + t.width + "," + t.height);
    t.invalidate();
};

Moebius.prototype.hover = function(x, y) {};

function cloneAllExceptAttrList(fromElt, toElt, exceptAttrs) {
    var attrs = fromElt.attributes, i, attr, child;
    //console.log("cloneToElement " + toElt.localName);
    for (i = 0; i < attrs.length; i++) {
        attr = attrs[i];
        if (exceptAttrs.indexOf(attr.name) !== -1)
            continue;
        //console.log("cloneToElement: " + attr.name + "=" + attr.value);
        toElt.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    for (child = fromElt.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeType !== Node.ATTRIBUTE_NODE) {
            /*
            if (child.nodeType === Node.ELEMENT_NODE)
                console.log("cloneToElement: <" + child.localName + ">");
            else console.log("cloneToElement: nodeType " + child.nodeType);
            */
            toElt.appendChild(child.cloneNode(true));
        }
    }
}

function cloneToElement(fromElt, toElt) {
    cloneAllExceptAttrList(fromElt, toElt, []);
}

function SvgAnchor(node) {
    var t = this;
    t.node = node;
    //var m = node.transform.baseVal.getItem(0).matrix;
    //alert("anchor: " + m.e + ", " + m.f);
}

SvgAnchor.prototype = new Anchor();

SvgAnchor.prototype.getLocation = function() {
    var t = this;
    if (t.node.getAttributeNS(null, "visibility") == "hidden") {
        return "infinity";
    }
    var m = t.node.getCTM();
    return { x: m.e, y: m.f };
};

SvgAnchor.prototype.contains = function(x, y) {
    var t = this;
    var loc = t.getLocation();
    if (loc === "infinity") {
        return false;
    }
    var r = Number(t.node.getAttributeNS(null, "r") || "2") + 0.005;
    var dx = x - loc.x, dy = y - loc.y;
    return r * r > dx * dx + dy * dy;
};

SvgAnchor.prototype.moveToPoint = function(x, y) {
    var t = this;
    t.node.setAttributeNS(null, "visibility", "visible");
    t.node.transform.baseVal.getItem(0).setTranslate(x, y);
};

function importPath(input, output) {
    var child, output, i;
    var firstX, firstY, lastX, lastY, x, y, seg;

    function setLast(x, y) {
        //console.log("setLast: " + x + "," + y);
        lastX = x;
        lastY = y;
    }

    function startAbs() {
        setLast(0, 0);
    }

    function newSubpath() {
        firstX = lastX;
        firstY = lastY;
    }

    function closepath() {
        if (lastX !== firstX || lastY !== firstY) {
            lineto(firstX - lastX, firstY - lastY);
        }
        output.pathSegList.appendItem(input.createSVGPathSegClosePath());
        newSubpath();
    }

    function moveto(deltaX, deltaY) {
        var x = lastX + deltaX, y = lastY + deltaY;

        output.pathSegList.appendItem(input.createSVGPathSegMovetoAbs(x, y));
        setLast(x, y);
        newSubpath();
    }

    function lineto(deltaX, deltaY) {
        var x = lastX + deltaX, y = lastY + deltaY;

        output.pathSegList.appendItem(
            input.createSVGPathSegArcAbs(
                // x, y, r1, r2, angle, largeArcFlag, sweepFlag
                x, y, 1e7, 1e7, 0, 0, 0));
        setLast(x, y);
    }

    function arcto(deltaX, deltaY, r, largeArcFlag, sweepFlag) {
        var x = lastX + deltaX, y = lastY + deltaY;

        output.pathSegList.appendItem(
            input.createSVGPathSegArcAbs(
                // x, y, r1, r2, angle, largeArcFlag, sweepFlag
                x, y, r, r, 0, largeArcFlag, sweepFlag));
        setLast(x, y);
    }

    if (!input) {
        return undefined;
    }

    cloneToElement(input, output);
    output.pathSegList.clear();
    startAbs();
    newSubpath();

    for (i = 0; i < input.pathSegList.numberOfItems; i++) {
        seg = input.pathSegList.getItem(i);

        switch (seg.pathSegType) {

        case SVGPathSeg.PATHSEG_CLOSEPATH:
            closepath();
            break;

        case SVGPathSeg.PATHSEG_MOVETO_ABS:
            startAbs();
            // FALL THROUGH
        case SVGPathSeg.PATHSEG_MOVETO_REL:
            moveto(seg.x, seg.y);
            break;

        case SVGPathSeg.PATHSEG_LINETO_ABS:
            startAbs();
            // FALL THROUGH
        case SVGPathSeg.PATHSEG_LINETO_REL:
            lineto(seg.x, seg.y);
            break;

        case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
            lastX = 0;
            // FALL THROUGH
        case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
            lineto(seg.x, 0);
            break;

        case SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
            lastY = 0;
            // FALL THROUGH
        case SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL:
            lineto(0, seg.y);
            break;

        case SVGPathSeg.PATHSEG_ARC_ABS:
            startAbs();
            // FALL THROUGH
        case SVGPathSeg.PATHSEG_ARC_REL:
            if (seg.r1 !== seg.r2) {
                console.log("importPath: can not handle ellipses");
                return undefined;
            }
            arcto(seg.x, seg.y, seg.r1, seg.largeArcFlag, seg.sweepFlag);
            break;

        case SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
        case SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL:
        case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
        case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
        case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
        case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
        case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS:
        case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL:
            console.log("importPath: can not handle beziers");
            return undefined;

        case SVGPathSeg.PATHSEG_UNKNOWN:
        default:
            console.log("importPath: can not handle pathSegType " +
                        seg.pathSegType);
            return undefined;
        }
    }
    return output;
}

function rectToPath(rect) {
    var path = rect.ownerDocument.createElementNS(SVG_NS, "path");
    var x = rect.x.baseVal.value, y = rect.y.baseVal.value;
    var rx = rect.rx.baseVal.value, ry = rect.ry.baseVal.value;
    var width = rect.width.baseVal.value, height = rect.height.baseVal.value;

    cloneAllExceptAttrList(rect, path,
                           ["x", "y", "width", "height", "rx", "ry"]);

    function add(seg) {
        path.pathSegList.appendItem(seg);
    }

    add(path.createSVGPathSegMovetoAbs(x, y + ry));
    if (rx > 0 || ry > 0) {
        add(path.createSVGPathSegArcRel(rx, -ry, rx, ry, 0, 0, 1));
    }
    add(path.createSVGPathSegLinetoHorizontalRel(width - 2 * rx));
    if (rx > 0 || ry > 0) {
        add(path.createSVGPathSegArcRel(rx, ry, rx, ry, 0, 0, 1));
    }
    add(path.createSVGPathSegLinetoVerticalRel(height - 2 * ry));
    if (rx > 0 || ry > 0) {
        add(path.createSVGPathSegArcRel(-rx, ry, rx, ry, 0, 0, 1));
    }
    add(path.createSVGPathSegLinetoHorizontalRel(2 * rx - width));
    if (rx > 0 || ry > 0) {
        add(path.createSVGPathSegArcRel(-rx, -ry, rx, ry, 0, 0, 1));
    }
    add(path.createSVGPathSegClosePath());

    return path;
}

function circleToPath(circ) {
    var path = circ.ownerDocument.createElementNS(SVG_NS, "path");
    var cx = circ.cx.baseVal.value, cy = circ.cy.baseVal.value;
    var r = circ.r.baseVal.value;

    cloneAllExceptAttrList(circ, path, ["cx", "cy", "r"]);

    function add(seg) {
        path.pathSegList.appendItem(seg);
    }

    add(path.createSVGPathSegMovetoAbs(cx - r, cy));
    add(path.createSVGPathSegArcRel(2 * r, 0, r, r, 0, 0, 1));
    add(path.createSVGPathSegArcRel(-2 * r, 0, r, r, 0, 0, 1));
    add(path.createSVGPathSegClosePath());

    return path;
}

function lineToPath(line) {
    var path = line.ownerDocument.createElementNS(SVG_NS, "path");
    var x1 = line.x1.baseVal.value, y1 = line.y1.baseVal.value;
    var x2 = line.x2.baseVal.value, y2 = line.y2.baseVal.value;

    cloneAllExceptAttrList(line, path, ["x1", "x2", "y1", "y2"]);
    path.setAttributeNS(null, "fill-opacity", "0");

    function add(seg) {
        path.pathSegList.appendItem(seg);
    }

    add(path.createSVGPathSegMovetoAbs(x1, y1));
    add(path.createSVGPathSegLinetoAbs(x2, y2));

    return path;
}

function polyToPath(poly) {
    var path = poly.ownerDocument.createElementNS(SVG_NS, "path");
    var first = poly.points.getItem(0), i, point;

    cloneAllExceptAttrList(poly, path, ["points"]);

    function add(seg) {
        path.pathSegList.appendItem(seg);
    }

    add(path.createSVGPathSegMovetoAbs(first.x, first.y));

    for (i = 1; i < poly.points.numberOfItems; i++) {
        point = poly.points.getItem(i);
        add(path.createSVGPathSegLinetoAbs(point.x, point.y));
    }

    return path;
}

function polylineToPath(poly) {
    var path = polyToPath(poly);
    path.setAttributeNS(null, "fill-opacity", "0");
    return path;
}

function polygonToPath(poly) {
    var path = polyToPath(poly);
    path.pathSegList.appendItem(path.createSVGPathSegClosePath());
    return path;
}

function importElement(input) {
    var localName = input.localName;
    var output = input.ownerDocument.createElementNS(SVG_NS, "path");

    switch (localName) {
    case "path":     return importPath(input, output);
    case "rect":     return importPath(rectToPath(input), output);
    case "circle":   return importPath(circleToPath(input), output);
    case "line":     return importPath(lineToPath(input), output);
    case "polyline": return importPath(polylineToPath(input), output);
    case "polygon":  return importPath(polygonToPath(input), output);
    default:
        console.log("Can not render " + localName);
        return undefined;
    }
}

function createImage(input, output) {
    var elt, imported;

    for (elt = input.firstChild; elt != null; elt = elt.nextSibling) {
        if (elt.nodeType == Node.ELEMENT_NODE) {
            imported = importElement(elt);
            if (imported) {
                output.appendChild(imported);
            }
        }
    }
}

function SvgMoebius(args) {
    var t = this, imageGroup, anchorTemplate, anchorGroup, anchorNodes = [];
    var elts, i, node, x, y;
    t.node = args.svg;

    elts = t.node.getElementsByTagNameNS(MOEBIUS_NS, "*");

    // In inline SVG (FF 18.0) the above search returns empty.  Here is a
    // workaround.
    if (elts.length === 0) {
        elts = [];
        Array.prototype.forEach.call(
            t.node.getElementsByTagName("*"),
            function(elt) {
                if (elt.localName.indexOf("moebius:") === 0)
                    elts.push(elt);
            });
    }

    for (i = 0; i < elts.length; i++) {
        node = elts[i];
        switch (node.localName.replace("moebius:", "")) {
        case "anchor":
            anchorNodes.push(node);
            break;
        case "anchors":
            anchorGroup = anchorGroup || node;
            break;
        case "anchor-template":
            anchorTemplate = anchorTemplate || node;
            break;
        case "g":
            imageGroup = imageGroup || node;
            break;
        }
    }

    t.imageGroup = t.node.ownerDocument.createElementNS(SVG_NS, "g");
    if (imageGroup) {
        createImage(imageGroup, t.imageGroup);
        imageGroup.parentNode.replaceChild(t.imageGroup, imageGroup);
    }
    else {
        t.node.appendChild(t.imageGroup);
    }
    t.origImageGroup = t.imageGroup.cloneNode(true);

    t.anchorTemplate = t.node.ownerDocument.createElementNS(SVG_NS, "defs");
    if (anchorTemplate) {
        cloneToElement(anchorTemplate, t.anchorTemplate);
        anchorTemplate.parentNode.replaceChild(t.anchorTemplate,
                                               anchorTemplate);
    }
    else {
        var defaultTemplate = t.node.ownerDocument.createElementNS(SVG_NS,
                                                                   "circle");
        defaultTemplate.setAttributeNS(null, "r", "3");
        defaultTemplate.setAttributeNS(null, "fill", "red");
        t.anchorTemplate.appendChild(defaultTemplate);
        t.node.appendChild(t.anchorTemplate);
    }

    t.anchorGroup = t.node.ownerDocument.createElementNS(SVG_NS, "g");
    if (anchorGroup) {
        cloneToElement(anchorGroup, t.anchorGroup);
        anchorGroup.parentNode.replaceChild(t.anchorGroup, anchorGroup);
    }
    else {
        t.node.appendChild(t.anchorGroup);
    }

    t.init();

    for (i = 0; i < anchorNodes.length; i++) {
        node = anchorNodes[i];
        x = node.getAttributeNS(null, "x");
        y = node.getAttributeNS(null, "y");
        t.createAnchor(Number(x), Number(y));
        node.parentNode.removeChild(node);
    }
}

SvgMoebius.prototype = new Moebius();

SvgMoebius.prototype.getDimensions = function() {
    var t = this;
    if (!t._bbox) {
        t._bbox = t.node.ownerDocument.createElementNS(SVG_NS, "rect");
        t._bbox.setAttributeNS(null, "width", "100%");
        t._bbox.setAttributeNS(null, "height", "100%");
        t._bbox.setAttributeNS(null, "opacity", "0");
        t.node.appendChild(t._bbox);
    }
    var bbox = t._bbox.getBBox();
    return [bbox.width, bbox.height];
};

SvgMoebius.prototype.getEventPoint = function(event) {
    var x = event.clientX, y = event.clientY;
    var m = event.target.getScreenCTM().inverse();
    return [m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f];
};

SvgMoebius.prototype.createAnchor = function(x, y) {
    var t = this;
    var node = t.node.ownerDocument.createElementNS(SVG_NS, "g");
    cloneToElement(t.anchorTemplate, node);
    node.setAttributeNS(null, "transform", "translate(0,0)");
    node.transform.baseVal.getItem(0).setTranslate(x, y);
    t.anchorGroup.appendChild(node);
    t.anchors.push(new SvgAnchor(node));
};

SvgMoebius.prototype.removeAnchor = function(anchor) {
    var t = this;
    Moebius.prototype.removeAnchor.call(t, anchor);
    t.anchorGroup.removeChild(anchor.node);
};

SvgMoebius.prototype.hover = function(x, y) {
    var t = this, anchor = t.inAnchor(x, y);
    var styleNode = anchor ? anchor.node : t.imageGroup;
    var cursor = styleNode.style.getPropertyValue("cursor");
    t.node.style.setProperty("cursor", cursor);
};

function findArcMid(start, end, r, largeArcFlag, sweepFlag) {
    var mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    var toMid = { x: mid.x - start.x, y: mid.y - start.y };
    var leg1sq = toMid.x * toMid.x + toMid.y * toMid.y;
    var leg2sq = Math.max(r * r - leg1sq, 0);
    var rSign = (sweepFlag ? -1 : 1);
    var legSign = rSign * (largeArcFlag ? 1 : -1);
    var k = (rSign * r + legSign * Math.sqrt(leg2sq)) / Math.sqrt(leg1sq);
    var ret = { x: mid.x - k * toMid.y, y: mid.y + k * toMid.x };
    //console.log(["findArcMid:", start.x, start.y, end.x, end.y, ret.x, ret.y, rSign, legSign, largeArcFlag, sweepFlag].join(" "));
    return ret;
}

SvgMoebius.prototype.redraw = function() {
    var t = this, i, origElt, elt, origSeg, seg, lastP, fLastP, p, fP, mid, arc;

    function setLastP(x, y) {
        lastP = { x: x, y: y };
        fLastP = t.app.apply(lastP);
    }

    setLastP(0, 0);

    origElt = t.origImageGroup.firstChild;
    elt = t.imageGroup.firstChild;

    while (origElt != null) {

        // XXX When a filled shape inverts ("contains infinity") we
        // should append a line out of the viewport, around it, and back.
        // But this would cause unwanted effects for stroked shapes, so we
        // should not do this for them.

        for (i = 0; i < origElt.pathSegList.numberOfItems; i++) {
            origSeg = origElt.pathSegList.getItem(i);
            seg = elt.pathSegList.getItem(i);

            switch (origSeg.pathSegType) {

            case SVGPathSeg.PATHSEG_CLOSEPATH:
                break;

            case SVGPathSeg.PATHSEG_MOVETO_ABS:
                setLastP(origSeg.x, origSeg.y);
                seg.x = fLastP.x;
                seg.y = fLastP.y;
                break;

            case SVGPathSeg.PATHSEG_ARC_ABS:
                p = { x: origSeg.x, y: origSeg.y };
                mid = findArcMid(lastP, p, origSeg.r1, origSeg.largeArcFlag,
                                 origSeg.sweepFlag);
                mid = t.app.apply(mid);
                fP = t.app.apply(p);
                arc = t.app.makeArc(fLastP, mid, fP);

                seg.x = fP.x;
                seg.y = fP.y;
                seg.r1 = seg.r2 = Math.min(arc.r, 1e7);
                seg.largeArcFlag = arc.largeArcFlag;
                seg.sweepFlag = arc.sweepFlag;

                lastP = p;
                fLastP = fP;
                break;

            default:
                throw "Bad pathSegType in origImageGroup: " + orig.pathSegType;
            }
        }

        elt = elt.nextSibling;
        origElt = origElt.nextSibling;
    }
};

MoebiusApp = (function() {

    var App = {};
    var sn = SchemeNumber;
    var fn = sn.fn;
    var ns = fn["number->string"];

    // Number type abstraction.
    var crect = fn["make-rectangular"];
    var creal = fn["real-part"];
    var cimag = fn["imag-part"];
    var ceq = fn["="];
    var cadd = fn["+"];  // can handle more than 2 args
    var csub = fn["-"];  // can handle more than 2 args
    var cneg = fn["-"];
    var cmul = fn["*"];  // can handle more than 2 args
    var cdiv = fn["/"];  // can handle more than 2 args
    var crdiv = fn["/"];  // can handle more than 2 args
    var carg = fn.angle;
    var polar = fn["make-polar"];
    var cabs = fn.magnitude;
    var cabs2 = function(z) {
        var x = creal(z), y = cimag(z);
        return radd(rmul(x, x), rmul(y, y));
    };
    var radd = function(a, b) { return a + b; };
    var rsub = function(a, b) { return a - b; };
    var rneg = function(a)    { return -a; };
    var rmul = function(a, b) { return a * b; };
    var rdiv = function(a, b) { return a / b; };
    var rsin = Math.sin;
    var rcos = Math.cos;
    var log = Math.log;
    var min = Math.min;
    var max = Math.max;
    var lt0 = function(x) { return x < 0; };
    var gt0 = function(x) { return x > 0; };
    var le = function(x, y) { return x <= y; };
    var lt = function(x, y) { return x < y; };
    var ge = function(x, y) { return x >= y; };
    var gt = function(x, y) { return x > y; };
    var isOdd = function(n) { return (n & 1) == 1; };
    var finite = fn["finite?"];
    var isZero = fn["zero?"];
    var cIsZero = fn["zero?"];
    var abs = Math.abs;
    var ceil = Math.ceil;
    var sqrt = Math.sqrt;
    var PI = Math.PI;
    var ZERO = 0;
    var ONE = 1;
    var cZERO = 0;
    var cONE = 1;
    var INF = Infinity;

    // Constant folding.
    var M1 = rneg(ONE);
    var cM1 = crect(M1, ZERO);
    var I = crect(ZERO, ONE);
    var M_I = crect(ZERO, M1);
    var TWO = radd(ONE, ONE);
    var TWO_PI = rmul(2, PI);
    var HALF = rdiv(ONE, TWO);
    var HALF_PI = rmul(HALF, PI);
    var ONE_p_I = cadd(cONE, I);
    var ONE_m_I = csub(cONE, I);
    var QUARTER = rmul(HALF, HALF);
    var Mp5 = rneg(HALF);
    var Mp5_p_p5I = crect(Mp5, HALF);
    var M1_p_I = crect(M1, ONE);
    var p5I = crect(ZERO, HALF);
    var p5_p_p5I = crect(HALF, HALF);
    var p5_m_p5I = crect(HALF, Mp5);
    var ONEp5 = radd(ONE, HALF);
    var ONEp5_p_p5I = crect(ONEp5, HALF);

    function MoebiusTransform(a, b, c, d) {
        //assert(!isZero(csub(cmul(a,d),cmul(b,c))));

        // Keep the values away from the limits of IEEE double precision.
        var metric = abs(creal(a)) + abs(cimag(a)) + abs(creal(b)) +
            abs(cimag(b)) + abs(creal(c)) + abs(cimag(c)) +
            abs(creal(d)) + abs(cimag(d));
        if (metric > 1e99 || metric < 1e-99) {
            a = crdiv(a, metric);
            b = crdiv(b, metric);
            c = crdiv(c, metric);
            d = crdiv(d, metric);
        }

        this.a = a;
	this.b = b;
	this.c = c;
	this.d = d;
    }
    MoebiusTransform.prototype = {};

    MoebiusTransform.prototype.toString = function() {
	return "MoebiusTransform(" + String(this.a) + ", " + String(this.b) +
            ", " + String(this.c) + ", " + String(this.d) + ")";
    };

    MoebiusTransform.prototype.apply = function(z) {
        try {
        if (z === INF) {
            return (cIsZero(this.c) ? INF : cdiv(this.a, this.c));
        }
        var den = cadd(cmul(this.c, z), this.d);
        return (cIsZero(den) ? INF : cdiv(cadd(cmul(this.a, z), this.b), den));
        } catch (e) { throw String(e) + " - " + this + " - " + z; }
    };

    MoebiusTransform.prototype.inverse = function() {
        return new MoebiusTransform(cneg(this.d), this.b, this.c, cneg(this.a));
    };

    // z -> m1(m2(z))
    function compose(m1, m2) {
	return new MoebiusTransform(cadd(cmul(m1.a, m2.a), cmul(m1.b, m2.c)),
				    cadd(cmul(m1.a, m2.b), cmul(m1.b, m2.d)),
				    cadd(cmul(m1.c, m2.a), cmul(m1.d, m2.c)),
				    cadd(cmul(m1.c, m2.b), cmul(m1.d, m2.d)));
    }
    // Return the transform mapping 0 to z1, 1 to z2, and infinity to z3.
    function fromZeroOneInf(z1, z2, z3) {
	var z2_m_z1 = csub(z2, z1);
        if (z3 === INF)
            return linear(z2_m_z1, z1);
        // XXX What if z1 or z2 is INF?
	var z3_m_z2 = csub(z3, z2);
        return new MoebiusTransform(cmul(z3, z2_m_z1), cmul(z1, z3_m_z2),
                                    z2_m_z1, z3_m_z2);
    }
    // Return the transform mapping 0 to z1, i to z2, and infinity to z3.
    function fromZeroIInf(z1, z2, z3) {
        // XXX Should handle INF as an argument.
	var z2_m_z1 = csub(z2, z1);
	var I_z3_m_z2 = cmul(I, csub(z3, z2));
        return new MoebiusTransform(cmul(z3, z2_m_z1), cmul(I_z3_m_z2, z1),
                                    z2_m_z1, I_z3_m_z2);
    }
    // Return the transform mapping z1 to 0, z2 to 1, and z3 to infinity.
    function toZeroOneInf(z1, z2, z3) {
	var z2_m_z1 = csub(z2, z1);
        if (z3 === INF)
            return linear(cdiv(cONE, z2_m_z1), cdiv(cneg(z1), z2_m_z1));
        // XXX What if z1 or z2 is INF?
	var z2_m_z3 = csub(z2, z3);
	return new MoebiusTransform(z2_m_z3, cmul(z1, cneg(z2_m_z3)),
				    z2_m_z1, cmul(z3, cneg(z2_m_z1)));
    }
    /*
    // Return the transform mapping z1 to 0, z2 to i, and z3 to infinity.
    function toZeroIInf(z1, z2, z3) {
        // XXX Should handle INF as an argument.
	var z2_m_z1 = csub(z2, z1);
	var z2_m_z3 = csub(z2, z3);
	return new MoebiusTransform(cmul(I, z2_m_z3), cmul(cmul(M_I, z1), z2_m_z3),
				    z2_m_z1, cmul(z3, cneg(z2_m_z1)));
    }
    */
    // Return a translation/dilation/rotation
    function linear(a, b) {
	return new MoebiusTransform(a, b, cZERO, cONE);
    }

    var F = linear(cONE, cZERO);

    var maxInfo = 800;
    function info() {
	//if (maxInfo-- <= 0) throw "Stopping log";
        console.log(Array.prototype.join.call(arguments, ' '));
    }

    function num(o) {
        if (o === "infinity") return INF;
        return crect(+o.x, +o.y);
    }

    function point(z) {
        if (z === INF) return "infinity";
        return { x: +creal(z), y: +cimag(z) };
    }

    function map3(p) {
        function eq(z1, z2) {
            return (z1 === INF ? z2 === INF : z2 !== INF && ceq(z1, z2));
        }

        var from1 = num(p.from1), from2 = num(p.from2), from3 = num(p.from3);
        var to1 = num(p.to1), to2 = num(p.to2), to3 = num(p.to3);
        var eq12 = eq(to1, to2), eq23 = eq(to2, to3), eq31 = eq(to3, to1);

        if (eq12 !== eq(from1, from2) || eq23 !== eq(from2, from3) ||
            eq31 !== eq(from3, from1)) {
            info(["map3: equal points do not map to equal points:",
                  from1, to1, from2, to2, from3, to3].join(' '));
            return;
        }
        if (eq12 && eq23 && eq31) {
            info(["map3: three identical mappings:", from1, to1].join(' '));
            return;
        }
        if (eq12 || eq31) {
            var toSwap = (eq12 ? [from3, to3] : [from2, to2]);
            eq12 ? from3 = from1 : from2 = from1;
            eq12 ? to3 = to1 : to2 = to1;
            from1 = toSwap[0];
            to1 = toSwap[1];
            //assert(eq(to2, to3));
            eq23 = true;
        }

        var from, to, map;
        if (eq23) {
            if (!eq(from2, to2)) {
                // XXX Is this mathematically meaningful?
                info(["map3: duplicate non-fixed mapping:",
                      from2, to2].join(' '));
                return;
            }
            if (from2 === INF) {
                // Translation.
	        map = linear(cONE, csub(to1, from1));
            }
            else {
                // Parabolic transform.
                // Choose an arbitrary distinct point.
                var other = (from1 === INF ? cadd(cONE, from2) :
                             crdiv(cadd(from1, from2), TWO));
                var m1 = toZeroOneInf(from1, other, from2);
                var m2 = linear(cONE, csub(m1.apply(to1), m1.apply(from1)));
                map = compose(m1.inverse(), compose(m2, m1));
            }
        }
        else {
            // XXX We might get smaller rounding errors if we chose
            // the closest pair for 0 and 1 and the outlier for infinity.
            from = toZeroOneInf(from1, from2, from3);
            to = fromZeroOneInf(to1, to2, to3);
            map = compose(to, from);
        }

        var newF = compose(map, F);
        //info(["map3:", newF, from1, to1, from2, to2, from3, to3].join(' '));
        F = newF;
    }

    function apply(p) {
        return point(F.apply(num(p)));
    }

    function makeArc(start, mid, end) {
        var r, largeArcFlag, sweepFlag, z1, z2, z3;

        z1 = num(start);
        z2 = num(mid);
        z3 = num(end);

        // XXX could avoid this division
	var A = carg(cdiv(csub(z1, z2), csub(z3, z2)));
	var sin_A = rsin(A);
        if (isZero(sin_A)) {
            r = Infinity;
            largeArcFlag = 0;
            sweepFlag = 0;  // arbitrary
        }
        else {
            r = abs(rdiv(cabs(csub(z3, z1)), radd(sin_A, sin_A)));
            sweepFlag = (lt0(A) ? 0 : 1);
            largeArcFlag = lt(abs(A), HALF_PI) ? 1 : 0;
            //console.log(["makeArc:", z1, z2, z3, A, largeArcFlag].join(" "));
        }
        
        return { r: r, largeArcFlag: largeArcFlag, sweepFlag: sweepFlag };
    }

    App.map3 = map3;
    App.apply = apply;
    App.makeArc = makeArc;

    return App;
})();
