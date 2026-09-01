# Panduan Supabase: QRIS, Rekap Keuangan, dan Saran & Masukan

Panduan ini dibuat untuk versi aplikasi yang menggunakan **QRIS statis Yayasan** dan **Rekap Keuangan** sebagai sumber data siswa serta transaksi. Ikuti langkah secara berurutan.

> **Penting:** Jangan menghapus tabel `payments` lama. Tabel tersebut menyimpan data/struktur Midtrans lama dan tidak dipakai oleh alur QRIS baru. Perubahan baru memakai tabel `finance_students` dan `finance_transactions`.

## 1. Siapkan ZIP dan folder proyek

Setelah ZIP diekstrak, pastikan terdapat:

- `supabase/migrations/20260829_finance_feedback_qris.sql`
- `supabase/functions/create-payment/index.ts`
- `supabase/functions/feedback/index.ts`
- `supabase/functions/public-students/index.ts`
- `supabase/functions/finance-admin/index.ts`
- `supabase/functions/feedback-admin/index.ts`
- `assets/qris-yayasan.jpeg`
- `dashboard/rekap-keuangan.html`
- `dashboard/rekap-saran.html`

File dashboard lama `dashboard/pembayaran.html` sudah dihapus karena fitur **Rekap Transaksi Pembayaran Midtrans** tidak dipakai lagi.

## 2. Jalankan migration database

### 2.1 Buka Supabase

1. Buka **Supabase Dashboard**.
2. Pilih project Yayasan Al-Amin.
3. Di menu kiri, pilih **SQL Editor**.
4. Klik **New query**.

### 2.2 Salin migration

Buka file:

`supabase/migrations/20260829_finance_feedback_qris.sql`

Salin **seluruh isi file**, lalu tempel ke SQL Editor.

Klik **Run**.

### 2.3 Pastikan berhasil

Setelah selesai, buka **Table Editor**.

Tabel baru yang harus terlihat:

- `finance_students`
- `finance_transactions`

Tabel lama:

- `payments`
- `feedback_messages`

tetap dipertahankan.

Pada `feedback_messages` harus terdapat kolom:

- `id`
- `message`
- `created_at`
- `sender_name`
- `status`

Status default adalah:

`belum_dibaca`

Status yang diperbolehkan:

- `belum_dibaca`
- `sudah_dibaca`
- `sudah_ditangani`

Pada `finance_students` terdapat data master siswa berdasarkan:

- tahun ajaran
- unit
- nama siswa

Pada `finance_transactions` terdapat transaksi:

- Tabungan Wajib
- Tabungan Sukarela
- SPP
- Kegiatan
- PPDB
- Bantuan

## 3. Jangan membuat tabel baru secara manual

Anda **tidak perlu** membuat tabel `finance_students` atau `finance_transactions` secara manual dari Table Editor.

Migration SQL sudah membuat tabel, index, constraint, dan RLS.

Jalankan migration terlebih dahulu.

## 4. Atur email admin

Fitur berikut hanya boleh digunakan oleh admin yang terdaftar:

- Rekap Keuangan
- Tambah siswa
- Catat pembayaran cash
- Verifikasi pembayaran QRIS
- Rekap Saran & Masukan
- Mengubah status saran

Caranya:

1. Di Supabase Dashboard buka **Edge Functions**.
2. Cari bagian **Secrets** / pengaturan secrets project.
3. Tambahkan secret:

`ADMIN_EMAILS`

4. Isi dengan email yang digunakan untuk login Dashboard.

Contoh satu admin:

`admin@contoh.id`

Jika ada beberapa admin, pisahkan dengan koma:

`admin@contoh.id,kepala@contoh.id,bendahara@contoh.id`

Pastikan penulisan email sama dengan email akun Supabase Auth yang digunakan untuk login.

## 5. Secret yang diperlukan

Fungsi baru menggunakan `SUPABASE_SERVICE_ROLE_KEY` di server Edge Function.

Jangan memasukkan service-role key ke:

- `app.html`
- `app/app.js`
- file JavaScript publik
- APK frontend

Service-role key hanya boleh berada sebagai secret/server environment Supabase.

