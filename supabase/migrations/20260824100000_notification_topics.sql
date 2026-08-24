-- Upgrade untuk proyek yang sudah menjalankan migrasi notifikasi sebelumnya.
-- Menjaga topik FCM hanya pada daftar target yang didukung dashboard.
alter table public.notifications
  drop constraint if exists notifications_topic_check;

alter table public.notifications
  add constraint notifications_topic_check
  check (topic in ('all', 'kb', 'ra', 'tpq', 'mdt', 'pesantren', 'mts', 'ma'));
