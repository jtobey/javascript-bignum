/* gmp-constants.h: header private to gmp-plugin.c.
   C macros as IDL for libgmp.

   Copyright(C) 2012 John Tobey, see ../LICENCE
*/

#ifndef ENTRY
# define ENTRY(__string, __id)
#endif
#ifndef ENTRY1
# define ENTRY1(__name, __string, __id, __r, __t0) ENTRY (__string, __id)
# define ENTRY2v(__name, __string, __id, __t0, __t1) ENTRY (__string, __id)
# define ENTRY2(__name, __string, __id, __r, __t0, __t1) ENTRY (__string, __id)
# define ENTRY3v(__name, __string, __id, __t0, __t1, __t2) \
    ENTRY (__string, __id)
# define ENTRY3(__name, __string, __id, __r, __t0, __t1, __t2) \
    ENTRY (__string, __id)
# define ENTRY4v(__name, __string, __id, __t0, __t1, __t2, __t3) \
    ENTRY (__string, __id)
# define ENTRY4(__name, __string, __id, __r, __t0, __t1, __t2, __t3) \
    ENTRY (__string, __id)
# define ENTRY5v(__name, __string, __id, __t0, __t1, __t2, __t3, __t4)  \
    ENTRY (__string, __id)
#endif

// http://gmplib.org/manual/Integer-Functions.html

