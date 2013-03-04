/*
  File: require.js
  Minimalist implementation of CommonJS Modules 1.1.1.
  http://wiki.commonjs.org/wiki/Modules/1.1.1

  Copyright (c) 2011 by John Tobey <jtobey@john-edwin-tobey.org>
*/

var require = (function() {

    function read(file) {
        // My readFile returns an empty string if the file doesn't exist.
        // Better not have empty modules!
        var ret = readFile(file);
        //print("read(" + file + "): " + ret.length + " bytes");
        if (ret == "") {
            throw new Error("Can not read file: " + file);
        }
        return ret;
    }

    var stack = [""];
    var loaded = {};
    var newlines = "";  // For translating error lines.
    var startLines = [];

    function doLoad(id, code) {
        var dir = id.replace(/[^\/]*$/, "");
        var module = { id: id };
        var exports = {};
        var fn = eval(newlines + "function(require,module,exports){"
                      + code + "}");
        startLines.push({ id: id, line: newlines.length });
        newlines += code.replace(/[^\n]+/g, "");

        loaded[id] = exports;
        req.paths = require.paths; // omit when Secure.
        stack.push(dir);
        try {
            fn.call(new Object(), req, module, exports);
        }
        finally {
            stack.pop();
        }
        return exports;
    }

    function resolve(path, terms) {
        var i;
        for (i = 0; i < terms.length - 1; i++) {
            if (terms[i] == ".")
                continue;
            if (terms[i] == "..") {
                if (path == "") {
                    return "";
                }
                path = path.replace(/[^\/]+\//, "");
            }
            else {
                path += terms[i] + "/";
            }
        }
        return path + terms[terms.length - 1];
    }

    function req(id) {
        if (loaded[id]) {
            return loaded[id];
        }

        var terms = id.split("/");
        var i, ps, ids, code;

        if (terms[0] == "") {
            ps = [""];
        }
        else if (terms[0][0] == ".") {
            ps = [stack[stack.length - 1]];
        }
        else {
            ps = require.paths;
        }

        ids = [];

        for (i = 0; i < ps.length; i++) {
            var p = ps[i];
            if (p != "" && p[p.length - 1] != "/") {
                p += "/";
            }
            var full = resolve(p, terms);
            if (full == "") {
                continue;
            }
            if (loaded[full]) {
                return loaded[full];
            }
            ids.push(full);
        }

        for (i = 0; i < ids.length; i++) {
            var full = ids[i];
            try {
                code = read(full + ".js");
            }
            catch (ex) {
                continue;
            }
            return doLoad(full, code);
        }

        throw new Error("Module " + id + " not found.  Searched: " + ps);
    }

    // Help with debugging.  Usage:
    // js> require("bigrational")
    // js> print(require.where(100))
    // ./bigrational line 100
    // js> print(require.where(1000))
    // ./biginteger line 132

    req.translateSourceLine = function(line) {
        if (line < 1 || line > newlines.length) {
            return {module: "eval", line: line};
        }
        var i = startLines.length;
        while (i--) {
            if (startLines[i].line >= line)
                continue;
            return {module: startLines[i].id, line: line - startLines[i].line};
        }
        throw new Error("Bug in translateSourceLine: startLines="
                        + startLines + ", newlines.length=" + newlines.length
                        + ", line=" + line);
    }
    req.where = function(line) {
        var src = req.translateSourceLine(line);
        return src.module + " line " + src.line;
    }

    return req;
})();

require.paths = [];
