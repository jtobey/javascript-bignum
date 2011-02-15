JS = rhino -f
JSR6RS = ( rhino 2>/dev/null | grep '^(' ) <
SCHEME = mosh
EDITOR = emacs
PAGER = less
JSDEP = ../biginteger.js ../schemeNumber.js

.PHONY: default full clean r6rs ecma

default: r6rs ecma

r6rs: js.raw.good test-sn.js $(JSDEP)
	$(JSR6RS) test-sn.js | diff js.raw.good -

ecma: jstest.js $(JSDEP)
	$(JS) $<

full: test-sn.diff
	$(EDITOR) $^

test-sn.diff: js.out scheme.out
	diff $^ > $@.tmp || true
	mv $@.tmp $@

test-sn.%: gen-test.pl
	./$< $* > $@.tmp
	mv $@.tmp $@

%.out: %.raw float-filter.pl
	./float-filter.pl < $< > $@.tmp
	mv $@.tmp $@

js.raw: test-sn.js $(JSDEP)
	$(JSR6RS) $< > $@.tmp
	mv $@.tmp $@

scheme.raw: test-sn.scheme
	$(SCHEME) $< > $@.tmp
	mv $@.tmp $@

clean:
	rm -f scheme.out js.out test-sn.scheme test-sn.js test-sn.diff
	rm -f scheme.raw js.raw
	rm -f *~