// mpz() - allocates, initializes to 0, and returns an integer,
// arranging to call mpz_clear on deallocation.
ENTRY("mpz", ID_mpz)
// mpz_init*, mpz_clear*: C-specific.
ENTRY2v(mpz_realloc2, "mpz_realloc2", ID_mpz_realloc2, mpz_ptr, mp_bitcnt_t)
ENTRY2v(mpz_set, "mpz_set", ID_mpz_set, mpz_ptr, mpz_ptr)
ENTRY2v(mpz_set_ui, "mpz_set_ui", ID_mpz_set_ui, mpz_ptr, ulong)
ENTRY2v(mpz_set_si, "mpz_set_si", ID_mpz_set_si, mpz_ptr, long)
ENTRY2v(mpz_set_d, "mpz_set_d", ID_mpz_set_d, mpz_ptr, double)
//ENTRY2v(mpz_set_q, "mpz_set_q", ID_mpz_set_q, mpz_ptr, mpq_ptr)
//ENTRY2v(mpz_set_f, "mpz_set_f", ID_mpz_set_f, mpz_ptr, mpf_ptr)
// mpz_init_set*: C-specific.
ENTRY3v(mpz_set_str, "mpz_set_str", ID_mpz_set_str, mpz_ptr, stringz, int_0_or_2_to_62)
ENTRY2v(mpz_swap, "mpz_swap", ID_mpz_swap, mpz_ptr, mpz_ptr)
ENTRY1(mpz_get_ui, "mpz_get_ui", ID_mpz_get_ui, ulong, mpz_ptr)
ENTRY1(mpz_get_si, "mpz_get_si", ID_mpz_get_si, long, mpz_ptr)
ENTRY1(mpz_get_d, "mpz_get_d", ID_mpz_get_d, double, mpz_ptr)
// mpz_get_d_2exp: implementable using mpz_size, mpz_tdiv_q_2exp, mpz_get_d.
// mpz_get_str: implemented as integer objects' toString method.
ENTRY3v(mpz_add, "mpz_add", ID_mpz_add, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_add_ui, "mpz_add_ui", ID_mpz_add_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_sub, "mpz_sub", ID_mpz_sub, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_sub_ui, "mpz_sub_ui", ID_mpz_sub_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_ui_sub, "mpz_ui_sub", ID_mpz_ui_sub, mpz_ptr, ulong, mpz_ptr)
ENTRY3v(mpz_mul, "mpz_mul", ID_mpz_mul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_mul_si, "mpz_mul_si", ID_mpz_mul_si, mpz_ptr, mpz_ptr, long)
ENTRY3v(mpz_mul_ui, "mpz_mul_ui", ID_mpz_mul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_addmul, "mpz_addmul", ID_mpz_addmul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_addmul_ui, "mpz_addmul_ui", ID_mpz_addmul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_submul, "mpz_submul", ID_mpz_submul, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_submul_ui, "mpz_submul_ui", ID_mpz_submul_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_mul_2exp, "mpz_mul_2exp", ID_mpz_mul_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY2v(mpz_neg, "mpz_neg", ID_mpz_neg, mpz_ptr, mpz_ptr)
ENTRY2v(mpz_abs, "mpz_abs", ID_mpz_abs, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_cdiv_q, "mpz_cdiv_q", ID_mpz_cdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_cdiv_r, "mpz_cdiv_r", ID_mpz_cdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4v(mpz_cdiv_qr, "mpz_cdiv_qr", ID_mpz_cdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_cdiv_q_ui, "mpz_cdiv_q_ui", ID_mpz_cdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_cdiv_r_ui, "mpz_cdiv_r_ui", ID_mpz_cdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_cdiv_qr_ui, "mpz_cdiv_qr_ui", ID_mpz_cdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_cdiv_ui, "mpz_cdiv_ui", ID_mpz_cdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3v(mpz_cdiv_q_2exp, "mpz_cdiv_q_2exp", ID_mpz_cdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_cdiv_r_2exp, "mpz_cdiv_r_2exp", ID_mpz_cdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_fdiv_q, "mpz_fdiv_q", ID_mpz_fdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_fdiv_r, "mpz_fdiv_r", ID_mpz_fdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4v(mpz_fdiv_qr, "mpz_fdiv_qr", ID_mpz_fdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_fdiv_q_ui, "mpz_fdiv_q_ui", ID_mpz_fdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_fdiv_r_ui, "mpz_fdiv_r_ui", ID_mpz_fdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_fdiv_qr_ui, "mpz_fdiv_qr_ui", ID_mpz_fdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_fdiv_ui, "mpz_fdiv_ui", ID_mpz_fdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3v(mpz_fdiv_q_2exp, "mpz_fdiv_q_2exp", ID_mpz_fdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_fdiv_r_2exp, "mpz_fdiv_r_2exp", ID_mpz_fdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_tdiv_q, "mpz_tdiv_q", ID_mpz_tdiv_q, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_tdiv_r, "mpz_tdiv_r", ID_mpz_tdiv_r, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4v(mpz_tdiv_qr, "mpz_tdiv_qr", ID_mpz_tdiv_qr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_tdiv_q_ui, "mpz_tdiv_q_ui", ID_mpz_tdiv_q_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_tdiv_r_ui, "mpz_tdiv_r_ui", ID_mpz_tdiv_r_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY4(mpz_tdiv_qr_ui, "mpz_tdiv_qr_ui", ID_mpz_tdiv_qr_ui, ulong, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_tdiv_ui, "mpz_tdiv_ui", ID_mpz_tdiv_ui, ulong, mpz_ptr, ulong)
ENTRY3v(mpz_tdiv_q_2exp, "mpz_tdiv_q_2exp", ID_mpz_tdiv_q_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_tdiv_r_2exp, "mpz_tdiv_r_2exp", ID_mpz_tdiv_r_2exp, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY3v(mpz_mod, "mpz_mod", ID_mpz_mod, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_mod_ui, "mpz_mod_ui", ID_mpz_mod_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_divexact, "mpz_divexact", ID_mpz_divexact, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_divexact_ui, "mpz_divexact_ui", ID_mpz_divexact_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_divisible_p, "mpz_divisible_p", ID_mpz_divisible_p, bool, mpz_ptr, mpz_ptr)
ENTRY2(mpz_divisible_ui_p, "mpz_divisible_ui_p", ID_mpz_divisible_ui_p, bool, mpz_ptr, ulong)
ENTRY2(mpz_divisible_2exp_p, "mpz_divisible_2exp_p", ID_mpz_divisible_2exp_p, bool, mpz_ptr, mp_bitcnt_t)
ENTRY3(mpz_congruent_p, "mpz_congruent_p", ID_mpz_congruent_p, bool, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_congruent_ui_p, "mpz_congruent_ui_p", ID_mpz_congruent_ui_p, bool, mpz_ptr, ulong, ulong)
ENTRY3(mpz_congruent_2exp_p, "mpz_congruent_2exp_p", ID_mpz_congruent_2exp_p, bool, mpz_ptr, mpz_ptr, mp_bitcnt_t)
ENTRY4v(mpz_powm, "mpz_powm", ID_mpz_powm, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY4v(mpz_powm_ui, "mpz_powm_ui", ID_mpz_powm_ui, mpz_ptr, mpz_ptr, ulong, mpz_ptr)
ENTRY4v(mpz_powm_sec, "mpz_powm_sec", ID_mpz_powm_sec, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_pow_ui, "mpz_pow_ui", ID_mpz_pow_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_ui_pow_ui, "mpz_ui_pow_ui", ID_mpz_ui_pow_ui, mpz_ptr, ulong, ulong)
ENTRY3(mpz_root, "mpz_root", ID_mpz_root, bool, mpz_ptr, mpz_ptr, ulong)
ENTRY4v(mpz_rootrem, "mpz_rootrem", ID_mpz_rootrem, mpz_ptr, mpz_ptr, mpz_ptr, ulong)
ENTRY2v(mpz_sqrt, "mpz_sqrt", ID_mpz_sqrt, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_sqrtrem, "mpz_sqrtrem", ID_mpz_sqrtrem, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY1(mpz_perfect_power_p, "mpz_perfect_power_p", ID_mpz_perfect_power_p, bool, mpz_ptr)
ENTRY1(mpz_perfect_square_p, "mpz_perfect_square_p", ID_mpz_perfect_square_p, bool, mpz_ptr)
ENTRY2(mpz_probab_prime_p, "mpz_probab_prime_p", ID_mpz_probab_prime_p, int, mpz_ptr, int)
ENTRY2v(mpz_nextprime, "mpz_nextprime", ID_mpz_nextprime, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_gcd, "mpz_gcd", ID_mpz_gcd, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3(mpz_gcd_ui, "mpz_gcd_ui", ID_mpz_gcd_ui, ulong, mpz_ptr, mpz_ptr, ulong)
ENTRY5v(mpz_gcdext, "mpz_gcdext", ID_mpz_gcdext, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_lcm, "mpz_lcm", ID_mpz_lcm, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_lcm_ui, "mpz_lcm_ui", ID_mpz_lcm_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3(mpz_invert, "mpz_invert", ID_mpz_invert, int, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2(mpz_jacobi, "mpz_jacobi", ID_mpz_jacobi, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_legendre, "mpz_legendre", ID_mpz_legendre, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_kronecker, "mpz_kronecker", ID_mpz_kronecker, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_kronecker_si, "mpz_kronecker_si", ID_mpz_kronecker_si, int, mpz_ptr, long)
ENTRY2(mpz_kronecker_ui, "mpz_kronecker_ui", ID_mpz_kronecker_ui, int, mpz_ptr, ulong)
ENTRY2(mpz_si_kronecker, "mpz_si_kronecker", ID_mpz_si_kronecker, int, long, mpz_ptr)
ENTRY2(mpz_ui_kronecker, "mpz_ui_kronecker", ID_mpz_ui_kronecker, int, ulong, mpz_ptr)
ENTRY3(mpz_remove, "mpz_remove", ID_mpz_remove, mp_bitcnt_t, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2v(mpz_fac_ui, "mpz_fac_ui", ID_mpz_fac_ui, mpz_ptr, ulong)
ENTRY3v(mpz_bin_ui, "mpz_bin_ui", ID_mpz_bin_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY3v(mpz_bin_uiui, "mpz_bin_uiui", ID_mpz_bin_uiui, mpz_ptr, ulong, ulong)
ENTRY2v(mpz_fib_ui, "mpz_fib_ui", ID_mpz_fib_ui, mpz_ptr, ulong)
ENTRY3v(mpz_fib2_ui, "mpz_fib2_ui", ID_mpz_fib2_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2v(mpz_lucnum_ui, "mpz_lucnum_ui", ID_mpz_lucnum_ui, mpz_ptr, ulong)
ENTRY3v(mpz_lucnum2_ui, "mpz_lucnum2_ui", ID_mpz_lucnum2_ui, mpz_ptr, mpz_ptr, ulong)
ENTRY2(mpz_cmp, "mpz_cmp", ID_mpz_cmp, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_cmp_d, "mpz_cmp_d", ID_mpz_cmp_d, int, mpz_ptr, double)
ENTRY2(mpz_cmp_si, "mpz_cmp_si", ID_mpz_cmp_si, int, mpz_ptr, long)
ENTRY2(mpz_cmp_ui, "mpz_cmp_ui", ID_mpz_cmp_ui, int, mpz_ptr, ulong)
ENTRY2(mpz_cmpabs, "mpz_cmpabs", ID_mpz_cmpabs, int, mpz_ptr, mpz_ptr)
ENTRY2(mpz_cmpabs_d, "mpz_cmpabs_d", ID_mpz_cmpabs_d, int, mpz_ptr, double)
ENTRY2(mpz_cmpabs_ui, "mpz_cmpabs_ui", ID_mpz_cmpabs_ui, int, mpz_ptr, ulong)
ENTRY1(mpz_sgn, "mpz_sgn", ID_mpz_sgn, int, mpz_ptr)
ENTRY3v(mpz_and, "mpz_and", ID_mpz_and, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_ior, "mpz_ior", ID_mpz_ior, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY3v(mpz_xor, "mpz_xor", ID_mpz_xor, mpz_ptr, mpz_ptr, mpz_ptr)
ENTRY2v(mpz_com, "mpz_com", ID_mpz_com, mpz_ptr, mpz_ptr)
ENTRY1(mpz_popcount, "mpz_popcount", ID_mpz_popcount, mp_bitcnt_t, mpz_ptr)
ENTRY2(mpz_hamdist, "mpz_hamdist", ID_mpz_hamdist, mp_bitcnt_t, mpz_ptr, mpz_ptr)
ENTRY2(mpz_scan0, "mpz_scan0", ID_mpz_scan0, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_scan1, "mpz_scan1", ID_mpz_scan1, mp_bitcnt_t, mpz_ptr, mp_bitcnt_t)
ENTRY2v(mpz_setbit, "mpz_setbit", ID_mpz_setbit, mpz_ptr, mp_bitcnt_t)
ENTRY2v(mpz_clrbit, "mpz_clrbit", ID_mpz_clrbit, mpz_ptr, mp_bitcnt_t)
ENTRY2v(mpz_combit, "mpz_combit", ID_mpz_combit, mpz_ptr, mp_bitcnt_t)
ENTRY2(mpz_tstbit, "mpz_tstbit", ID_mpz_tstbit, int, mpz_ptr, mp_bitcnt_t)
// mpz_out_str, mpz_inp_str, mpz_out_raw, mpz_inp_raw: not relevant to plugin.
//ENTRY3v(mpz_urandomb, "mpz_urandomb", ID_mpz_urandomb, mpz_ptr, gmp_randstate_ptr, mp_bitcnt_t)
//ENTRY3v(mpz_urandomb, "mpz_urandomm", ID_mpz_urandomb, mpz_ptr, gmp_randstate_ptr, mpz_ptr)
//ENTRY3v(mpz_urandomb, "mpz_rrandomb", ID_mpz_urandomb, mpz_ptr, gmp_randstate_ptr, mp_bitcnt_t)
// mpz_import, mpz_export: not relevant to plugin.
ENTRY1(mpz_fits_ulong_p, "mpz_fits_ulong_p", ID_mpz_fits_ulong_p, bool, mpz_ptr)
ENTRY1(mpz_fits_slong_p, "mpz_fits_slong_p", ID_mpz_fits_slong_p, bool, mpz_ptr)
// mpz_fits_uint_p, mpz_fits_sint_p, mpz_fits_ushort_p, mpz_fits_sshort_p:
// C-specific.
ENTRY1(mpz_odd_p, "mpz_odd_p", ID_mpz_odd_p, bool, mpz_ptr)
ENTRY1(mpz_even_p, "mpz_even_p", ID_mpz_even_p, bool, mpz_ptr)
ENTRY2(mpz_sizeinbase, "mpz_sizeinbase", ID_mpz_sizeinbase, size_t, mpz_ptr, int_2_to_62)
// mpz_array_init: C-specific.
//ENTRY2v(_mpz_realloc, "_mpz_realloc", ID__mpz_realloc, mpz_ptr, mp_size_t)
//ENTRY2(mpz_getlimbn, "mpz_getlimbn", ID_mpz_getlimbn, mp_limb_t, mpz_ptr, mp_size_t)
ENTRY1(mpz_size, "mpz_size", ID_mpz_size, size_t, mpz_ptr)

// XXX mpq, mpf, gmp_randstate, mpfr.

#undef ENTRY
#undef ENTRY1
#undef ENTRY2v
#undef ENTRY2
#undef ENTRY3v
#undef ENTRY3
#undef ENTRY4v
#undef ENTRY4
#undef ENTRY5v
