# Experimental browser plugin, tested only on Linux.

CFLAGS = -Wall -fPIC -g -DXP_UNIX=1

libgmp-plugin.so: gmp-plugin.o
	$(CC) $(CFLAGS) -shared $^ -lgmp -lm -o $@
gmp-plugin.o: gmp-plugin.c gmp-entries.h gmp-constants.h

clean:
	rm -f gmp-plugin.o
distclean: clean
	rm -f libgmp-plugin.so
