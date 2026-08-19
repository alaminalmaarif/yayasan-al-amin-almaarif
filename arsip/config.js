/*
 * KONFIGURASI /ARSIP
 *
 * 1) Isi GOOGLE_CLIENT_ID dengan OAuth 2.0 Client ID tipe "Web application".
 * 2) Aktifkan Google Drive API dan Google Sheets API pada Google Cloud project
 *    yang sama dengan OAuth Client ID tersebut.
 * 3) Tambahkan domain deploy (mis. https://yayasan-alamin-almaarif.netlify.app)
 *    ke Authorized JavaScript origins.
 *
 * Setelah itu, struktur folder + spreadsheet arsip dibuat otomatis dari halaman
 * /arsip melalui tombol "Siapkan Arsip Google".
 */

const GOOGLE_CLIENT_ID = "935049165096-8066cpddqeld3sog2v7ji4v1e3htpkmb.apps.googleusercontent.com";
const ARSIP_APP_NAME = "Arsip Yayasan Al-Amin";

const ARSIP_UNITS = {
  yayasan: {
    label: "Yayasan Al-Amin Al-Ma'arif",
    shortCode: "YPI-AA",
    code: "421",
    spreadsheetName: "ARSIP - YAYASAN - YPI-AA",
    categories: ["Yayasan", "Persuratan"]
  },
  ra: {
    label: "RA Al-Amin",
    shortCode: "RA-AA",
    code: "421.1",
    spreadsheetName: "ARSIP - RA - RA-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  },
  tpq: {
    label: "TPQ Al-Amin",
    shortCode: "TPQ-AA",
    code: "421.2",
    spreadsheetName: "ARSIP - TPQ - TPQ-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  },
  mdt: {
    label: "MDT Al-Amin",
    shortCode: "MDT-AA",
    code: "421.3",
    spreadsheetName: "ARSIP - MDT - MDT-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  },
  pesantren: {
    label: "Pesantren Al-Amin",
    shortCode: "PP-AA",
    code: "421.4",
    spreadsheetName: "ARSIP - PESANTREN - PP-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  },
  majelis: {
    label: "Majelis Taklim Al-Hasanah",
    shortCode: "MT-AH",
    code: "421.5",
    spreadsheetName: "ARSIP - MAJELIS TAKLIM - MT-AH",
    categories: ["Pegawai", "Lembaga", "Persuratan"]
  },
  mts: {
    label: "MTs Al-Amin",
    shortCode: "MTs-AA",
    code: "421.6",
    spreadsheetName: "ARSIP - MTs - MTs-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  },
  ma: {
    label: "MA Al-Amin",
    shortCode: "MA-AA",
    code: "421.7",
    spreadsheetName: "ARSIP - MA - MA-AA",
    categories: ["Siswa", "Pegawai", "Lembaga", "Persuratan"]
  }
};

const SURAT_TYPES = [
  ["SK", "Surat Keputusan"],
  ["SM", "Surat Permintaan"],
  ["ST", "Surat Tugas"],
  ["SB", "Surat Pemberitahuan"],
  ["SE", "Surat Edaran"],
  ["SKet", "Surat Keterangan"],
  ["SA", "Surat Kuasa"],
  ["KUI-S", "Kuitansi Serah"],
  ["KUI-T", "Kuitansi Terima"]
];

const ARSIP_DOC_FIELDS = [
  ["akta", "Akta"],
  ["kk", "KK"],
  ["ktp_ortu", "KTP Orang Tua"],
  ["ktp", "KTP"],
  ["npwp", "NPWP"],
  ["rekening", "Rekening"],
  ["ijazah", "Ijazah"],
  ["sertifikat", "Sertifikat"],
  ["dokumen_lain", "Dokumen Lain"]
];

const ARSIP_STORAGE_KEY = "arsip_google_config_v1";
