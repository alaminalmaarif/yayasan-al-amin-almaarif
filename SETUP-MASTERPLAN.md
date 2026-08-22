# Implementasi Masterplan Yayasan Al-Amin

ZIP ini mempertahankan website, Dashboard, dan Arsip yang sudah berjalan, lalu menambahkan fondasi aplikasi, PIN upload, pembayaran, rekap, import PPDB, dan unit KB/MTs/MA.

## 1. Unit

Seluruh komponen utama memakai 8 unit:

- KB
- RA
- TPQ
- MDT
- Pesantren
- Majelis Taklim
- MTs
- MA

KB/MTs/MA sudah disiapkan di struktur data. Form PPDB untuk ketiganya ditandai belum tersedia sampai Google Form resmi dibuat.

## 2. PIN upload guru

Aplikasi: `app.html` → Upload Foto → PIN → Foto Kegiatan / Foto Prestasi.

PIN tidak ditulis di frontend. Deploy Supabase Edge Function `verify-upload-pin`, lalu set secret:

`UPLOAD_PIN=PIN_YANG_DIPILIH_YAYASAN`

Catatan: link upload lama tetap dipertahankan agar sistem lama tidak rusak. PIN pada aplikasi menjadi gerbang akses fitur upload di aplikasi. Jika ingin memblokir akses langsung ke URL upload, ubah upload Cloudinary menjadi signed upload atau tambahkan gate server-side pada endpoint upload.

## 3. Pembayaran

Backend berada di:

- `supabase/functions/create-payment`
- `supabase/functions/midtrans-webhook`
- `supabase/functions/payment-report`
- `supabase/migrations/20260820_masterplan.sql`

Set Supabase secrets:

- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `MIDTRANS_ENV` = `sandbox` untuk pengujian atau `production` untuk live
- `SUPABASE_SERVICE_ROLE_KEY` (tersedia sebagai secret/service role di project)
- `ADMIN_EMAILS` = email admin Dashboard yang boleh melihat rekap, dipisahkan koma jika lebih dari satu

Set notification URL di Midtrans ke:

`https://gtqvuymhtdfpnvlyzdun.supabase.co/functions/v1/midtrans-webhook`

Jalankan migration lalu deploy Edge Functions. Setelah itu fitur Pembayaran di `app.html` dapat membuat transaksi Snap dan menerima pembayaran melalui metode yang disediakan Midtrans pada akun yayasan.

## 4. Rekap bendahara

Dashboard → `pembayaran.html` menampilkan transaksi dan menyediakan Download CSV.

Akses dilindungi oleh Supabase Auth + daftar `ADMIN_EMAILS` pada Edge Function.

## 5. PPDB → Arsip Siswa

`/arsip` sekarang memiliki tombol `Import PPDB → Siswa`.

Alurnya:

1. Hubungkan Google akun Yayasan.
2. Klik Import PPDB.
3. Masukkan ID Spreadsheet response Google Form.
4. Masukkan nama sheet response.
5. Pilih unit tujuan.
6. Sistem membaca header Google Form, memetakan nama/NIK/NISN/data dasar, mengecek duplikasi, lalu menambahkan siswa baru ke sheet `Siswa` unit tersebut.

Ini sengaja dibuat berbasis spreadsheet response supaya tidak mengubah Google Form yang sudah berjalan.

## 6. Arsip dan unit baru

Perubahan struktur Arsip bersifat additive. Jika root Arsip lama sudah ada dan KB/MTs/MA belum tersedia, tombol `Siapkan Struktur Arsip Google` akan menambahkan unit/folder/sheet yang hilang ke root lama, bukan membuat root arsip baru.

## 7. Android

Sumber aplikasi Android ada di `android-app/`.

Aplikasi membuka `app.html` memakai Android Custom Tabs sehingga login Supabase dan Google OAuth tetap menggunakan browser yang mendukung OAuth.

Buka folder `android-app` dengan Android Studio → Gradle Sync → Build APK(s).

Untuk Play Store, lanjutkan konfigurasi signing/release, ikon, screenshot, privacy policy, dan Play Console sesuai akun developer yayasan.

## 8. Hal yang sengaja tidak diubah

- Supabase Auth Dashboard.
- Struktur data kegiatan Dashboard.
- Google Drive/Sheets Arsip yang sudah ada.
- Cloudinary Foto Kegiatan.
- Cloudinary Foto Prestasi.
- Google Form PPDB yang sudah ada.
- Website publik yang sudah berjalan.

Perubahan pada bagian tersebut dibuat additive agar versi lama tetap dapat digunakan selama modul baru belum dikonfigurasi.
