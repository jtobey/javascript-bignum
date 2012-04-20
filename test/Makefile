JS = node
RHINO = rhino -f
RHINO_PIPE = ( rhino 2>/dev/null | grep '^(' ) <
NODE = node
SCHEME = mosh
EDITOR = emacs
PAGER = less
JSDEP = ../biginteger.js ../schemeNumber.js

.PHONY: default full clean r6rs ecma

default: r6rs ecma

r6rs: r6rs-$(JS)

r6rs-node: node.out.good test-sn.js $(JSDEP)
	$(NODE) test-sn.js | diff node.out.good -

r6rs-rhino: rhino.out.good test-sn.js $(JSDEP)
	$(RHINO_PIPE) test-sn.js | diff rhino.out.good -

ecma: ecma-$(JS)

ecma-node: jstest.js $(JSDEP)
	$(NODE) $<

ecma-rhino: jstest.js $(JSDEP)
	$(RHINO) $<

test-sn.html: gen-test.pl node.out.good
	./gen-test.pl html < node.out.good > $@.tmp
	mv $@.tmp $@

test-sn.%: gen-test.pl
	./$< $* > $@.tmp
	mv $@.tmp $@

node.out.good: test-sn.js
	$(NODE) $< > $@.tmp
	mv $@.tmp $@

node.out: test-sn.js $(JSDEP)
	$(NODE) $< > $@.tmp
	mv $@.tmp $@

rhino.out.good: test-sn.js
	$(RHINO_PIPE) $< > $@.tmp
	mv $@.tmp $@

rhino.out: test-sn.js $(JSDEP)
	$(RHINO_PIPE) $< > $@.tmp
	mv $@.tmp $@

scheme.raw: test-sn.scheme
	$(SCHEME) $< > $@.tmp
	mv $@.tmp $@

clean:
	rm -f test-sn.scheme test-sn.js test-sn.diff
	rm -f *.out *.raw *~
