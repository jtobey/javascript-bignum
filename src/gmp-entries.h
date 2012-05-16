/* gmp-entries.h: header private to npgmp.c.
   C macros as IDL for libgmp.

   Copyright(C) 2012 John Tobey, see ../LICENCE

   TO DO:

   MAYBE TO DO:
      mpz_inits
      mpz_clears
      mpz_import - what would it do?
      mpz_export - what would it do?
      mpq_inits
      mpq_clears
      mpf_inits
      mpf_clears
      mpz_out_str
      mpz_inp_str
      mpz_out_raw
      mpz_inp_raw
      mpq_out_str
      mpq_inp_str
      mpf_out_str
      mpf_inp_str
      gmp_randinit - obsolete

   NOT TO DO:
      mpz_get_str - use toString method
      mpz_fits_uint_p
      mpz_fits_sint_p
      mpz_fits_ushort_p
      mpz_fits_sshort_p
      mpz_array_init
      mpq_get_str - use toString method
      mpf_fits_uint_p
      mpf_fits_sint_p
      mpf_fits_ushort_p
      mpf_fits_sshort_p
      mpn* - probably not
      gmp_*printf - possibly with libffi
      gmp_*scanf - possibly with libffi
      BSD compatibility functions - probably not
      mp_set_memory_functions - C-specific
      mp_get_memory_functions - C-specific

   DONE: every remaining function and macro in the GMP v5.0.4 manual.
*/

#ifndef ENTRY1R1
# ifdef ENTRY1
#  define ENTRY0R1(__name, __string, __id, __r0) \
    ENTRY0 (1, __string, __id)
#  define ENTRY1R0(__name, __string, __id, __t0) \
    ENTRY1 (0, __string, __id, __t0)
#  define ENTRY1R1(__name, __string, __id, __r0, __t0) \
    ENTRY1 (1, __string, __id, __t0)
#  define ENTRY1R2(__name, __string, __id, __r0, __r1, __t0) \
    ENTRY1 (2, __string, __id, __t0)
#  define ENTRY2R0(__name, __string, __id, __t0, __t1) \
    ENTRY2 (0, __string, __id, __t0, __t1)
#  define ENTRY2R1(__name, __string, __id, __r0, __t0, __t1) \
    ENTRY2 (1, __string, __id, __t0, __t1)
#  define ENTRY3R0(__name, __string, __id, __t0, __t1, __t2) \
    ENTRY3 (0, __string, __id, __t0, __t1, __t2)
#  define ENTRY3R1(__name, __string, __id, __r0, __t0, __t1, __t2) \
    ENTRY3 (1, __string, __id, __t0, __t1, __t2)
#  define ENTRY3R2(__name, __string, __id, __r0, __r1, __t0, __t1, __t2) \
    ENTRY3 (2, __string, __id, __t0, __t1, __t2)
#  define ENTRY4R0(__name, __string, __id, __t0, __t1, __t2, __t3) \
    ENTRY4 (0, __string, __id, __t0, __t1, __t2, __t3)
#  define ENTRY4R1(__name, __string, __id, __r0, __t0, __t1, __t2, __t3) \
    ENTRY4 (1, __string, __id, __t0, __t1, __t2, __t3)
#  define ENTRY5R0(__name, __string, __id, __t0, __t1, __t2, __t3, __t4) \
    ENTRY5 (0, __string, __id, __t0, __t1, __t2, __t3, __t4)
# else
#  define ENTRY0R1(__name, __string, __id, __r0) \
    ENTRYR1 (0, __string, __id, __r0)
#  define ENTRY1R0(__name, __string, __id, __t0) \
    ENTRYR0 (1, __string, __id)
#  define ENTRY1R1(__name, __string, __id, __r0, __t0) \
    ENTRYR1 (1, __string, __id, __r0)
#  define ENTRY1R2(__name, __string, __id, __r0, __r1, __t0) \
    ENTRYR2 (1, __string, __id, __r0, __r1)
#  define ENTRY2R0(__name, __string, __id, __t0, __t1) \
    ENTRYR0 (2, __string, __id)
#  define ENTRY2R1(__name, __string, __id, __r0, __t0, __t1) \
    ENTRYR1 (2, __string, __id, __r0)
#  define ENTRY3R0(__name, __string, __id, __t0, __t1, __t2) \
    ENTRYR0 (3, __string, __id)
#  define ENTRY3R1(__name, __string, __id, __r0, __t0, __t1, __t2) \
    ENTRYR1 (3, __string, __id, __r0)
#  define ENTRY3R2(__name, __string, __id, __r0, __r1, __t0, __t1, __t2) \
    ENTRYR2 (3, __string, __id, __r0, __r1)
#  define ENTRY4R0(__name, __string, __id, __t0, __t1, __t2, __t3) \
    ENTRYR0 (4, __string, __id)
#  define ENTRY4R1(__name, __string, __id, __r0, __t0, __t1, __t2, __t3) \
    ENTRYR1 (4, __string, __id, __r0)
