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

## 3. Pembayaran QRIS dan Rekap Keuangan

Pembayaran baru menggunakan QRIS statis Yayasan dan tidak lagi membuat QR melalui Midtrans.

Komponen baru:

- `supabase/functions/create-payment`
- `supabase/functions/public-students`
- `supabase/functions/finance-admin`
- `supabase/functions/feedback-admin`
- `supabase/migrations/20260829_finance_feedback_qris.sql`
- `dashboard/rekap-keuangan.html`
- `dashboard/rekap-saran.html`
- `assets/qris-yayasan.jpeg`

Data baru disimpan pada:

- `finance_students`
- `finance_transactions`

Transaksi dari aplikasi wali murid masuk sebagai `pending` dan harus diverifikasi admin. Transaksi cash yang dicatat admin langsung berstatus `accepted`.

Set Supabase secret:

- `ADMIN_EMAILS` = email admin Dashboard; jika lebih dari satu, pisahkan dengan koma.

`SUPABASE_SERVICE_ROLE_KEY` digunakan hanya oleh Edge Functions dan tidak boleh dimasukkan ke frontend.

Deploy Edge Functions baru:

- `create-payment`
- `feedback`
- `public-students`
- `finance-admin`
- `feedback-admin`

QRIS bersifat statis, sehingga pembayaran tetap perlu dikonfirmasi kepada bendahara/guru dan diverifikasi admin. Website tidak menerima notifikasi pembayaran GoPay secara otomatis.

## 4. Rekap bendahara

Dashboard → `rekap-keuangan.html` menjadi pusat rekap:

- data siswa;
- transaksi cash;
- transaksi QRIS;
- verifikasi transaksi;
- ringkasan per jenis pembayaran.

Dashboard → `rekap-saran.html` menampilkan saran wali murid dan menyediakan perubahan status serta Download CSV.

Fitur lama `pembayaran.html` / Rekap Transaksi Pembayaran Midtrans sudah dihapus dari source dashboard.

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
