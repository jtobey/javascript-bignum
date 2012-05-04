# Experimental browser plugin, tested only on Linux.

OPTIMIZE = -O3 -g
CFLAGS = -std=c99 -Wall -Wno-unused-label -fPIC $(OPTIMIZE) -DXP_UNIX=1 \
	-DNPGMP_SCRIPT=0

libgmp-plugin.so: gmp-plugin.o
	$(CC) $(CFLAGS) -shared $^ -lgmp -lm -o $@
gmp-plugin.o: gmp-plugin.c gmp-entries.h gmp-constants.h

# Bare-bones plugin.
libmpz-plugin.so: gmp-plugin.c gmp-entries.h gmp-constants.h
	$(CC) $(CFLAGS)				\
		-DNPGMP_PORTING=0		\
		-DNPGMP_MPQ=0			\
		-DNPGMP_MPF=0			\
		-DNPGMP_RAND=0			\
		-DNPGMP_RTTI=0			\
		-DNPGMP_SCRIPT=0		\
		-shared $< -lgmp -lm -o $@

clean:
	rm -f gmp-plugin.o
distclean: clean
	rm -f libgmp-plugin.so libmpz-plugin.so
