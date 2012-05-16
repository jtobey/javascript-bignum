# Experimental browser plugin, tested only on Linux.

OPTIMIZE = -O3 -g
CFLAGS = -std=c99 -Wall -Wno-unused-label -fPIC $(OPTIMIZE) -DXP_UNIX=1 \
	-DNPGMP_SCRIPT=0

npgmp.so: npgmp.o
	$(CC) $(CFLAGS) -shared $^ -lgmp -lm -o $@
npgmp.o: npgmp.c gmp-entries.h gmp-constants.h

# Bare-bones plugin.
npmpz.so: npgmp.c gmp-entries.h gmp-constants.h
	$(CC) $(CFLAGS)				\
		-DNPGMP_MPQ=0			\
		-DNPGMP_MPF=0			\
		-DNPGMP_RAND=0			\
		-DNPGMP_SCRIPT=0		\
		-shared $< -lgmp -lm -o $@

clean:
	rm -f npgmp.o
distclean: clean
	rm -f npgmp.so npmpz.so
