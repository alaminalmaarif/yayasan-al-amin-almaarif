# Setup /arsip — YPI Al-Amin Al-Ma'arif

Modul `/arsip` memakai:

- **Supabase Auth yang sudah dipakai dashboard** untuk mengunci halaman `/arsip`.
- **Google Sheets** untuk database teks/register.
- **Google Drive** untuk file foto, PDF, Word, dan Excel.
- **Google Identity Services + Google APIs** untuk akses langsung dari browser.

## 1. Google Cloud

Buat/pakai satu Google Cloud project.

Aktifkan:

- Google Drive API
- Google Sheets API

Buat **OAuth 2.0 Client ID → Web application**.

Pada **Authorized JavaScript origins**, tambahkan domain tempat website dideploy. Contoh:

`https://yayasan-alamin-almaarif.netlify.app`

Untuk pengujian lokal, tambahkan juga origin lokal yang benar-benar dipakai, misalnya:

`http://localhost:5500`

Jangan memasukkan path seperti `/arsip` ke origin.

## 2. Isi Client ID

Buka `/arsip/index.html`.

Pada kotak **Google OAuth Client ID**, masukkan Client ID yang dibuat di atas lalu klik **Hubungkan Google**.

Nilai tersebut disimpan di localStorage browser. Alternatifnya, Client ID dapat ditaruh langsung di `arsip/config.js` pada:

`GOOGLE_CLIENT_ID`

Client ID bukan password dan tidak perlu disembunyikan seperti service-account private key.

## 3. Siapkan Struktur Arsip Google

Setelah Google terhubung, klik:

**Siapkan Struktur Arsip Google**

Sistem otomatis membuat satu folder induk dan folder unit:

- Yayasan
- RA
- TPQ
- MDT
- Pesantren
- Majelis Taklim
- MTs
- MA

Masing-masing unit mempunyai folder dokumen dan spreadsheet sendiri.

Spreadsheet unit berisi tab sesuai kebutuhan unit, termasuk tab **Persuratan**.

## 4. Penyimpanan

Ketika data disimpan dari website:

**Data teks → Google Sheets**

**File → Google Drive**

**Link Drive → Google Sheets**

File tidak dipaksa menjadi PDF. Format asli tetap dipertahankan.

## 5. Persuratan

Nomor dibuat otomatis berdasarkan unit dan tidak reset.

Contoh RA:

`421.1/028/SK/RA-AA/VIII/2026`

Urutan Yayasan, RA, MDT, TPQ, dan unit lain berdiri sendiri.

Form surat hanya meminta:

1. Unit
2. Jenis surat
3. Tanggal
4. Perihal/keterangan
5. File surat

Nomor surat dihitung sistem.

## 6. Catatan keamanan

Folder/file Drive yang dibuat aplikasi mengikuti kepemilikan dan akses akun Google yang mengotorisasi aplikasi. Jangan membuat file arsip menjadi publik.

Karena `/arsip` berisi NIK, KK, KTP, rekening, NPWP, dan dokumen legalitas, jangan menaruh link `/arsip` pada menu website publik.

## 7. Catatan pengembangan

Konfigurasi ID spreadsheet/folder dibuat otomatis dan disimpan pada localStorage browser. Jika browser/device diganti, struktur yang sudah dibuat di Drive tidak hilang, tetapi browser baru perlu konfigurasi/otorisasi dan pemetaan ulang sebelum digunakan.


## Pembaruan token Google

Versi ini tidak menyimpan access token Google secara permanen di browser. Token akan diminta ulang secara otomatis saat halaman baru dibuka, saat token hampir kedaluwarsa, atau saat Google API mengembalikan 401. Jika Google memerlukan interaksi pengguna, halaman akan meminta otorisasi kembali. Konfigurasi folder dan spreadsheet tetap tersimpan sehingga tidak perlu membuat struktur arsip baru setiap kali token diperbarui.


## V4 — perilaku Google

- Tidak ada popup OAuth otomatis saat halaman `/arsip` dibuka. Ini mencegah popup diblokir browser.
- Form dapat langsung dibuka/diisi. Token Google diminta saat pengguna benar-benar melakukan aksi Google seperti Hubungkan Google, Cari, Simpan, Edit, atau Hapus.
- Struktur Drive/Sheets dicari kembali dari Google Drive dan tidak dibuat ulang hanya karena browser/device berganti.
- Tombol `Siapkan Struktur Arsip Google` hanya membuat struktur jika struktur lama benar-benar tidak ditemukan.
- Saat edit, link dokumen lama tetap dipertahankan jika kolom file tersebut tidak diganti.
- Hasil pencarian menyediakan `Lihat` dan `Download`.
