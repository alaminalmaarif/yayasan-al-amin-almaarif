-- Sumber pemotongan saldo untuk SPP dan Kegiatan.
-- Tiga pilihan: none, mandatory (Tabungan Wajib), voluntary (Tabungan Sukarela).
-- Transaksi lama tetap kompatibel: deduct_mandatory=true dipetakan ke mandatory.

alter table public.finance_transactions
  add column if not exists deduction_source text default 'none';

update public.finance_transactions
set deduction_source = case
  when deduct_mandatory = true then 'mandatory'
  else 'none'
end
where deduction_source is null or deduction_source = 'none';

alter table public.finance_transactions
  alter column deduction_source set default 'none';
alter table public.finance_transactions
  alter column deduction_source set not null;

alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduction_source_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduction_source_check
  check (deduction_source in ('none','mandatory','voluntary'));

alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduction_type_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduction_type_check
  check (deduction_source = 'none' or payment_type in ('SPP','Kegiatan'));

-- Kolom legacy tetap dipertahankan untuk kompatibilitas dengan data lama:
-- true hanya berarti sumber pemotongan adalah Tabungan Wajib.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduct_mandatory_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduct_mandatory_check
  check (deduct_mandatory = false or payment_type in ('SPP','Kegiatan'));

-- Sinkronisasi kedua kolom: deduct_mandatory=true hanya untuk deduction_source=mandatory.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_deduction_source_legacy_check;
alter table public.finance_transactions
  add constraint finance_transactions_deduction_source_legacy_check
  check ((deduction_source = 'mandatory') = deduct_mandatory);

-- Infak tidak memakai payment_status, sehingga NULL harus diperbolehkan.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_payment_status_check;
alter table public.finance_transactions
  add constraint finance_transactions_payment_status_check
  check (
    payment_type in ('Tabungan Wajib','Tabungan Sukarela','Bantuan','Infak')
    or payment_status in ('Lunas','Cicil','Lunasi Cicilan')
  );

-- Pastikan payment_type Infak tetap tersedia meskipun migration Infak sebelumnya
-- belum sempat diterapkan pada environment lama.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_payment_type_check;
alter table public.finance_transactions
  add constraint finance_transactions_payment_type_check
  check (payment_type in ('Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Bantuan','Infak'));
