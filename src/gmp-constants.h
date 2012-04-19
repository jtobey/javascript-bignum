/* gmp-constants.h: header private to gmp-plugin.c.

   Copyright(C) 2012 John Tobey, see ../LICENCE
*/

CONSTANT(mp_bits_per_limb, "mp_bits_per_limb", int)
CONSTANT(__GNU_MP_VERSION, "__GNU_MP_VERSION", int)
CONSTANT(__GNU_MP_VERSION_MINOR, "__GNU_MP_VERSION_MINOR", int)
CONSTANT(__GNU_MP_VERSION_PATCHLEVEL, "__GNU_MP_VERSION_PATCHLEVEL", int)
CONSTANT(gmp_version, "gmp_version", stringz)
//CONSTANT(__GMP_CC, "__GMP_CC", stringz)
//CONSTANT(__GMP_CFLAGS, "__GMP_CFLAGS", stringz)
CONSTANT(PLUGIN_VERSION, "PLUGIN_VERSION", stringz)

#undef CONSTANT
