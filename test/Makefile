JS = rhino -f
SCHEME = mosh
EDITOR = emacs

default: test-sn.diff
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

js.raw: test-sn.js ../biginteger.js ../schemeNumber.js
	$(JS) $< > $@.tmp
	mv $@.tmp $@

scheme.raw: test-sn.scheme
	$(SCHEME) $< > $@.tmp
	mv $@.tmp $@

clean:
	rm -f scheme.out js.out test-sn.scheme test-sn.js test-sn.diff
	rm -f scheme.raw js.raw
	rm -f *~
