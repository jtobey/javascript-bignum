/* gmp-entries.h: header private to gmp-plugin.c.
   C macros as IDL for libgmp.

   Copyright(C) 2012 John Tobey, see ../LICENCE

   TO DO:
      mpz_init_set_str - maybe
      mpz_get_d_2exp
      mpz_import - maybe
      mpz_export - maybe
      mpf_set_default_prec - maybe, as compile-time option
      mpf_set_prec_raw - maybe
      mpf_init_set_str - maybe
      mpf_get_d_2exp
      mpf_get_str - maybe
      gmp_randinit_lc_2exp_size

   NOT TO DO:
      mpz_get_str - use toString method
      mpz_out_str
      mpz_inp_str
      mpz_out_raw
      mpz_inp_raw
      mpz_fits_uint_p
      mpz_fits_sint_p
      mpz_fits_ushort_p
      mpz_fits_sshort_p
      mpz_array_init
      mpq_get_str - use toString method
      mpq_out_str
      mpq_inp_str
      mpf_out_str
      mpf_inp_str
      mpf_fits_uint_p
      mpf_fits_sint_p
      mpf_fits_ushort_p
      mpf_fits_sshort_p
      mpn* - probably not
      gmp_randinit - obsolete
      gmp_*printf - possibly with libffi
      gmp_*scanf - possibly with libffi
      BSD compatibility functions - probably not
      mp_set_memory_functions
      mp_get_memory_functions

   DONE: every remaining function and macro in the GMP v5.0.4 manual.
*/

#ifndef ENTRY
# define ENTRY(__string, __id)
#endif

#ifndef ENTRY1
# define ENTRY0(__name, __string, __id, __r) ENTRY (__string, __id)
# define ENTRY1(__name, __string, __id, __r, __t0) ENTRY (__string, __id)
# define ENTRY2(__name, __string, __id, __r, __t0, __t1) ENTRY (__string, __id)
# define ENTRY3(__name, __string, __id, __r, __t0, __t1, __t2) \
    ENTRY (__string, __id)
# define ENTRY4(__name, __string, __id, __r, __t0, __t1, __t2, __t3) \
    ENTRY (__string, __id)
# define ENTRY5(__name, __string, __id, __r, __t0, __t1, __t2, __t3, __t4) \
    ENTRY (__string, __id)
#endif

// http://gmplib.org/manual/Integer-Functions.html

