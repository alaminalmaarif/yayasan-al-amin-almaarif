-- Izinkan Infak menggunakan sumber pemotongan saldo yang sama dengan SPP/Kegiatan.
-- Jika sumber = mandatory/voluntary, transaksi dari wali murid diselesaikan langsung
-- sebagai pemotongan saldo (tanpa QRIS). Jika none, tetap melalui QRIS.

alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduction_type_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduction_type_check
  check (deduction_source = 'none' or payment_type in ('SPP','Kegiatan','Infak'));

alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduct_mandatory_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduct_mandatory_check
  check (deduct_mandatory = false or payment_type in ('SPP','Kegiatan','Infak'));
