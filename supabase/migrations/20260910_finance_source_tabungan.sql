-- Allow public wali-murid payments that are settled directly from savings.
-- Existing sources remain compatible; 'tabungan' identifies deductions from
-- Tabungan Wajib/Tabungan Sukarela instead of QRIS or manual cash entry.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_source_check;

alter table public.finance_transactions
  add constraint finance_transactions_source_check
  check (source in ('manual','qris','tabungan'));
