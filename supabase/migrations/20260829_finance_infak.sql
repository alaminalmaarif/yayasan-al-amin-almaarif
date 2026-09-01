-- Allow the renamed payment type "Infak" while preserving legacy "Bantuan" rows.
ALTER TABLE public.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_payment_type_check;

ALTER TABLE public.finance_transactions
  ADD CONSTRAINT finance_transactions_payment_type_check
  CHECK (payment_type IN ('Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Bantuan','Infak'));
