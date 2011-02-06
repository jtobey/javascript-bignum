JS = rhino -f
SCHEME = mosh
RUN.js = $(JS)
RUN.scheme = $(SCHEME)
EDITOR = emacs

default: test-sn.diff
	$(EDITOR) $^

test-sn.diff: js.out scheme.out
	diff $^ > $@ || true

test-sn.%: gen-test.pl
	./$< $* > $@.tmp
	mv $@.tmp $@

%.out: test-sn.% float-filter.pl
	$(RUN.$*) $< | ./float-filter.pl > $@.tmp
	mv $@.tmp $@

clean:
	rm -f scheme.out js.out test-sn.scheme test-sn.js test-sn.diff
