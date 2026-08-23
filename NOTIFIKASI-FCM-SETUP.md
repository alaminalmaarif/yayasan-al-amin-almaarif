# Notifikasi HP Wali Murid

Kode Android sudah memakai Firebase Cloud Messaging (FCM). Saat aplikasi pertama dibuka, pengguna diminta mengizinkan notifikasi lalu otomatis berlangganan topik `all`. Panel Dashboard dapat mengirim pengumuman langsung ke topik tersebut.

## Yang tidak boleh masuk GitHub

File service-account Firebase mengandung private key. Jangan salin file ini ke proyek, ZIP, atau GitHub.

## Deploy Supabase

1. Jalankan migrasi `supabase/migrations/20260824_notifications.sql`.
2. Deploy fungsi `send-notification`.
3. Simpan secret server berikut di Supabase:

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<isi JSON service-account dalam satu baris>
ADMIN_NOTIFICATION_EMAILS=<email admin Dashboard, dapat lebih dari satu dipisahkan koma>
```

Contoh perintah (jangan menaruh private key di riwayat shell bersama):

```text
supabase secrets set ADMIN_NOTIFICATION_EMAILS=admin@contoh.sch.id
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='<isi-file-service-account-json>'
supabase functions deploy send-notification
```

Pastikan Firebase Cloud Messaging API (HTTP v1) aktif pada proyek Firebase.

## Build APK

`android-app/app/google-services.json` sudah ditempatkan dari konfigurasi Firebase. Build APK dari Android Studio atau:

```text
gradlew.bat assembleDebug
```

## Pengujian

1. Instal APK baru pada HP uji dan pilih **Izinkan** saat diminta notifikasi.
2. Login ke Dashboard memakai email yang ada pada `ADMIN_NOTIFICATION_EMAILS`.
3. Isi panel **Kirim Notifikasi Wali Murid** dan tekan kirim.
4. Notifikasi akan muncul di bar notifikasi HP uji.

Notifikasi versi ini dikirim langsung ke seluruh pengguna yang mengizinkan notifikasi. Penjadwalan H-1 belum diaktifkan; itu memerlukan scheduler server terpisah agar fungsi tetap berjalan saat Dashboard tertutup.
