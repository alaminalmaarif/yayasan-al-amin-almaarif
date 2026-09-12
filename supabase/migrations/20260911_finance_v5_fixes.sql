-- v5: finalise the three targeted finance fixes.
alter table public.finance_transactions add column if not exists deduction_source text default 'none';
alter table public.finance_transactions alter column deduction_source set default 'none';
update public.finance_transactions set deduction_source=case when deduct_mandatory=true then 'mandatory' else coalesce(deduction_source,'none') end where deduction_source is null;
alter table public.finance_transactions alter column deduction_source set not null;
alter table public.finance_transactions drop constraint if exists finance_transactions_deduction_source_check;
alter table public.finance_transactions add constraint finance_transactions_deduction_source_check check (deduction_source in ('none','mandatory','voluntary'));
alter table public.finance_transactions drop constraint if exists finance_transactions_deduction_type_check;
alter table public.finance_transactions add constraint finance_transactions_deduction_type_check check (deduction_source='none' or payment_type in ('SPP','Kegiatan','Infak'));
alter table public.finance_transactions drop constraint if exists finance_transactions_deduct_mandatory_check;
alter table public.finance_transactions add constraint finance_transactions_deduct_mandatory_check check (deduct_mandatory=false or payment_type in ('SPP','Kegiatan','Infak'));
alter table public.finance_transactions drop constraint if exists finance_transactions_deduction_source_legacy_check;
alter table public.finance_transactions add constraint finance_transactions_deduction_source_legacy_check check ((deduction_source='mandatory') = deduct_mandatory);
alter table public.finance_transactions drop constraint if exists finance_transactions_payment_status_check;
alter table public.finance_transactions add constraint finance_transactions_payment_status_check check (payment_type in ('Tabungan Wajib','Tabungan Sukarela','Bantuan','Infak') or payment_status in ('Lunas','Cicil','Lunasi Cicilan'));
alter table public.finance_transactions drop constraint if exists finance_transactions_payment_type_check;
alter table public.finance_transactions add constraint finance_transactions_payment_type_check check (payment_type in ('Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Bantuan','Infak'));
alter table public.finance_transactions drop constraint if exists finance_transactions_source_check;
alter table public.finance_transactions add constraint finance_transactions_source_check check (source in ('manual','qris','tabungan'));