ENTRY1(mpz_init, "mpz_init", np_mpz_init, new_mpz, new_mpz)
// mpz_inits: C-specific.
ENTRY2(mpz_init2, "mpz_init2", np_mpz_init2, new_mpz, new_mpz, mp_bitcnt_t)
// mpz_clear: called automatically.
// mpz_clears: C-specific.
ENTRY2(mpz_realloc2, "mpz_realloc2", np_mpz_realloc2, void, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_set, "mpz_set", np_mpz_set, void, mpz_ptr, mpz_ptr)
ENTRY2(mpz_set_ui, "mpz_set_ui", np_mpz_set_ui, void, mpz_ptr, ulong)
ENTRY2(mpz_set_si, "mpz_set_si", np_mpz_set_si, void, mpz_ptr, long)
ENTRY2(mpz_set_d, "mpz_set_d", np_mpz_set_d, void, mpz_ptr, double)
ENTRY2(mpz_set_q, "mpz_set_q", np_mpz_set_q, void, mpz_ptr, mpq_ptr)
ENTRY2(mpz_set_f, "mpz_set_f", np_mpz_set_f, void, mpz_ptr, mpf_ptr)
ENTRY3(mpz_set_str, "mpz_set_str", np_mpz_set_str, int, mpz_ptr, stringz, int_0_or_2_to_62)
ENTRY2(mpz_swap, "mpz_swap", np_mpz_swap, void, mpz_ptr, mpz_ptr)
ENTRY2(mpz_init_set, "mpz_init_set", np_mpz_init_set, new_mpz, new_mpz, mpz_ptr)
ENTRY2(mpz_init_set_ui, "mpz_init_set_ui", np_mpz_init_set_ui, new_mpz, new_mpz, ulong)
ENTRY2(mpz_init_set_si, "mpz_init_set_si", np_mpz_init_set_si, new_mpz, new_mpz, long)
ENTRY2(mpz_init_set_d, "mpz_init_set_d", np_mpz_init_set_d, new_mpz, new_mpz, double)
//ENTRY3(x_mpz_init_set_str, "mpz_init_set_str", np_mpz_init_set_str, new_mpz, new_mpz, stringz, int_0_or_2_to_62)
ENTRY1(mpz_get_ui, "mpz_get_ui", np_mpz_get_ui, ulong, mpz_ptr)
ENTRY1(mpz_get_si, "mpz_get_si", np_mpz_get_si, long, mpz_ptr)
ENTRY1(mpz_get_d, "mpz_get_d", np_mpz_get_d, double, mpz_ptr)
// mpz_get_d_2exp: would return two values; meanwhile, perhaps mpz_size + mpz_tdiv_q_2exp + mpz_get_d comes close enough.
// mpz_get_str: C-specific; use integers' toString method instead.
ENTRY3(mpz_add, "mpz_add", np_mpz_add, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_add_ui, "mpz_add_ui", np_mpz_add_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_sub, "mpz_sub", np_mpz_sub, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_sub_ui, "mpz_sub_ui", np_mpz_sub_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_ui_sub, "mpz_ui_sub", np_mpz_ui_sub, void, mpz_ptr, ulong, mpz_ptr)
ENTRY3(mpz_mul, "mpz_mul", np_mpz_mul, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_mul_si, "mpz_mul_si", np_mpz_mul_si, void, mpz_ptr, mpz_ptr, long)
ENTRY3(mpz_mul_ui, "mpz_mul_ui", np_mpz_mul_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_addmul, "mpz_addmul", np_mpz_addmul, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_addmul_ui, "mpz_addmul_ui", np_mpz_addmul_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_submul, "mpz_submul", np_mpz_submul, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_submul_ui, "mpz_submul_ui", np_mpz_submul_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_mul_2exp, "mpz_mul_2exp", np_mpz_mul_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_neg, "mpz_neg", np_mpz_neg, void, mpz_ptr, mpz_ptr)
ENTRY2(mpz_abs, "mpz_abs", np_mpz_abs, void, mpz_ptr, mpz_ptr)
ENTRY3(mpz_cdiv_q, "mpz_cdiv_q", np_mpz_cdiv_q, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_cdiv_r, "mpz_cdiv_r", np_mpz_cdiv_r, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4(mpz_cdiv_qr, "mpz_cdiv_qr", np_mpz_cdiv_qr, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_cdiv_q_ui, "mpz_cdiv_q_ui", np_mpz_cdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_cdiv_r_ui, "mpz_cdiv_r_ui", np_mpz_cdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_cdiv_qr_ui, "mpz_cdiv_qr_ui", np_mpz_cdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_cdiv_ui, "mpz_cdiv_ui", np_mpz_cdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3(mpz_cdiv_q_2exp, "mpz_cdiv_q_2exp", np_mpz_cdiv_q_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_cdiv_r_2exp, "mpz_cdiv_r_2exp", np_mpz_cdiv_r_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_fdiv_q, "mpz_fdiv_q", np_mpz_fdiv_q, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_fdiv_r, "mpz_fdiv_r", np_mpz_fdiv_r, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4(mpz_fdiv_qr, "mpz_fdiv_qr", np_mpz_fdiv_qr, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_fdiv_q_ui, "mpz_fdiv_q_ui", np_mpz_fdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_fdiv_r_ui, "mpz_fdiv_r_ui", np_mpz_fdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_fdiv_qr_ui, "mpz_fdiv_qr_ui", np_mpz_fdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_fdiv_ui, "mpz_fdiv_ui", np_mpz_fdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3(mpz_fdiv_q_2exp, "mpz_fdiv_q_2exp", np_mpz_fdiv_q_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_fdiv_r_2exp, "mpz_fdiv_r_2exp", np_mpz_fdiv_r_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_tdiv_q, "mpz_tdiv_q", np_mpz_tdiv_q, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_tdiv_r, "mpz_tdiv_r", np_mpz_tdiv_r, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4(mpz_tdiv_qr, "mpz_tdiv_qr", np_mpz_tdiv_qr, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_tdiv_q_ui, "mpz_tdiv_q_ui", np_mpz_tdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_tdiv_r_ui, "mpz_tdiv_r_ui", np_mpz_tdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_tdiv_qr_ui, "mpz_tdiv_qr_ui", np_mpz_tdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_tdiv_ui, "mpz_tdiv_ui", np_mpz_tdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3(mpz_tdiv_q_2exp, "mpz_tdiv_q_2exp", np_mpz_tdiv_q_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_tdiv_r_2exp, "mpz_tdiv_r_2exp", np_mpz_tdiv_r_2exp, void, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_mod, "mpz_mod", np_mpz_mod, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_mod_ui, "mpz_mod_ui", np_mpz_mod_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_divexact, "mpz_divexact", np_mpz_divexact, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_divexact_ui, "mpz_divexact_ui", np_mpz_divexact_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_divisible_p, "mpz_divisible_p", np_mpz_divisible_p, bool, mpz_ptr, mpz_ptr)
ENTRY2(mpz_divisible_ui_p, "mpz_divisible_ui_p", np_mpz_divisible_ui_p, bool, mpz_ptr, ulong)
ENTRY2(mpz_divisible_2exp_p, "mpz_divisible_2exp_p", np_mpz_divisible_2exp_p, bool, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_congruent_p, "mpz_congruent_p", np_mpz_congruent_p, bool, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_congruent_ui_p, "mpz_congruent_ui_p", np_mpz_congruent_ui_p, bool, mpz_ptr, ulong, ulong)
ENTRY3(mpz_congruent_2exp_p, "mpz_congruent_2exp_p", np_mpz_congruent_2exp_p, bool, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY4(mpz_powm, "mpz_powm", np_mpz_powm, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4(mpz_powm_ui, "mpz_powm_ui", np_mpz_powm_ui, void, mpz_ptr, mpz_ptr, ulong, mpz_ptr)
ENTRY4(mpz_powm_sec, "mpz_powm_sec", np_mpz_powm_sec, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_pow_ui, "mpz_pow_ui", np_mpz_pow_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_ui_pow_ui, "mpz_ui_pow_ui", np_mpz_ui_pow_ui, void, mpz_ptr, ulong, ulong)
ENTRY3(mpz_root, "mpz_root", np_mpz_root, bool, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_rootrem, "mpz_rootrem", np_mpz_rootrem, void, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_sqrt, "mpz_sqrt", np_mpz_sqrt, void, mpz_ptr, mpz_ptr)
ENTRY3(mpz_sqrtrem, "mpz_sqrtrem", np_mpz_sqrtrem, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY1(mpz_perfect_power_p, "mpz_perfect_power_p", np_mpz_perfect_power_p, bool, mpz_ptr)
ENTRY1(mpz_perfect_square_p, "mpz_perfect_square_p", np_mpz_perfect_square_p, bool, mpz_ptr)
ENTRY2(mpz_probab_prime_p, "mpz_probab_prime_p", np_mpz_probab_prime_p, int, mpz_ptr, int)
ENTRY2(mpz_nextprime, "mpz_nextprime", np_mpz_nextprime, void, mpz_ptr, mpz_ptr)
ENTRY3(mpz_gcd, "mpz_gcd", np_mpz_gcd, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_gcd_ui, "mpz_gcd_ui", np_mpz_gcd_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY5(mpz_gcdext, "mpz_gcdext", np_mpz_gcdext, void, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_lcm, "mpz_lcm", np_mpz_lcm, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_lcm_ui, "mpz_lcm_ui", np_mpz_lcm_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_invert, "mpz_invert", np_mpz_invert, int, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2(mpz_jacobi, "mpz_jacobi", np_mpz_jacobi, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_legendre, "mpz_legendre", np_mpz_legendre, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_kronecker, "mpz_kronecker", np_mpz_kronecker, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_kronecker_si, "mpz_kronecker_si", np_mpz_kronecker_si, int, mpz_ptr, long)
ENTRY2(mpz_kronecker_ui, "mpz_kronecker_ui", np_mpz_kronecker_ui, int, mpz_ptr, ulong)
ENTRY2(mpz_si_kronecker, "mpz_si_kronecker", np_mpz_si_kronecker, int, long, mpz_ptr)
ENTRY2(mpz_ui_kronecker, "mpz_ui_kronecker", np_mpz_ui_kronecker, int, ulong, mpz_ptr)
ENTRY3(mpz_remove, "mpz_remove", np_mpz_remove, mp_bitcnt_t, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2(mpz_fac_ui, "mpz_fac_ui", np_mpz_fac_ui, void, mpz_ptr, ulong)
ENTRY3(mpz_bin_ui, "mpz_bin_ui", np_mpz_bin_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_bin_uiui, "mpz_bin_uiui", np_mpz_bin_uiui, void, mpz_ptr, ulong, ulong)
ENTRY2(mpz_fib_ui, "mpz_fib_ui", np_mpz_fib_ui, void, mpz_ptr, ulong)
ENTRY3(mpz_fib2_ui, "mpz_fib2_ui", np_mpz_fib2_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_lucnum_ui, "mpz_lucnum_ui", np_mpz_lucnum_ui, void, mpz_ptr, ulong)
ENTRY3(mpz_lucnum2_ui, "mpz_lucnum2_ui", np_mpz_lucnum2_ui, void, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_cmp, "mpz_cmp", np_mpz_cmp, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_cmp_d, "mpz_cmp_d", np_mpz_cmp_d, int, mpz_ptr, double)
ENTRY2(mpz_cmp_si, "mpz_cmp_si", np_mpz_cmp_si, int, mpz_ptr, long)
ENTRY2(mpz_cmp_ui, "mpz_cmp_ui", np_mpz_cmp_ui, int, mpz_ptr, ulong)
ENTRY2(mpz_cmpabs, "mpz_cmpabs", np_mpz_cmpabs, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_cmpabs_d, "mpz_cmpabs_d", np_mpz_cmpabs_d, int, mpz_ptr, double)
ENTRY2(mpz_cmpabs_ui, "mpz_cmpabs_ui", np_mpz_cmpabs_ui, int, mpz_ptr, ulong)
ENTRY1(mpz_sgn, "mpz_sgn", np_mpz_sgn, int, mpz_ptr)
ENTRY3(mpz_and, "mpz_and", np_mpz_and, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_ior, "mpz_ior", np_mpz_ior, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_xor, "mpz_xor", np_mpz_xor, void, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2(mpz_com, "mpz_com", np_mpz_com, void, mpz_ptr, mpz_ptr)
ENTRY1(mpz_popcount, "mpz_popcount", np_mpz_popcount, mp_bitcnt_t, mpz_ptr)
ENTRY2(mpz_hamdist, "mpz_hamdist", np_mpz_hamdist, mp_bitcnt_t, mpz_ptr, mpz_ptr)
ENTRY2(mpz_scan0, "mpz_scan0", np_mpz_scan0, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_scan1, "mpz_scan1", np_mpz_scan1, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_setbit, "mpz_setbit", np_mpz_setbit, void, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_clrbit, "mpz_clrbit", np_mpz_clrbit, void, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_combit, "mpz_combit", np_mpz_combit, void, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_tstbit, "mpz_tstbit", np_mpz_tstbit, int, mpz_ptr, mp_bitcnt_t)
// mpz_out_str, mpz_inp_str, mpz_out_raw, mpz_inp_raw: not relevant to plugin.
ENTRY3(mpz_urandomb, "mpz_urandomb", np_mpz_urandomb, void, mpz_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY3(mpz_urandomm, "mpz_urandomm", np_mpz_urandomm, void, mpz_ptr, x_gmp_randstate_ptr, mpz_ptr)
ENTRY3(mpz_rrandomb, "mpz_rrandomb", np_mpz_rrandomb, void, mpz_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY2(mpz_random, "mpz_random", np_mpz_random, void, mpz_ptr, mp_size_t)
ENTRY2(mpz_random2, "mpz_random2", np_mpz_random2, void, mpz_ptr, mp_size_t)
// mpz_import, mpz_export: tricky to implmement with NPAPI.
ENTRY1(mpz_fits_ulong_p, "mpz_fits_ulong_p", np_mpz_fits_ulong_p, bool, mpz_ptr)
ENTRY1(mpz_fits_slong_p, "mpz_fits_slong_p", np_mpz_fits_slong_p, bool, mpz_ptr)
// mpz_fits_uint_p, mpz_fits_sint_p, mpz_fits_ushort_p, mpz_fits_sshort_p:
// C-specific; let us avoid gratuitous, non-portable exposure of C type sizes.
ENTRY1(mpz_odd_p, "mpz_odd_p", np_mpz_odd_p, bool, mpz_ptr)
ENTRY1(mpz_even_p, "mpz_even_p", np_mpz_even_p, bool, mpz_ptr)
ENTRY2(mpz_sizeinbase, "mpz_sizeinbase", np_mpz_sizeinbase, size_t, mpz_ptr, int_2_to_62)
// mpz_array_init: tricky and unsuitable.
ENTRY2(_mpz_realloc, "_mpz_realloc", np__mpz_realloc, void, mpz_ptr, mp_size_t)
ENTRY2(mpz_getlimbn, "mpz_getlimbn", np_mpz_getlimbn, mp_limb_t, mpz_ptr, mp_size_t)
ENTRY1(mpz_size, "mpz_size", np_mpz_size, size_t, mpz_ptr)

ENTRY1(mpq_canonicalize, "mpq_canonicalize", np_mpq_canonicalize, void, mpq_ptr)
ENTRY1(mpq_init, "mpq_init", np_mpq_init, new_mpq, new_mpq)
// mpq_inits: C-specific.
// mpq_clear: called automatically.
// mpq_clears: C-specific.
ENTRY2(mpq_set, "mpq_set", np_mpq_set, void, mpq_ptr, mpq_ptr)
ENTRY2(mpq_set_z, "mpq_set_z", np_mpq_set_z, void, mpq_ptr, mpz_ptr)
ENTRY3(mpq_set_ui, "mpq_set_ui", np_mpq_set_ui, void, mpq_ptr, ulong, ulong)
ENTRY3(mpq_set_si, "mpq_set_si", np_mpq_set_si, void, mpq_ptr, long, long)
ENTRY3(mpq_set_str, "mpq_set_str", np_mpq_set_str, int, mpq_ptr, stringz, int_0_or_2_to_62)
ENTRY2(mpq_swap, "mpq_swap", np_mpq_swap, void, mpq_ptr, mpq_ptr)
ENTRY1(mpq_get_d, "mpq_get_d", np_mpq_get_d, double, mpq_ptr)
ENTRY2(mpq_set_d, "mpq_set_d", np_mpq_set_d, void, mpq_ptr, double)
ENTRY2(mpq_set_f, "mpq_set_f", np_mpq_set_f, void, mpq_ptr, mpf_ptr)
// mpq_get_str: C-specific; use numbers' toString method instead.
ENTRY3(mpq_add, "mpq_add", np_mpq_add, void, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3(mpq_sub, "mpq_sub", np_mpq_sub, void, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3(mpq_mul, "mpq_mul", np_mpq_mul, void, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3(mpq_mul_2exp, "mpq_mul_2exp", np_mpq_mul_2exp, void, mpq_ptr, mpq_ptr, mp_bitcnt_t)
ENTRY3(mpq_div, "mpq_div", np_mpq_div, void, mpq_ptr, mpq_ptr, mpq_ptr)
ENTRY3(mpq_div_2exp, "mpq_div_2exp", np_mpq_div_2exp, void, mpq_ptr, mpq_ptr, mp_bitcnt_t)
ENTRY2(mpq_neg, "mpq_neg", np_mpq_neg, void, mpq_ptr, mpq_ptr)
ENTRY2(mpq_abs, "mpq_abs", np_mpq_abs, void, mpq_ptr, mpq_ptr)
ENTRY2(mpq_inv, "mpq_inv", np_mpq_inv, void, mpq_ptr, mpq_ptr)
ENTRY2(mpq_cmp, "mpq_cmp", np_mpq_cmp, int, mpq_ptr, mpq_ptr)
ENTRY3(mpq_cmp_si, "mpq_cmp_si", np_mpq_cmp_si, int, mpq_ptr, long, long)
ENTRY3(mpq_cmp_ui, "mpq_cmp_ui", np_mpq_cmp_ui, int, mpq_ptr, ulong, ulong)
ENTRY1(mpq_sgn, "mpq_sgn", np_mpq_sgn, int, mpq_ptr)
ENTRY2(mpq_equal, "mpq_equal", np_mpq_equal, int, mpq_ptr, mpq_ptr)
ENTRY2(x_mpq_numref, "mpq_numref", np_mpq_numref, new_mpzref, new_mpzref, mpq_ptr)
ENTRY2(x_mpq_denref, "mpq_denref", np_mpq_denref, new_mpzref, new_mpzref, mpq_ptr)
ENTRY2(mpq_get_num, "mpq_get_num", np_mpq_get_num, void, mpz_ptr, mpq_ptr)
ENTRY2(mpq_get_den, "mpq_get_den", np_mpq_get_den, void, mpz_ptr, mpq_ptr)
ENTRY2(mpq_set_num, "mpq_set_num", np_mpq_set_num, void, mpq_ptr, mpz_ptr)
ENTRY2(mpq_set_den, "mpq_set_den", np_mpq_set_den, void, mpq_ptr, mpz_ptr)
// mpq_out_str, mpq_inp_str: not relevant to plugin.

// mpf_set_default_prec: not suitable for plugin use.
ENTRY0(mpf_get_default_prec, "mpf_get_default_prec", np_mpf_get_default_prec, mp_bitcnt_t)
ENTRY1(mpf_init, "mpf_init", np_mpf_init, new_mpf, new_mpf)
ENTRY2(mpf_init2, "mpf_init2", np_mpf_init2, new_mpf, new_mpf, mp_bitcnt_t)
// mpf_inits: C-specific.
// mpf_clear: called automatically.
// mpf_clears: C-specific.
ENTRY1(mpf_get_prec, "mpf_get_prec", np_mpf_get_prec, mp_bitcnt_t, mpf_ptr)
ENTRY2(mpf_set_prec, "mpf_set_prec", np_mpf_set_prec, void, mpf_ptr, mp_bitcnt_t)
// mpf_set_prec_raw: requires some design thought.
ENTRY2(mpf_set, "mpf_set", np_mpf_set, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_set_ui, "mpf_set_ui", np_mpf_set_ui, void, mpf_ptr, ulong)
ENTRY2(mpf_set_si, "mpf_set_si", np_mpf_set_si, void, mpf_ptr, long)
ENTRY2(mpf_set_d, "mpf_set_d", np_mpf_set_d, void, mpf_ptr, double)
ENTRY2(mpf_set_z, "mpf_set_z", np_mpf_set_z, void, mpf_ptr, mpz_ptr)
ENTRY2(mpf_set_q, "mpf_set_q", np_mpf_set_q, void, mpf_ptr, mpq_ptr)
ENTRY3(mpf_set_str, "mpf_set_str", np_mpf_set_str, int, mpf_ptr, stringz, int_abs_2_to_62)
ENTRY2(mpf_swap, "mpf_swap", np_mpf_swap, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_init_set, "mpf_init_set", np_mpf_init_set, new_mpf, new_mpf, mpf_ptr)
ENTRY2(mpf_init_set_ui, "mpf_init_set_ui", np_mpf_init_set_ui, new_mpf, new_mpf, ulong)
ENTRY2(mpf_init_set_si, "mpf_init_set_si", np_mpf_init_set_si, new_mpf, new_mpf, long)
ENTRY2(mpf_init_set_d, "mpf_init_set_d", np_mpf_init_set_d, new_mpf, new_mpf, double)
// mpf_init_set_str: would return two values; use mpf_init2 + mpf_set_str.
ENTRY1(mpf_get_d, "mpf_get_d", np_mpf_get_d, double, mpf_ptr)
// mpf_get_d_2exp: XXX would return two values
ENTRY1(mpf_get_si, "mpf_get_si", np_mpf_get_si, long, mpf_ptr)
ENTRY1(mpf_get_ui, "mpf_get_ui", np_mpf_get_ui, ulong, mpf_ptr)
// mpf_get_str: use toString method.
ENTRY3(mpf_add, "mpf_add", np_mpf_add, void, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3(mpf_add_ui, "mpf_add_ui", np_mpf_add_ui, void, mpf_ptr, mpf_ptr, ulong)
ENTRY3(mpf_sub, "mpf_sub", np_mpf_sub, void, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3(mpf_ui_sub, "mpf_ui_sub", np_mpf_ui_sub, void, mpf_ptr, ulong, mpf_ptr)
ENTRY3(mpf_sub_ui, "mpf_sub_ui", np_mpf_sub_ui, void, mpf_ptr, mpf_ptr, ulong)
ENTRY3(mpf_mul, "mpf_mul", np_mpf_mul, void, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3(mpf_mul_ui, "mpf_mul_ui", np_mpf_mul_ui, void, mpf_ptr, mpf_ptr, ulong)
ENTRY3(mpf_div, "mpf_div", np_mpf_div, void, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY3(mpf_ui_div, "mpf_ui_div", np_mpf_ui_div, void, mpf_ptr, ulong, mpf_ptr)
ENTRY3(mpf_div_ui, "mpf_div_ui", np_mpf_div_ui, void, mpf_ptr, mpf_ptr, ulong)
ENTRY2(mpf_sqrt, "mpf_sqrt", np_mpf_sqrt, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_sqrt_ui, "mpf_sqrt_ui", np_mpf_sqrt_ui, void, mpf_ptr, ulong)
ENTRY3(mpf_pow_ui, "mpf_pow_ui", np_mpf_pow_ui, void, mpf_ptr, mpf_ptr, ulong)
ENTRY2(mpf_neg, "mpf_neg", np_mpf_neg, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_abs, "mpf_abs", np_mpf_abs, void, mpf_ptr, mpf_ptr)
ENTRY3(mpf_mul_2exp, "mpf_mul_2exp", np_mpf_mul_2exp, void, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY3(mpf_div_2exp, "mpf_div_2exp", np_mpf_div_2exp, void, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY2(mpf_cmp, "mpf_cmp", np_mpf_cmp, int, mpf_ptr, mpf_ptr)
ENTRY2(mpf_cmp_d, "mpf_cmp_d", np_mpf_cmp_d, int, mpf_ptr, double)
ENTRY2(mpf_cmp_ui, "mpf_cmp_ui", np_mpf_cmp_ui, int, mpf_ptr, ulong)
ENTRY2(mpf_cmp_si, "mpf_cmp_si", np_mpf_cmp_si, int, mpf_ptr, long)
ENTRY3(mpf_eq, "mpf_eq", np_mpf_eq, int, mpf_ptr, mpf_ptr, mp_bitcnt_t)
ENTRY3(mpf_reldiff, "mpf_reldiff", np_mpf_reldiff, void, mpf_ptr, mpf_ptr, mpf_ptr)
ENTRY1(mpf_sgn, "mpf_sgn", np_mpf_sgn, int, mpf_ptr)
// mpf_out_str, mpf_inp_str: not relevant to plugin.
ENTRY2(mpf_ceil, "mpf_ceil", np_mpf_ceil, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_floor, "mpf_floor", np_mpf_floor, void, mpf_ptr, mpf_ptr)
ENTRY2(mpf_trunc, "mpf_trunc", np_mpf_trunc, void, mpf_ptr, mpf_ptr)
ENTRY1(mpf_integer_p, "mpf_integer_p", np_mpf_integer_p, bool, mpf_ptr)
ENTRY1(mpf_fits_ulong_p, "mpf_fits_ulong_p", np_mpf_fits_ulong_p, bool, mpf_ptr)
ENTRY1(mpf_fits_slong_p, "mpf_fits_slong_p", np_mpf_fits_slong_p, bool, mpf_ptr)
// mpf_fits_uint_p, mpf_fits_sint_p, mpf_fits_ushort_p, mpf_fits_sshort_p:
// C-specific; let us avoid gratuitous, non-portable exposure of C type sizes.
ENTRY3(mpf_urandomb, "mpf_urandomb", np_mpf_urandomb, void, mpf_ptr, x_gmp_randstate_ptr, mp_bitcnt_t)
ENTRY3(mpf_random2, "mpf_random2", np_mpf_random2, void, mpf_ptr, mp_size_t, mp_exp_t)

// mpn functions: unimplemented, not very suitable for plugins.

ENTRY1(gmp_randinit_default, "gmp_randinit_default", np_gmp_randinit_default, new_rand, new_rand)
ENTRY1(gmp_randinit_mt, "gmp_randinit_mt", np_gmp_randinit_mt, new_rand, new_rand)
ENTRY4(gmp_randinit_lc_2exp, "gmp_randinit_lc_2exp", np_gmp_randinit_lc_2exp, new_rand, new_rand, mpz_ptr, ulong, mp_bitcnt_t)
//ENTRY2(gmp_randinit_lc_2exp_size, "gmp_randinit_lc_2exp_size", np_gmp_randinit_lc_2exp_size, int/new_rand, new_rand, mp_bitcnt_t)
ENTRY2(gmp_randinit_set, "gmp_randinit_set", np_gmp_randinit_set, new_rand, new_rand, x_gmp_randstate_ptr)
// gmp_randinit: obsolete and variadic.
// gmp_randclear: called automatically.
ENTRY2(gmp_randseed, "gmp_randseed", np_gmp_randseed, void, x_gmp_randstate_ptr, mpz_ptr)
ENTRY2(gmp_randseed_ui, "gmp_randseed_ui", np_gmp_randseed_ui, void, x_gmp_randstate_ptr, ulong)
ENTRY2(gmp_urandomb_ui, "gmp_urandomb_ui", np_gmp_urandomb_ui, ulong, x_gmp_randstate_ptr, ulong)
ENTRY2(gmp_urandomm_ui, "gmp_urandomm_ui", np_gmp_urandomm_ui, ulong, x_gmp_randstate_ptr, ulong)

// gmp_printf, gmp_scanf, and friends: something similar would be nice.
// mp_set_memory_functions, mp_get_memory_functions: not relevant to plugin.

#undef ENTRY
#undef ENTRY0
#undef ENTRY1
#undef ENTRY2
#undef ENTRY3
#undef ENTRY4
#undef ENTRY5