#  define ENTRY5R0(__name, __string, __id, __t0, __t1, __t2, __t3, __t4) \
    ENTRYR0 (5, __string, __id)
# endif
#endif

#ifndef ENTRYR1
# define ENTRYR0(__nargs, __string, __id) \
    ENTRY (__nargs, 0, __string, __id)
# define ENTRYR1(__nargs, __string, __id, __r0) \
    ENTRY (__nargs, 1, __string, __id)
# define ENTRYR2(__nargs, __string, __id, __r0, __r1) \
    ENTRY (__nargs, 2, __string, __id)
#endif

#ifndef ENTRY
# define ENTRY(__nargs, __nret, __string, __id)
#endif

// http://gmplib.org/manual/Integer-Functions.html

#ifdef ENTRY_GET_FIRST
(__LINE__ + 2)
#endif
ENTRY0R1 (x_mpz, "mpz", np_mpz, npobj)
ENTRY1R1 (is_mpz, "mpz.is_mpz", np_is_mpz, Bool, Variant)
ENTRY1R0 (mpz_init, "mpz.init", np_mpz_init, uninit_mpz)
// mpz_inits: unimplemented.
ENTRY2R0 (mpz_init2, "mpz.init2", np_mpz_init2, uninit_mpz, mp_bitcnt_t)
ENTRY1R0 (mpz_init, "mpz.clear", np_mpz_clear, uninit_mpz)
// mpz_clears: unimplemented.
ENTRY2R0 (mpz_realloc2, "mpz.realloc2", np_mpz_realloc2, mpz_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_set, "mpz.set", np_mpz_set, mpz_ptr, mpz_ptr)
ENTRY2R0 (mpz_set_ui, "mpz.set_ui", np_mpz_set_ui, mpz_ptr, ulong)
ENTRY2R0 (mpz_set_si, "mpz.set_si", np_mpz_set_si, mpz_ptr, long)
ENTRY2R0 (mpz_set_d, "mpz.set_d", np_mpz_set_d, mpz_ptr, double)
#if NPGMP_MPQ
ENTRY2R0 (mpz_set_q, "mpz.set_q", np_mpz_set_q, mpz_ptr, mpq_ptr)
#endif
#if NPGMP_MPF
ENTRY2R0 (mpz_set_f, "mpz.set_f", np_mpz_set_f, mpz_ptr, mpf_ptr)
#endif
ENTRY3R1 (mpz_set_str, "mpz.set_str", np_mpz_set_str, int, mpz_ptr, stringz, int_0_or_2_to_62)
ENTRY2R0 (mpz_swap, "mpz.swap", np_mpz_swap, mpz_ptr, mpz_ptr)
ENTRY2R0 (mpz_init_set, "mpz.init_set", np_mpz_init_set, uninit_mpz, mpz_ptr)
ENTRY2R0 (mpz_init_set_ui, "mpz.init_set_ui", np_mpz_init_set_ui, uninit_mpz, ulong)
ENTRY2R0 (mpz_init_set_si, "mpz.init_set_si", np_mpz_init_set_si, uninit_mpz, long)
ENTRY2R0 (mpz_init_set_d, "mpz.init_set_d", np_mpz_init_set_d, uninit_mpz, double)
ENTRY3R1 (mpz_init_set_str, "mpz.init_set_str", np_mpz_init_set_str, int, uninit_mpz, stringz, int_0_or_2_to_62)
ENTRY1R1 (mpz_get_ui, "mpz.get_ui", np_mpz_get_ui, ulong, mpz_ptr)
ENTRY1R1 (mpz_get_si, "mpz.get_si", np_mpz_get_si, long, mpz_ptr)
ENTRY1R1 (mpz_get_d, "mpz.get_d", np_mpz_get_d, double, mpz_ptr)
// Usage: var a = mpz_get_d_2exp(z), d = a[0], exp = a[1];
ENTRY1R2 (mpz_get_d_2exp, "mpz.get_d_2exp", np_mpz_get_d_2exp, double, long, mpz_ptr)
// mpz_get_str: C-specific; use integers' toString method instead.
ENTRY3R0 (mpz_add, "mpz.add", np_mpz_add, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_add_ui, "mpz.add_ui", np_mpz_add_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_sub, "mpz.sub", np_mpz_sub, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_sub_ui, "mpz.sub_ui", np_mpz_sub_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_ui_sub, "mpz.ui_sub", np_mpz_ui_sub, mpz_ptr, ulong, mpz_ptr)
ENTRY3R0 (mpz_mul, "mpz.mul", np_mpz_mul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_mul_si, "mpz.mul_si", np_mpz_mul_si, mpz_ptr, mpz_ptr, long)
ENTRY3R0 (mpz_mul_ui, "mpz.mul_ui", np_mpz_mul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_addmul, "mpz.addmul", np_mpz_addmul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_addmul_ui, "mpz.addmul_ui", np_mpz_addmul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_submul, "mpz.submul", np_mpz_submul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_submul_ui, "mpz.submul_ui", np_mpz_submul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_mul_2exp, "mpz.mul_2exp", np_mpz_mul_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_neg, "mpz.neg", np_mpz_neg, mpz_ptr, mpz_ptr)
ENTRY2R0 (mpz_abs, "mpz.abs", np_mpz_abs, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_cdiv_q, "mpz.cdiv_q", np_mpz_cdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_cdiv_r, "mpz.cdiv_r", np_mpz_cdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4R0 (mpz_cdiv_qr, "mpz.cdiv_qr", np_mpz_cdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R1 (mpz_cdiv_q_ui, "mpz.cdiv_q_ui", np_mpz_cdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3R1 (mpz_cdiv_r_ui, "mpz.cdiv_r_ui", np_mpz_cdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4R1 (mpz_cdiv_qr_ui, "mpz.cdiv_qr_ui", np_mpz_cdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2R1 (mpz_cdiv_ui, "mpz.cdiv_ui", np_mpz_cdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3R0 (mpz_cdiv_q_2exp, "mpz.cdiv_q_2exp", np_mpz_cdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_cdiv_r_2exp, "mpz.cdiv_r_2exp", np_mpz_cdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_fdiv_q, "mpz.fdiv_q", np_mpz_fdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_fdiv_r, "mpz.fdiv_r", np_mpz_fdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4R0 (mpz_fdiv_qr, "mpz.fdiv_qr", np_mpz_fdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R1 (mpz_fdiv_q_ui, "mpz.fdiv_q_ui", np_mpz_fdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3R1 (mpz_fdiv_r_ui, "mpz.fdiv_r_ui", np_mpz_fdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4R1 (mpz_fdiv_qr_ui, "mpz.fdiv_qr_ui", np_mpz_fdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2R1 (mpz_fdiv_ui, "mpz.fdiv_ui", np_mpz_fdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3R0 (mpz_fdiv_q_2exp, "mpz.fdiv_q_2exp", np_mpz_fdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_fdiv_r_2exp, "mpz.fdiv_r_2exp", np_mpz_fdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_tdiv_q, "mpz.tdiv_q", np_mpz_tdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_tdiv_r, "mpz.tdiv_r", np_mpz_tdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4R0 (mpz_tdiv_qr, "mpz.tdiv_qr", np_mpz_tdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R1 (mpz_tdiv_q_ui, "mpz.tdiv_q_ui", np_mpz_tdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3R1 (mpz_tdiv_r_ui, "mpz.tdiv_r_ui", np_mpz_tdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4R1 (mpz_tdiv_qr_ui, "mpz.tdiv_qr_ui", np_mpz_tdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2R1 (mpz_tdiv_ui, "mpz.tdiv_ui", np_mpz_tdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3R0 (mpz_tdiv_q_2exp, "mpz.tdiv_q_2exp", np_mpz_tdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_tdiv_r_2exp, "mpz.tdiv_r_2exp", np_mpz_tdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_mod, "mpz.mod", np_mpz_mod, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_mod_ui, "mpz.mod_ui", np_mpz_mod_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_divexact, "mpz.divexact", np_mpz_divexact, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_divexact_ui, "mpz.divexact_ui", np_mpz_divexact_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2R1 (mpz_divisible_p, "mpz.divisible_p", np_mpz_divisible_p, Bool, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_divisible_ui_p, "mpz.divisible_ui_p", np_mpz_divisible_ui_p, Bool, mpz_ptr, ulong)
ENTRY2R1 (mpz_divisible_2exp_p, "mpz.divisible_2exp_p", np_mpz_divisible_2exp_p, Bool, mpz_ptr, mp_bitcnt_t)
ENTRY3R1 (mpz_congruent_p, "mpz.congruent_p", np_mpz_congruent_p, Bool, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R1 (mpz_congruent_ui_p, "mpz.congruent_ui_p", np_mpz_congruent_ui_p, Bool, mpz_ptr, ulong, ulong)
ENTRY3R1 (mpz_congruent_2exp_p, "mpz.congruent_2exp_p", np_mpz_congruent_2exp_p, Bool, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY4R0 (mpz_powm, "mpz.powm", np_mpz_powm, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4R0 (mpz_powm_ui, "mpz.powm_ui", np_mpz_powm_ui, mpz_ptr, mpz_ptr, ulong, mpz_ptr)
ENTRY4R0 (mpz_powm_sec, "mpz.powm_sec", np_mpz_powm_sec, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_pow_ui, "mpz.pow_ui", np_mpz_pow_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_ui_pow_ui, "mpz.ui_pow_ui", np_mpz_ui_pow_ui, mpz_ptr, ulong, ulong)
ENTRY3R1 (mpz_root, "mpz.root", np_mpz_root, Bool, mpz_ptr, mpz_ptr, ulong)
ENTRY4R0 (mpz_rootrem, "mpz.rootrem", np_mpz_rootrem, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2R0 (mpz_sqrt, "mpz.sqrt", np_mpz_sqrt, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_sqrtrem, "mpz.sqrtrem", np_mpz_sqrtrem, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY1R1 (mpz_perfect_power_p, "mpz.perfect_power_p", np_mpz_perfect_power_p, Bool, mpz_ptr)
ENTRY1R1 (mpz_perfect_square_p, "mpz.perfect_square_p", np_mpz_perfect_square_p, Bool, mpz_ptr)
ENTRY2R1 (mpz_probab_prime_p, "mpz.probab_prime_p", np_mpz_probab_prime_p, int, mpz_ptr, int)
ENTRY2R0 (mpz_nextprime, "mpz.nextprime", np_mpz_nextprime, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_gcd, "mpz.gcd", np_mpz_gcd, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R1 (mpz_gcd_ui, "mpz.gcd_ui", np_mpz_gcd_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY5R0 (mpz_gcdext, "mpz.gcdext", np_mpz_gcdext, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_lcm, "mpz.lcm", np_mpz_lcm, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_lcm_ui, "mpz.lcm_ui", np_mpz_lcm_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R1 (mpz_invert, "mpz.invert", np_mpz_invert, int, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_jacobi, "mpz.jacobi", np_mpz_jacobi, int, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_legendre, "mpz.legendre", np_mpz_legendre, int, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_kronecker, "mpz.kronecker", np_mpz_kronecker, int, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_kronecker_si, "mpz.kronecker_si", np_mpz_kronecker_si, int, mpz_ptr, long)
ENTRY2R1 (mpz_kronecker_ui, "mpz.kronecker_ui", np_mpz_kronecker_ui, int, mpz_ptr, ulong)
ENTRY2R1 (mpz_si_kronecker, "mpz.si_kronecker", np_mpz_si_kronecker, int, long, mpz_ptr)
ENTRY2R1 (mpz_ui_kronecker, "mpz.ui_kronecker", np_mpz_ui_kronecker, int, ulong, mpz_ptr)
ENTRY3R1 (mpz_remove, "mpz.remove", np_mpz_remove, mp_bitcnt_t, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2R0 (mpz_fac_ui, "mpz.fac_ui", np_mpz_fac_ui, mpz_ptr, ulong)
ENTRY3R0 (mpz_bin_ui, "mpz.bin_ui", np_mpz_bin_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3R0 (mpz_bin_uiui, "mpz.bin_uiui", np_mpz_bin_uiui, mpz_ptr, ulong, ulong)
ENTRY2R0 (mpz_fib_ui, "mpz.fib_ui", np_mpz_fib_ui, mpz_ptr, ulong)
ENTRY3R0 (mpz_fib2_ui, "mpz.fib2_ui", np_mpz_fib2_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2R0 (mpz_lucnum_ui, "mpz.lucnum_ui", np_mpz_lucnum_ui, mpz_ptr, ulong)
ENTRY3R0 (mpz_lucnum2_ui, "mpz.lucnum2_ui", np_mpz_lucnum2_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2R1 (mpz_cmp, "mpz.cmp", np_mpz_cmp, int, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_cmp_d, "mpz.cmp_d", np_mpz_cmp_d, int, mpz_ptr, double)
ENTRY2R1 (mpz_cmp_si, "mpz.cmp_si", np_mpz_cmp_si, int, mpz_ptr, long)
ENTRY2R1 (mpz_cmp_ui, "mpz.cmp_ui", np_mpz_cmp_ui, int, mpz_ptr, ulong)
ENTRY2R1 (mpz_cmpabs, "mpz.cmpabs", np_mpz_cmpabs, int, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_cmpabs_d, "mpz.cmpabs_d", np_mpz_cmpabs_d, int, mpz_ptr, double)
ENTRY2R1 (mpz_cmpabs_ui, "mpz.cmpabs_ui", np_mpz_cmpabs_ui, int, mpz_ptr, ulong)
ENTRY1R1 (mpz_sgn, "mpz.sgn", np_mpz_sgn, int, mpz_ptr)
ENTRY3R0 (mpz_and, "mpz.and", np_mpz_and, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_ior, "mpz.ior", np_mpz_ior, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3R0 (mpz_xor, "mpz.xor", np_mpz_xor, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2R0 (mpz_com, "mpz.com", np_mpz_com, mpz_ptr, mpz_ptr)
ENTRY1R1 (mpz_popcount, "mpz.popcount", np_mpz_popcount, mp_bitcnt_t, mpz_ptr)
ENTRY2R1 (mpz_hamdist, "mpz.hamdist", np_mpz_hamdist, mp_bitcnt_t, mpz_ptr, mpz_ptr)
ENTRY2R1 (mpz_scan0, "mpz.scan0", np_mpz_scan0, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2R1 (mpz_scan1, "mpz.scan1", np_mpz_scan1, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_setbit, "mpz.setbit", np_mpz_setbit, mpz_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_clrbit, "mpz.clrbit", np_mpz_clrbit, mpz_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_combit, "mpz.combit", np_mpz_combit, mpz_ptr, mp_bitcnt_t)
ENTRY2R1 (mpz_tstbit, "mpz.tstbit", np_mpz_tstbit, int, mpz_ptr, mp_bitcnt_t)
// mpz_out_str, mpz_inp_str, mpz_out_raw, mpz_inp_raw: not relevant to plugin.
#if NPGMP_RAND
ENTRY3R0 (mpz_urandomb, "mpz.urandomb", np_mpz_urandomb, mpz_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY3R0 (mpz_urandomm, "mpz.urandomm", np_mpz_urandomm, mpz_ptr, x_gmp_randstate_ptr, mpz_ptr)
ENTRY3R0 (mpz_rrandomb, "mpz.rrandomb", np_mpz_rrandomb, mpz_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY2R0 (mpz_random, "mpz.random", np_mpz_random, mpz_ptr, mp_size_t)
ENTRY2R0 (mpz_random2, "mpz.random2", np_mpz_random2, mpz_ptr, mp_size_t)
#endif  /* NPGMP_RAND */
// mpz_import, mpz_export: tricky to implmement with NPAPI.
ENTRY1R1 (mpz_fits_ulong_p, "mpz.fits_ulong_p", np_mpz_fits_ulong_p, Bool, mpz_ptr)
ENTRY1R1 (mpz_fits_slong_p, "mpz.fits_slong_p", np_mpz_fits_slong_p, Bool, mpz_ptr)
// mpz_fits_uint_p, mpz_fits_sint_p, mpz_fits_ushort_p, mpz_fits_sshort_p:
// C-specific; let us avoid gratuitous, non-portable exposure of C type sizes.
ENTRY1R1 (mpz_odd_p, "mpz.odd_p", np_mpz_odd_p, Bool, mpz_ptr)
ENTRY1R1 (mpz_even_p, "mpz.even_p", np_mpz_even_p, Bool, mpz_ptr)
ENTRY2R1 (mpz_sizeinbase, "mpz.sizeinbase", np_mpz_sizeinbase, size_t, mpz_ptr, int_2_to_62)
// mpz_array_init: tricky and unsuitable.
ENTRY2R0 (_mpz_realloc, "mpz._realloc", np__mpz_realloc, mpz_ptr, mp_size_t)
ENTRY2R1 (mpz_getlimbn, "mpz.getlimbn", np_mpz_getlimbn, mp_limb_t, mpz_ptr, mp_size_t)
ENTRY1R1 (mpz_size, "mpz.size", np_mpz_size, size_t, mpz_ptr)

#if NPGMP_MPQ
ENTRY1R0 (mpq_canonicalize, "mpq.canonicalize", np_mpq_canonicalize, mpq_ptr)
ENTRY0R1 (x_mpq, "mpq", np_mpq, npobj)
ENTRY1R1 (is_mpq, "mpq.is_mpq", np_is_mpq, Bool, Variant)
ENTRY1R0 (mpq_init, "mpq.init", np_mpq_init, uninit_mpq)
// mpq_inits: unimplemented.
ENTRY1R0 (mpq_init, "mpq.clear", np_mpq_clear, uninit_mpq)
// mpq_clears: unimplemented.
ENTRY2R0 (mpq_set, "mpq.set", np_mpq_set, mpq_ptr, mpq_ptr)
ENTRY2R0 (mpq_set_z, "mpq.set_z", np_mpq_set_z, mpq_ptr, mpz_ptr)
ENTRY3R0 (mpq_set_ui, "mpq.set_ui", np_mpq_set_ui, mpq_ptr, ulong, ulong)
ENTRY3R0 (mpq_set_si, "mpq.set_si", np_mpq_set_si, mpq_ptr, long, long)
ENTRY3R1 (mpq_set_str, "mpq.set_str", np_mpq_set_str, int, mpq_ptr, stringz, int_0_or_2_to_62)
ENTRY2R0 (mpq_swap, "mpq.swap", np_mpq_swap, mpq_ptr, mpq_ptr)
ENTRY1R1 (mpq_get_d, "mpq.get_d", np_mpq_get_d, double, mpq_ptr)
ENTRY2R0 (mpq_set_d, "mpq.set_d", np_mpq_set_d, mpq_ptr, double)
#if NPGMP_MPF
ENTRY2R0 (mpq_set_f, "mpq.set_f", np_mpq_set_f, mpq_ptr, mpf_ptr)
#endif
// mpq_get_str: C-specific; use numbers' toString method instead.
ENTRY3R0 (mpq_add, "mpq.add", np_mpq_add, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3R0 (mpq_sub, "mpq.sub", np_mpq_sub, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3R0 (mpq_mul, "mpq.mul", np_mpq_mul, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3R0 (mpq_mul_2exp, "mpq.mul_2exp", np_mpq_mul_2exp, mpq_ptr, mpq_ptr, mp_bitcnt_t)
ENTRY3R0 (mpq_div, "mpq.div", np_mpq_div, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3R0 (mpq_div_2exp, "mpq.div_2exp", np_mpq_div_2exp, mpq_ptr, mpq_ptr, mp_bitcnt_t)
ENTRY2R0 (mpq_neg, "mpq.neg", np_mpq_neg, mpq_ptr, mpq_ptr)
ENTRY2R0 (mpq_abs, "mpq.abs", np_mpq_abs, mpq_ptr, mpq_ptr)
ENTRY2R0 (mpq_inv, "mpq.inv", np_mpq_inv, mpq_ptr, mpq_ptr)
ENTRY2R1 (mpq_cmp, "mpq.cmp", np_mpq_cmp, int, mpq_ptr, mpq_ptr)
ENTRY3R1 (mpq_cmp_si, "mpq.cmp_si", np_mpq_cmp_si, int, mpq_ptr, long, long)
ENTRY3R1 (mpq_cmp_ui, "mpq.cmp_ui", np_mpq_cmp_ui, int, mpq_ptr, ulong, ulong)
ENTRY1R1 (mpq_sgn, "mpq.sgn", np_mpq_sgn, int, mpq_ptr)
ENTRY2R1 (mpq_equal, "mpq.equal", np_mpq_equal, int, mpq_ptr, mpq_ptr)
ENTRY1R1 (x_mpq_numref, "mpq.numref", np_mpq_numref, npobj, mpq_ptr)
ENTRY1R1 (x_mpq_denref, "mpq.denref", np_mpq_denref, npobj, mpq_ptr)
ENTRY2R0 (mpq_get_num, "mpq.get_num", np_mpq_get_num, mpz_ptr, mpq_ptr)
ENTRY2R0 (mpq_get_den, "mpq.get_den", np_mpq_get_den, mpz_ptr, mpq_ptr)
ENTRY2R0 (mpq_set_num, "mpq.set_num", np_mpq_set_num, mpq_ptr, mpz_ptr)
ENTRY2R0 (mpq_set_den, "mpq.set_den", np_mpq_set_den, mpq_ptr, mpz_ptr)
// mpq_out_str, mpq_inp_str: not relevant to plugin.
#endif  /* NPGMP_MPQ */

#if NPGMP_MPF
ENTRY1R0 (x_mpf_set_default_prec, "mpf.set_default_prec", np_mpf_set_default_prec, mp_bitcnt_t)
ENTRY0R1 (x_mpf_get_default_prec, "mpf.get_default_prec", np_mpf_get_default_prec, mp_bitcnt_t)
ENTRY0R1 (x_mpf, "mpf", np_mpf, npobj)
ENTRY1R1 (is_mpf, "mpf.is_mpf", np_is_mpf, Bool, Variant)
ENTRY1R0 (x_mpf_init, "mpf.init", np_mpf_init, defprec_mpf)
ENTRY2R0 (mpf_init2, "mpf.init2", np_mpf_init2, uninit_mpf, mp_bitcnt_t)
// mpf_inits: unimplemented.
ENTRY1R0 (x_mpf_clear, "mpf.clear", np_mpf_clear, uninit_mpf)
// mpf_clears: unimplemented.
ENTRY1R1 (mpf_get_prec, "mpf.get_prec", np_mpf_get_prec, mp_bitcnt_t, mpf_ptr)
ENTRY2R0 (x_mpf_set_prec, "mpf.set_prec", np_mpf_set_prec, mpf_ptr, mp_bitcnt_t)
ENTRY2R0 (x_mpf_set_prec_raw, "mpf.set_prec_raw", np_mpf_set_prec_raw, mpf_ptr, mp_bitcnt_t)
ENTRY2R0 (mpf_set, "mpf.set", np_mpf_set, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_set_ui, "mpf.set_ui", np_mpf_set_ui, mpf_ptr, ulong)
ENTRY2R0 (mpf_set_si, "mpf.set_si", np_mpf_set_si, mpf_ptr, long)
ENTRY2R0 (mpf_set_d, "mpf.set_d", np_mpf_set_d, mpf_ptr, double)
ENTRY2R0 (mpf_set_z, "mpf.set_z", np_mpf_set_z, mpf_ptr, mpz_ptr)
#if NPGMP_MPQ
ENTRY2R0 (mpf_set_q, "mpf.set_q", np_mpf_set_q, mpf_ptr, mpq_ptr)
#endif
ENTRY3R1 (mpf_set_str, "mpf.set_str", np_mpf_set_str, int, mpf_ptr, stringz, int_abs_2_to_62)
ENTRY2R0 (mpf_swap, "mpf.swap", np_mpf_swap, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_set, "mpf.init_set", np_mpf_init_set, defprec_mpf, mpf_ptr)
ENTRY2R0 (mpf_set_ui, "mpf.init_set_ui", np_mpf_init_set_ui, defprec_mpf, ulong)
ENTRY2R0 (mpf_set_si, "mpf.init_set_si", np_mpf_init_set_si, defprec_mpf, long)
ENTRY2R0 (mpf_set_d, "mpf.init_set_d", np_mpf_init_set_d, defprec_mpf, double)
ENTRY3R1 (mpf_set_str, "mpf.init_set_str", np_mpf_init_set_str, int, defprec_mpf, stringz, int_abs_2_to_62)
ENTRY1R1 (mpf_get_d, "mpf.get_d", np_mpf_get_d, double, mpf_ptr)
// Usage: var a = mpf_get_d_2exp(x), d = a[0], exp = a[1];
ENTRY1R2 (mpf_get_d_2exp, "mpf.get_d_2exp", np_mpf_get_d_2exp, double, long, mpf_ptr)
ENTRY1R1 (mpf_get_si, "mpf.get_si", np_mpf_get_si, long, mpf_ptr)
ENTRY1R1 (mpf_get_ui, "mpf.get_ui", np_mpf_get_ui, ulong, mpf_ptr)
// Usage: var a = mpf_get_str(base,n_digits,x), fraction = a[0], exp = a[1];
ENTRY3R2 (x_mpf_get_str, "mpf.get_str", np_mpf_get_str, npstring, mp_exp_t, output_base, size_t, mpf_ptr)
ENTRY3R0 (mpf_add, "mpf.add", np_mpf_add, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3R0 (mpf_add_ui, "mpf.add_ui", np_mpf_add_ui, mpf_ptr, mpf_ptr, ulong)
ENTRY3R0 (mpf_sub, "mpf.sub", np_mpf_sub, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3R0 (mpf_ui_sub, "mpf.ui_sub", np_mpf_ui_sub, mpf_ptr, ulong, mpf_ptr)
ENTRY3R0 (mpf_sub_ui, "mpf.sub_ui", np_mpf_sub_ui, mpf_ptr, mpf_ptr, ulong)
ENTRY3R0 (mpf_mul, "mpf.mul", np_mpf_mul, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3R0 (mpf_mul_ui, "mpf.mul_ui", np_mpf_mul_ui, mpf_ptr, mpf_ptr, ulong)
ENTRY3R0 (mpf_div, "mpf.div", np_mpf_div, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3R0 (mpf_ui_div, "mpf.ui_div", np_mpf_ui_div, mpf_ptr, ulong, mpf_ptr)
ENTRY3R0 (mpf_div_ui, "mpf.div_ui", np_mpf_div_ui, mpf_ptr, mpf_ptr, ulong)
ENTRY2R0 (mpf_sqrt, "mpf.sqrt", np_mpf_sqrt, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_sqrt_ui, "mpf.sqrt_ui", np_mpf_sqrt_ui, mpf_ptr, ulong)
ENTRY3R0 (mpf_pow_ui, "mpf.pow_ui", np_mpf_pow_ui, mpf_ptr, mpf_ptr, ulong)
ENTRY2R0 (mpf_neg, "mpf.neg", np_mpf_neg, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_abs, "mpf.abs", np_mpf_abs, mpf_ptr, mpf_ptr)
ENTRY3R0 (mpf_mul_2exp, "mpf.mul_2exp", np_mpf_mul_2exp, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY3R0 (mpf_div_2exp, "mpf.div_2exp", np_mpf_div_2exp, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY2R1 (mpf_cmp, "mpf.cmp", np_mpf_cmp, int, mpf_ptr, mpf_ptr)
ENTRY2R1 (mpf_cmp_d, "mpf.cmp_d", np_mpf_cmp_d, int, mpf_ptr, double)
ENTRY2R1 (mpf_cmp_ui, "mpf.cmp_ui", np_mpf_cmp_ui, int, mpf_ptr, ulong)
ENTRY2R1 (mpf_cmp_si, "mpf.cmp_si", np_mpf_cmp_si, int, mpf_ptr, long)
ENTRY3R1 (mpf_eq, "mpf.eq", np_mpf_eq, int, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY3R0 (mpf_reldiff, "mpf.reldiff", np_mpf_reldiff, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY1R1 (mpf_sgn, "mpf.sgn", np_mpf_sgn, int, mpf_ptr)
// mpf_out_str, mpf_inp_str: not relevant to plugin.
ENTRY2R0 (mpf_ceil, "mpf.ceil", np_mpf_ceil, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_floor, "mpf.floor", np_mpf_floor, mpf_ptr, mpf_ptr)
ENTRY2R0 (mpf_trunc, "mpf.trunc", np_mpf_trunc, mpf_ptr, mpf_ptr)
ENTRY1R1 (mpf_integer_p, "mpf.integer_p", np_mpf_integer_p, Bool, mpf_ptr)
ENTRY1R1 (mpf_fits_ulong_p, "mpf.fits_ulong_p", np_mpf_fits_ulong_p, Bool, mpf_ptr)
ENTRY1R1 (mpf_fits_slong_p, "mpf.fits_slong_p", np_mpf_fits_slong_p, Bool, mpf_ptr)
// mpf_fits_uint_p, mpf_fits_sint_p, mpf_fits_ushort_p, mpf_fits_sshort_p:
// C-specific; let us avoid gratuitous, non-portable exposure of C type sizes.
#if NPGMP_RAND
ENTRY3R0 (mpf_urandomb, "mpf.urandomb", np_mpf_urandomb, mpf_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY3R0 (mpf_random2, "mpf.random2", np_mpf_random2, mpf_ptr, mp_size_t, mp_exp_t)
#endif  /* NPGMP_RAND */
#endif  /* NPGMP_MPF */

// mpn functions: unimplemented, not very suitable for plugins.

#if NPGMP_RAND
ENTRY0R1 (x_randstate, "gmp.randstate", np_gmp_randstate, npobj)
ENTRY1R1 (is_randstate, "gmp.randstate.is_randstate", np_is_randstate, Bool, Variant)
ENTRY1R0 (gmp_randinit_default, "gmp.randinit_default", np_gmp_randinit_default, uninit_rand)
ENTRY1R0 (gmp_randinit_mt, "gmp.randinit_mt", np_gmp_randinit_mt, uninit_rand)
ENTRY4R0 (gmp_randinit_lc_2exp, "gmp.randinit_lc_2exp", np_gmp_randinit_lc_2exp, uninit_rand, mpz_ptr, ulong, mp_bitcnt_t)
ENTRY2R1 (x_randinit_lc_2exp_size, "gmp.randinit_lc_2exp_size", np_gmp_randinit_lc_2exp_size, int, uninit_rand, mp_bitcnt_t)
ENTRY2R0 (gmp_randinit_set, "gmp.randinit_set", np_gmp_randinit_set, uninit_rand, x_gmp_randstate_ptr)
// gmp_randinit: obsolete and variadic.
ENTRY1R0 (gmp_randinit_default, "gmp.randclear", np_gmp_randclear, uninit_rand)
ENTRY2R0 (gmp_randseed, "gmp.randseed", np_gmp_randseed, x_gmp_randstate_ptr, mpz_ptr)
ENTRY2R0 (gmp_randseed_ui, "gmp.randseed_ui", np_gmp_randseed_ui, x_gmp_randstate_ptr, ulong)
ENTRY2R1 (gmp_urandomb_ui, "gmp.urandomb_ui", np_gmp_urandomb_ui, ulong, x_gmp_randstate_ptr, ulong)
ENTRY2R1 (gmp_urandomm_ui, "gmp.urandomm_ui", np_gmp_urandomm_ui, ulong, x_gmp_randstate_ptr, ulong)
#endif  /* NPGMP_RAND */

// gmp_printf, gmp_scanf, and friends: something similar would be nice.
// mp_set_memory_functions, mp_get_memory_functions: not relevant to plugin.

#if NPGMP_SCRIPT && 0  /* XXX this belongs on an object other than lib.gmp.  */
// vector(arg...) and makeVector(k, fill) shall reject any argument that
// is a JavaScript container.  This should prevent reference loops.
// Vector (i.e. Tuple) will implement invokeDefault as the replacement for
// Run_invokeDefault.
ENTRY0R1 (fn_vector, "vector", np_vector, vector)
ENTRY2R1 (fn_makeVector, "makeVector", np_makeVector, vector, size_t, npvar)
ENTRY3R1 (fn_subvector "subvector", np_subvector, vector, vector, size_t, size_t)
ENTRY1R1 (fn_copy, "copy", np_copy, vector, vector)
#if 0
/* In scripts, ops are called implicitly, without a subsequent call op,
   and an argument of type stack is passed implicitly.  */
ENTRY2R1 (op_get, "get", np_get, npobj, npid)
ENTRY3R1 (op_put, "put", np_put, npvar, npobj, npid, npvar)
ENTRY2R1 (op_delete, "delete", np_delete, npvar, npobj, npid)
ENTRY2R1 (op_has, "has", np_has, Bool, npobj, npid)
ENTRY1R1 (op_keys, "keys", np_keys, vector, npobj)
ENTRY1R1 (op_length, "length", np_length, size_t, vector)
// stack: vector plus allocated size.
ENTRY2R0 (op_roll, "roll", np_roll, stack, size_t)
ENTRY2R1 (op_pick, "pick", np_pick, npvar, stack, size_t)
ENTRY1R0 (op_drop, "drop", np_drop, stack)
ENTRY1R1 (op_dump, "dump", np_dump, vector, stack)
// npfixed: function with a valid length property.
ENTRY2R0 (op_call, "call", np_call, stack, npfixed)
ENTRY2R1 (op_apply, "apply", np_apply, vector, npfunc, vector)
ENTRY1R0 (op_goto, "goto", np_goto, vector)
// thread: vector supporting get/put/delete of string keys other than length.
ENTRY0R1 (op_here, "here", np_here, thread)
ENTRY1R1 (op_yield, "yield", np_yield, npvar, stack)
// XXX arithmetic ops...
#endif
#endif  /* NPGMP_SCRIPT */

#undef ENTRY
#undef ENTRY0
#undef ENTRY1
#undef ENTRY2
#undef ENTRY3
#undef ENTRY4
#undef ENTRY5
#undef ENTRYR0
#undef ENTRYR1
#undef ENTRYR2
#undef ENTRY0R1
#undef ENTRY1R0
#undef ENTRY1R1
#undef ENTRY1R2
#undef ENTRY2R0
#undef ENTRY2R1
#undef ENTRY3R0
#undef ENTRY3R1
#undef ENTRY3R2
#undef ENTRY4R0
#undef ENTRY4R1
#undef ENTRY5R0
#undef ENTRY_GET_FIRST