Supabase biasanya sudah menyediakan secret sistem seperti `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk Edge Functions. Jangan menaruh nilai service-role key di source code.

## 6. Deploy Edge Functions

Gunakan **Supabase CLI**.

### 6.1 Instal Supabase CLI

Di Windows PowerShell:

```bash
npm install -g supabase
```

Kemudian:

```bash
supabase login
```

Ikuti proses login yang ditampilkan.

### 6.2 Masuk ke folder proyek

Buka PowerShell pada folder hasil ekstraksi ZIP, yaitu folder yang berisi:

`supabase/`

Kemudian jalankan:

```bash
supabase link --project-ref gtqvuymhtdfpnvlyzdun
```

Jika diminta password database, masukkan password database project Supabase.

### 6.3 Deploy lima fungsi baru

Jalankan satu per satu:

```bash
supabase functions deploy create-payment
```

```bash
supabase functions deploy feedback
```

```bash
supabase functions deploy public-students
```

```bash
supabase functions deploy finance-admin
```

```bash
supabase functions deploy feedback-admin
```

Setelah semuanya selesai, buka **Edge Functions** di Supabase dan pastikan kelima fungsi tersebut sudah terdeploy.

### 6.4 Catatan penting `public-students`

Fungsi `public-students` memang digunakan oleh aplikasi wali murid tanpa login.

Konfigurasi project sudah menetapkan:

`verify_jwt = false`

untuk fungsi tersebut.

Jangan mengubahnya menjadi fungsi yang mewajibkan login, karena wali murid harus dapat mengambil daftar nama siswa setelah memilih tahun ajaran dan unit.

## 7. Konfigurasi QRIS

QRIS yang digunakan adalah **QRIS statis milik Yayasan**.

File QRIS harus tetap berada di:

`assets/qris-yayasan.jpeg`

Aplikasi tidak meminta API pembayaran Midtrans untuk membuat QR.

Alurnya:

1. Wali murid memilih tahun ajaran.
2. Memilih unit.
3. Memilih nama siswa.
4. Memilih jenis pembayaran.
5. Mengisi detail pembayaran.
6. Klik **Bayar dengan QRIS**.
7. Sistem terlebih dahulu mencatat transaksi ke `finance_transactions` dengan status:
   `pending`
8. Gambar QRIS Yayasan tampil.
9. Wali murid melakukan pembayaran menggunakan aplikasi bank/e-wallet.
10. Wali murid mengonfirmasi kepada bendahara/guru.
11. Admin membuka **Rekap Keuangan**.
12. Admin memilih **Terima** atau **Tolak**.

Karena QRIS yang digunakan adalah QRIS statis, website tidak menerima notifikasi otomatis dari GoPay Merchant mengenai keberhasilan scan/pembayaran. Karena itu verifikasi oleh admin tetap diperlukan.

## 8. Aturan Tabungan Wajib

Sistem menerapkan batas maksimum saldo Tabungan Wajib:

**Rp500.000 per siswa, per tahun ajaran dan unit.**

Jika wali murid menambah Tabungan Wajib:

- saldo lama dihitung;
- transaksi yang sudah diterima dihitung;
- penggunaan Tabungan Wajib untuk Kegiatan yang sudah diterima dikurangi;
- transaksi pending belum memengaruhi saldo;
- transaksi ditolak tidak memengaruhi saldo.

Contoh:

Saldo Tabungan Wajib = Rp400.000.

Wali murid memasukkan Tabungan Wajib Rp100.000.

Hasil setelah diterima:

Rp500.000.

Jika memasukkan Rp150.000, sistem menolak karena melewati batas Rp500.000.

## 9. Potong Tabungan Wajib untuk Kegiatan

Pilihan **Potong dari Tabungan Wajib** hanya berlaku untuk jenis pembayaran:

**Kegiatan**

Kegiatan yang tersedia:

- Maulid
- Agustusan
- Karyawisata
- Manasik Haji
- Renang
- Lomba
- Isi Manual

Jika dipilih potong dari Tabungan Wajib:

- saldo Tabungan Wajib harus mencukupi;
- transaksi QRIS awalnya berstatus `pending`;
- saldo belum berkurang ketika masih `pending`;
- jika admin memilih **Tolak**, saldo tidak berkurang;
- jika admin memilih **Terima**, saldo Tabungan Wajib berkurang sesuai nominal.

Contoh:

Saldo Tabungan Wajib = Rp500.000.

Pembayaran Kegiatan = Rp100.000.

Setelah transaksi diterima:

- Ringkasan Kegiatan bertambah Rp100.000;
- saldo Tabungan Wajib menjadi Rp400.000.

## 10. Tabungan Sukarela

Tabungan Sukarela:

- tidak memiliki batas maksimum;
- tidak dipotong untuk pembayaran lain;
- tidak digunakan otomatis untuk membayar Kegiatan, SPP, PPDB, atau Bantuan.

Jangan memilih opsi potong Tabungan Wajib untuk jenis pembayaran selain Kegiatan.

## 11. Tahun Ajaran

Tahun awal yang tersedia:

- 2026/2027
- 2027/2028
- 2028/2029
- 2029/2030
- 2030/2031
- Custom (ketik sendiri)

Jika memilih tahun ajaran yang lebih baru, pilihan tahun berikutnya akan ditambahkan otomatis.

Contoh:

Jika memilih `2027/2028`, sistem dapat menambahkan tahun berikutnya sampai `2031/2032` dan seterusnya sesuai kebutuhan.

Untuk Custom, format harus:

`YYYY/YYYY`

Contoh:

`2035/2036`

## 12. Tambah siswa

Di Dashboard → **Rekap Keuangan**:

1. Pilih Tahun Ajaran.
2. Pilih Unit.
3. Klik **Tambah Siswa**.
4. Isi nama siswa.
5. Klik **Tambah Siswa**.

Data tersebut masuk ke:

`finance_students`

Kombinasi tahun ajaran + unit + nama siswa tidak boleh duplikat.

Nama siswa inilah yang kemudian digunakan sebagai sumber dropdown nama siswa pada aplikasi wali murid.

Jadi wali murid **tidak mengetik nama siswa secara manual** pada fitur pembayaran.

## 13. Rekap Saran & Masukan

Alur baru:

1. Wali murid membuka Saran & Masukan.
2. Nama boleh dikosongkan.
3. Wali murid menulis saran.
4. Klik **Kirim Saran**.
5. Data masuk ke `feedback_messages`.
6. Tanggal/waktu otomatis dicatat pada `created_at`.
7. Dashboard → **Rekap Saran & Masukan** mengambil data dari Supabase.

Kolom yang digunakan:

- ID
- tanggal
- nama (opsional)
- isi saran
- status

Status:

- belum_dibaca
- sudah_dibaca
- sudah_ditangani

Admin dapat mengubah status langsung dari tabel dan dapat menggunakan tombol **Download CSV**.

Tidak ada lagi pengiriman saran melalui WhatsApp sebagai bagian dari alur tersebut.

## 14. Rekap Keuangan: transaksi cash

Untuk pembayaran langsung/cash:

1. Login Dashboard.
2. Buka **Rekap Keuangan**.
3. Pilih tahun ajaran.
4. Pilih unit.
5. Pilih nama siswa.
6. Pilih jenis pembayaran.
7. Isi detail yang diminta.
8. Klik **Simpan**.

Transaksi cash langsung berstatus:

`accepted`

karena transaksi tersebut dicatat langsung oleh admin.

## 15. Rekap Keuangan: transaksi QRIS

Transaksi dari aplikasi wali murid berbeda:

`source = qris`

dan pertama kali masuk sebagai:

`verification_status = pending`

Admin kemudian melakukan verifikasi.

Jika diterima:

`verification_status = accepted`

Jika ditolak:

`verification_status = rejected`

Jika ditolak, admin wajib mengisi keterangan.

Contoh:

- typo nominal
- pembayaran tidak ditemukan
- fake nominal
- alasan lain

## 16. Ringkasan Keuangan

Dashboard → Rekap Keuangan menampilkan ringkasan:

- Tabungan Wajib
- Tabungan Sukarela
- SPP
- Kegiatan
- PPDB
- Bantuan

Ringkasan hanya menghitung transaksi yang:

`verification_status = accepted`

Transaksi `pending` dan `rejected` tidak masuk ringkasan.

Untuk Kegiatan yang menggunakan Tabungan Wajib:

- nominal Kegiatan masuk ke ringkasan Kegiatan;
- nominal yang sama mengurangi ringkasan Tabungan Wajib.

## 17. Fitur Rekap Transaksi Pembayaran Midtrans

Fitur Dashboard lama:

`Pembayaran → Rekap Transaksi Pembayaran`

sudah dihapus dari source dashboard.

File lama `dashboard/pembayaran.html` juga sudah tidak disertakan pada ZIP final.

Jika Edge Function lama `payment-report` masih terdaftar di Supabase, fungsi tersebut tidak lagi dipakai oleh aplikasi baru.

**Jangan menghapus tabel `payments` lama** kecuali Anda sendiri sudah memastikan tidak ada kebutuhan terhadap data Midtrans lama.

Fungsi `midtrans-webhook` juga tidak perlu digunakan untuk transaksi QRIS baru.

## 18. Upload website/aplikasi

Setelah konfigurasi Supabase selesai:

1. Upload source website/aplikasi versi final ke hosting seperti sebelumnya.
2. Pastikan file berikut ikut terupload:
   - `app.html`
   - `app/app.js`
   - `app/config.js`
   - `assets/qris-yayasan.jpeg`
   - `dashboard/rekap-keuangan.html`
   - `dashboard/rekap-saran.html`
   - folder `supabase/` jika repository digunakan untuk deploy function
3. Bersihkan cache/CDN jika hosting menggunakannya.
4. Buka ulang aplikasi.

## 19. Pengujian wajib setelah konfigurasi

Lakukan pengujian berikut secara berurutan.

### A. Saran

1. Kirim saran tanpa nama.
2. Pastikan muncul pesan berhasil.
3. Buka `feedback_messages` di Supabase.
4. Pastikan nama bernilai kosong/NULL.
5. Pastikan tanggal `created_at` terisi.
6. Buka Dashboard → Rekap Saran & Masukan.
7. Pastikan saran muncul.
8. Ubah status menjadi `sudah_dibaca`.
9. Ubah menjadi `sudah_ditangani`.
10. Download CSV dan buka hasilnya.

### B. Siswa

1. Dashboard → Rekap Keuangan.
2. Pilih `2026/2027`.
3. Pilih unit.
4. Tambah satu siswa.
5. Pastikan siswa muncul di daftar.
6. Buka aplikasi wali murid.
7. Pilih tahun dan unit yang sama.
8. Pastikan nama siswa muncul.

### C. Tabungan Wajib

1. Catat cash Tabungan Wajib.
2. Pastikan ringkasan bertambah.
3. Coba melebihi Rp500.000.
4. Pastikan sistem menolak.

### D. Tabungan Sukarela

1. Catat Tabungan Sukarela.
2. Pastikan ringkasan bertambah.
3. Pastikan tidak ada pemotongan otomatis.

### E. QRIS

1. Dari aplikasi wali murid, buat pembayaran.
2. Pastikan transaksi muncul di Rekap Keuangan sebagai `pending`.
3. Pastikan nominal belum masuk ringkasan.
4. Klik **Terima**.
5. Pastikan transaksi menjadi `accepted`.
6. Pastikan nominal masuk ringkasan.

### F. Penolakan QRIS

1. Buat transaksi QRIS baru.
2. Klik **Tolak**.
3. Pastikan sistem meminta keterangan.
4. Isi keterangan.
5. Pastikan status menjadi `rejected`.
6. Pastikan nominal tidak masuk ringkasan.

### G. Potong Tabungan Wajib

1. Pastikan siswa mempunyai saldo Tabungan Wajib.
2. Buat pembayaran Kegiatan.
3. Pilih **Potong dari Tabungan Wajib**.
4. Pastikan transaksi pending belum mengurangi saldo.
5. Klik **Tolak**.
6. Pastikan saldo tetap.
7. Buat transaksi lagi.
8. Klik **Terima**.
9. Pastikan saldo Tabungan Wajib berkurang sesuai nominal.

## 20. Hal yang tidak boleh dilakukan

Jangan:

- memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke frontend;
- menghapus tabel `payments` lama hanya karena Midtrans sudah tidak digunakan;
- menghapus `feedback_messages`;
- menghapus `finance_students`;
- menghapus `finance_transactions`;
- mengubah RLS tabel baru menjadi terbuka untuk publik;
- mengubah daftar unit pembayaran menjadi `Majelis Taklim`, karena alur keuangan baru menggunakan tujuh unit:
  `KB, RA, TPQ, MDT, Pesantren, MTs, MA`.

## 21. Hasil akhir arsitektur

### Wali murid → Saran

`Wali Murid → Form Saran → Edge Function feedback → feedback_messages → Dashboard Rekap Saran`

### Admin → Keuangan cash

`Dashboard → Rekap Keuangan → finance-admin → finance_transactions`

### Wali murid → QRIS

`Wali Murid → Pilih Siswa → create-payment → finance_transactions (pending) → QRIS statis → konfirmasi ke bendahara/guru → Admin verifikasi → accepted/rejected → Rekap Keuangan`

### Sumber nama siswa

`Dashboard Rekap Keuangan → Tambah Siswa → finance_students → public-students → Dropdown aplikasi wali murid`

Dengan arsitektur ini, transaksi cash admin dan transaksi QRIS wali murid berada pada **rekap keuangan yang sama**, sedangkan transaksi QRIS tetap menunggu verifikasi sebelum dianggap sebagai transaksi yang sah dalam ringkasan.

## 6. Migration perbaikan dan fitur Pengeluaran (versi revisi)

Jika menggunakan ZIP revisi terbaru ini, setelah migration `20260829_finance_feedback_qris.sql` yang lama sudah pernah dijalankan, jalankan migration tambahan:

`supabase/migrations/20260829_finance_expenses_fix.sql`

Migration tambahan ini membuat tabel `finance_expenses` untuk pencatatan pengeluaran manual admin. Tabel ini menggunakan konteks `academic_year` + `unit`, sehingga rekap pengeluaran otomatis mengikuti Tahun Ajaran dan Unit yang sedang dipilih.

Tidak perlu menghapus tabel atau data lama.

## 7. Deploy ulang Edge Functions setelah revisi

Deploy ulang fungsi berikut dari folder proyek:

```bash
supabase functions deploy finance-admin
supabase functions deploy feedback-admin
```

`finance-admin` diperlukan untuk Tambah Siswa dan fitur Pengeluaran. `feedback-admin` diperlukan agar perubahan status saran tersimpan dan langsung dimuat ulang dari database.

## 8. Uji Tambah Siswa

1. Login dashboard.
2. Buka Rekap Keuangan.
3. Pilih Tahun Ajaran, misalnya `2026/2027`.
4. Pilih Unit, misalnya `KB`.
5. Isi Nama Siswa.
6. Klik `+ Tambah Siswa`.
7. Pastikan siswa muncul pada tabel dengan Tahun Ajaran dan Unit yang dipilih.
8. Ganti Tahun Ajaran atau Unit. Siswa yang tidak termasuk konteks tersebut tidak boleh muncul.

Jika nama yang sama sudah terdaftar pada kombinasi Tahun Ajaran + Unit yang sama, sistem akan menolak duplikasi.

## 9. Uji Saran & Masukan

1. Buka Rekap Saran & Masukan.
2. Pilih `sudah_dibaca` atau `sudah_ditangani`.
3. Tunggu pemuatan ulang otomatis.
4. Pastikan status di tabel berubah.
5. Keluar dari halaman dan masuk kembali.
6. Pastikan status tetap tersimpan sesuai database.

## 10. Uji Pengeluaran

1. Buka Rekap Keuangan.
2. Pilih Tahun Ajaran dan Unit.
3. Isi Nominal Pengeluaran.
4. Isi Keperluan.
5. Isi Keterangan bila diperlukan.
6. Klik `Simpan Pengeluaran`.
7. Pastikan transaksi muncul pada tabel Pengeluaran.
8. Pastikan Ringkasan Pengeluaran bertambah.
9. Ganti Tahun Ajaran atau Unit dan pastikan pengeluaran yang ditampilkan berubah sesuai konteks tersebut.
