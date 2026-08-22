/* PPDB review: a student reaches the archive only after an admin accepts them. */
(function () {
  "use strict";

  const SOURCE_KEY = "ppdb_source_config_v2";
  const LEGACY_SOURCE_KEY = "ppdb_source_config_v1";
  const REVIEW_KEY = "ppdb_review_decisions_v1";
  const ARCHIVE_KEY = typeof ARSIP_STORAGE_KEY !== "undefined" ? ARSIP_STORAGE_KEY : "arsip_google_config_v1";
  const archiveHeaders = ["ID", "Dibuat", "Diubah", "Nama Lengkap", "NIK", "NIS/NISN", "Nomor KK", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Nama Ayah", "NIK Ayah", "Nomor WhatsApp Ayah", "Pekerjaan Ayah", "Pendidikan Terakhir Ayah", "Nama Ibu", "NIK Ibu", "Nomor WhatsApp Ibu", "Pekerjaan Ibu", "Pendidikan Terakhir Ibu", "Tanggal Masuk", "Status", "Tahun Lulus", "Pindah Ke", "Lanjut Ke", "Keterangan", "Akta", "KK", "KTP Orang Tua", "Pas Foto Terbaru", "Dokumen Lain", "Ijazah", "e-Rapor", "Data PPDB Lengkap"];
  const unitMap = { KB: "kb", RA: "ra", TPQ: "tpq", MDT: "mdt", PESANTREN: "pesantren", MTS: "mts", MA: "ma" };
  let token = "";
  let tokenExpires = 0;
  let sourceRows = [];

  const $ = id => document.getElementById(id);
  const text = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const getJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; } };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `ppdb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const localIsoDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  };

  function setInfo(message, error) {
    const node = $("ppdbReviewInfo");
    node.textContent = message;
    node.style.color = error ? "#b91c1c" : "#6b7280";
  }

  function sourceConfigs() {
    const configs = getJson(SOURCE_KEY, null);
    if (configs && typeof configs === "object") return configs;
    // Keep an existing one-unit setup when updating to the per-unit version.
    const legacy = getJson(LEGACY_SOURCE_KEY, null);
    if (legacy?.unitKey) {
      const migrated = { [legacy.unitKey]: legacy };
      localStorage.setItem(SOURCE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  }
  function archiveConfig() { return getJson(ARCHIVE_KEY, null); }
  function decisions() { return getJson(REVIEW_KEY, {}); }
  function saveDecisions(value) { localStorage.setItem(REVIEW_KEY, JSON.stringify(value)); }

  async function googleToken() {
    if (token && Date.now() < tokenExpires - 60000) return token;
    if (!window.google?.accounts?.oauth2) throw new Error("Pustaka Google belum siap. Muat ulang halaman lalu coba lagi.");
    // config.js declares this with `const`, so it is available by identifier
    // in this script but is not necessarily exposed as window.GOOGLE_CLIENT_ID.
    if (typeof GOOGLE_CLIENT_ID === "undefined" || !GOOGLE_CLIENT_ID) {
      throw new Error("Google Client ID untuk Arsip belum tersedia.");
    }
    token = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        callback: response => response?.access_token ? resolve(response.access_token) : reject(new Error(response?.error || "Otorisasi Google dibatalkan."))
      });
      client.requestAccessToken({ prompt: "" });
    });
    tokenExpires = Date.now() + 3300000;
    return token;
  }

  async function sheets(url, options = {}) {
    const accessToken = await googleToken();
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || "Google Sheets tidak dapat diakses.");
    return body;
  }

  async function actualSheetName(id, enteredName) {
    if (!/^\d+$/.test(String(enteredName).trim())) return String(enteredName).trim();
    const meta = await sheets(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties`);
    const found = (meta.sheets || []).map(s => s.properties).find(p => String(p.sheetId) === String(enteredName).trim());
    if (!found) throw new Error("ID sheet (gid) tidak ditemukan. Masukkan nama tab, misalnya Form Responses 1.");
    return found.title;
  }

  function configure() {
    const configs = sourceConfigs();
    const suggested = unitMap[String(window.getDashboardUnit?.() || "RA").toUpperCase()] || "ra";
    const unit = prompt("Unit yang akan diatur: KB / RA / TPQ / MDT / Pesantren / MTs / MA", Object.entries(unitMap).find(([, v]) => v === suggested)?.[0] || "RA");
    const unitKey = unitMap[String(unit || "").trim().toUpperCase()];
    if (!unitKey) { setInfo("Unit tujuan tidak valid.", true); return; }
    const prior = configs[unitKey] || {};
    const spreadsheetId = prompt(`ID Spreadsheet respons Google Form PPDB — ${ARSIP_UNITS[unitKey].label} (cukup sekali):`, prior.spreadsheetId || "");
    if (!spreadsheetId) return;
    const sheetName = prompt("Nama tab respons (misalnya Form Responses 1; gid angka juga boleh):", prior.sheetName || "Form Responses 1");
    if (!sheetName) return;
    configs[unitKey] = { spreadsheetId: spreadsheetId.trim(), sheetName: sheetName.trim(), unitKey };
    localStorage.setItem(SOURCE_KEY, JSON.stringify(configs));
    setInfo(`Sumber PPDB ${ARSIP_UNITS[unitKey].label} disimpan. Ulangi Atur Sumber PPDB untuk unit lain, lalu klik Muat Pendaftar PPDB.`);
  }

  function headerIndex(headers, ...names) {
    for (const name of names) { const at = headers.findIndex(h => h === name || h.includes(name)); if (at >= 0) return at; }
    return -1;
  }

  // Google Forms commonly returns dates as dd/mm/yyyy and timestamps as
  // dd/mm/yyyy hh:mm:ss. Archive date inputs require yyyy-mm-dd instead.
  function normaliseDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const local = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
    return raw;
  }

  function parseRows(values, config) {
    const originalHeaders = (values[0] || []).map(x => String(x || "").trim());
    const headers = originalHeaders.map(x => x.toLowerCase());
    const at = {
      nama: headerIndex(headers, "nama lengkap", "nama siswa", "nama peserta"), nik: headerIndex(headers, "nik"), nisn: headerIndex(headers, "nisn", "nis/n"),
      tempat: headerIndex(headers, "tempat lahir", "tempat, tanggal lahir"), tanggal: headerIndex(headers, "tanggal lahir", "tgl lahir", "tempat, tanggal lahir"), alamat: headerIndex(headers, "alamat", "domisili"), ayah: headerIndex(headers, "nama ayah", "ayah kandung", "ayah"), ibu: headerIndex(headers, "nama ibu", "ibu kandung", "ibu"),
      masuk: headerIndex(headers, "tanggal masuk", "tanggal daftar", "tanggal pendaftaran", "timestamp"), status: headerIndex(headers, "status"), keterangan: headerIndex(headers, "keterangan", "catatan"),
      nomorKk: headerIndex(headers, "nomor kk", "no. kk", "no kk", "nomor kartu keluarga"), nikAyah: headerIndex(headers, "nik ayah"), nikIbu: headerIndex(headers, "nik ibu"), waAyah: headerIndex(headers, "nomor whatsapp ayah", "whatsapp ayah", "wa ayah", "no hp ayah"), waIbu: headerIndex(headers, "nomor whatsapp ibu", "whatsapp ibu", "wa ibu", "no hp ibu"), pekerjaanAyah: headerIndex(headers, "pekerjaan ayah"), pekerjaanIbu: headerIndex(headers, "pekerjaan ibu"), pendidikanAyah: headerIndex(headers, "pendidikan terakhir ayah", "pendidikan ayah"), pendidikanIbu: headerIndex(headers, "pendidikan terakhir ibu", "pendidikan ibu"),
      akta: headerIndex(headers, "akta kelahiran", "upload akta", "akta"), kk: headerIndex(headers, "kartu keluarga", "upload kk", "kk"),
      ktpOrtu: headerIndex(headers, "ktp orang tua", "ktp wali", "ktp ayah", "ktp ibu", "upload ktp", "ktp"),
      ijazah: headerIndex(headers, "ijazah"), pasFoto: headerIndex(headers, "pas foto", "foto terbaru", "foto siswa"), eRapor: headerIndex(headers, "e-rapor", "e rapor", "rapor"), dokumenLain: headerIndex(headers, "dokumen lain", "dokumen pendukung", "berkas lain")
    };
    if (at.nama < 0) throw new Error("Kolom Nama Lengkap/Nama Siswa tidak ditemukan pada respons PPDB.");
    return values.slice(1).map((row, index) => {
      const val = key => at[key] < 0 ? "" : String(row[at[key]] || "").trim();
      const nama = val("nama");
      const identity = val("nisn") || val("nik") || `${nama}|${val("masuk")}|${index}`;
      const placeAndDate = val("tempat");
      const combined = placeAndDate.match(/^(.+?)[,;]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})$/);
      const dataPpdb = originalHeaders.map((header, column) => header && row[column] != null && String(row[column]).trim() ? `${header}: ${String(row[column]).trim()}` : "").filter(Boolean).join("\n");
      // Any Google Drive URL from a Form file-upload question is archived as
      // its own column. This covers future questions such as Pas Foto without
      // requiring a code change for every new document type.
      const ppdbUploads = {};
      originalHeaders.forEach((header, column) => {
        const answer = String(row[column] || "").trim();
        if (header && /https?:\/\/(?:drive|docs)\.google\.com\//i.test(answer)) ppdbUploads[header] = answer;
      });
      return { key: `${config.spreadsheetId}:${config.sheetName}:${identity}`.toLowerCase(), unitKey: config.unitKey, unitLabel: ARSIP_UNITS[config.unitKey]?.label || config.unitKey, nama, nik: val("nik"), nisn: val("nisn"), nomorKk: val("nomorKk"), tempatLahir: combined?.[1]?.trim() || placeAndDate, tglLahir: normaliseDate(val("tanggal") || combined?.[2]), alamat: val("alamat"), ayah: val("ayah"), nikAyah: val("nikAyah"), waAyah: val("waAyah"), pekerjaanAyah: val("pekerjaanAyah"), pendidikanAyah: val("pendidikanAyah"), ibu: val("ibu"), nikIbu: val("nikIbu"), waIbu: val("waIbu"), pekerjaanIbu: val("pekerjaanIbu"), pendidikanIbu: val("pendidikanIbu"), tglMasuk: normaliseDate(val("masuk")), status: val("status") || "Aktif", keterangan: val("keterangan") || "Dari PPDB", akta: val("akta"), kk: val("kk"), ktpOrtu: val("ktpOrtu"), pasFoto: val("pasFoto"), ijazah: val("ijazah"), eRapor: val("eRapor"), dokumenLain: val("dokumenLain"), dataPpdb, ppdbUploads };
    }).filter(row => row.nama);
  }

  function render(rows) {
    const list = $("ppdbStudentList");
    if (!rows.length) { list.innerHTML = '<div class="search-empty">Tidak ada pendaftar baru yang menunggu keputusan.</div>'; return; }
    list.innerHTML = rows.map((row, index) => `<article class="ppdb-student"><div><h3>${text(row.nama)}</h3><small>Unit: ${text(row.unitLabel)} · NIK: ${text(row.nik || "—")} · NISN: ${text(row.nisn || "—")} · ${text(row.tglMasuk || "Tanggal daftar tidak tersedia")}</small></div><div class="ppdb-student-actions"><button class="ppdb-accept" data-ppdb-accept="${index}">Diterima</button><button class="ppdb-reject" data-ppdb-reject="${index}">Ditolak</button></div></article>`).join("");
    list.querySelectorAll("[data-ppdb-accept]").forEach(button => button.addEventListener("click", () => accept(sourceRows[Number(button.dataset.ppdbAccept)])));
    list.querySelectorAll("[data-ppdb-reject]").forEach(button => button.addEventListener("click", () => reject(sourceRows[Number(button.dataset.ppdbReject)])));
  }

  async function load() {
    let configs = sourceConfigs();
    if (!Object.keys(configs).length) { configure(); configs = sourceConfigs(); if (!Object.keys(configs).length) return; }
    setInfo("Membaca respons PPDB...");
    const all = []; const loadedUnits = []; const errors = [];
    for (const config of Object.values(configs)) {
      try {
        const tab = await actualSheetName(config.spreadsheetId, config.sheetName);
        if (tab !== config.sheetName) { config.sheetName = tab; localStorage.setItem(SOURCE_KEY, JSON.stringify(configs)); }
        const data = await sheets(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(`${tab}!A:ZZ`)}`);
        if ((data.values || []).length < 2) { loadedUnits.push(`${ARSIP_UNITS[config.unitKey]?.label || config.unitKey} (belum ada respons)`); continue; }
        all.push(...parseRows(data.values, config)); loadedUnits.push(ARSIP_UNITS[config.unitKey]?.label || config.unitKey);
      } catch (error) { errors.push(`${ARSIP_UNITS[config.unitKey]?.label || config.unitKey}: ${error.message || error}`); }
    }
    if (!loadedUnits.length && errors.length) throw new Error(errors.join(" | "));
    const done = decisions();
    sourceRows = all.filter(row => !done[row.key]);
    render(sourceRows);
    setInfo(`${sourceRows.length} pendaftar baru menunggu keputusan. Unit dimuat: ${loadedUnits.join(", ")}.${errors.length ? ` Kendala: ${errors.join(" | ")}` : ""}`, errors.length > 0);
  }

  async function accept(row) {
    if (!row || !confirm(`Terima ${row.nama}? Data akan ditambahkan ke Arsip Siswa.`)) return;
    const setup = archiveConfig(); const unit = setup?.units?.[row.unitKey];
    if (!unit?.spreadsheetId) throw new Error("Struktur Arsip belum tersedia. Buka Arsip, hubungkan Google, lalu klik Siapkan Struktur Arsip Google satu kali.");
    setInfo(`Menambahkan ${row.nama} ke Arsip...`);
    const acceptedDate = localIsoDate();
    const record = { "ID": uuid(), "Dibuat": new Date().toISOString(), "Diubah": new Date().toISOString(), "Nama Lengkap": row.nama, "NIK": row.nik, "NIS/NISN": row.nisn, "Nomor KK": row.nomorKk, "Tempat Lahir": row.tempatLahir, "Tanggal Lahir": row.tglLahir, "Alamat": row.alamat, "Nama Ayah": row.ayah, "NIK Ayah": row.nikAyah, "Nomor WhatsApp Ayah": row.waAyah, "Pekerjaan Ayah": row.pekerjaanAyah, "Pendidikan Terakhir Ayah": row.pendidikanAyah, "Nama Ibu": row.ibu, "NIK Ibu": row.nikIbu, "Nomor WhatsApp Ibu": row.waIbu, "Pekerjaan Ibu": row.pekerjaanIbu, "Pendidikan Terakhir Ibu": row.pendidikanIbu, "Tanggal Masuk": acceptedDate, "Status": row.status, "Tahun Lulus": "", "Pindah Ke": "", "Lanjut Ke": "", "Keterangan": row.keterangan, "Akta": row.akta, "KK": row.kk, "KTP Orang Tua": row.ktpOrtu, "Pas Foto Terbaru": row.pasFoto, "Dokumen Lain": row.dokumenLain, "Ijazah": row.ijazah, "e-Rapor": row.eRapor, "Data PPDB Lengkap": row.dataPpdb };
    // Use the headers already present in this unit's archive, so older sheets
    // retain their column order and any additional local columns.
    const headerData = await sheets(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(unit.spreadsheetId)}/values/${encodeURIComponent("Siswa!A1:ZZ1")}`);
    let targetHeaders = headerData.values?.[0]?.filter(Boolean) || archiveHeaders;
    const dynamicUploadHeaders = Object.keys(row.ppdbUploads || {}).filter(header => !targetHeaders.includes(header));
    const missingHeaders = archiveHeaders.filter(header => !targetHeaders.includes(header)).concat(dynamicUploadHeaders);
    if (missingHeaders.length) {
      targetHeaders = targetHeaders.concat(missingHeaders);
      await sheets(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(unit.spreadsheetId)}/values/${encodeURIComponent("Siswa!A1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [targetHeaders] }) });
    }
    const range = encodeURIComponent("Siswa!A1");
    await sheets(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(unit.spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values: [targetHeaders.map(header => record[header] || row.ppdbUploads?.[header] || "")] }) });
    const done = decisions(); done[row.key] = { decision: "accepted", at: new Date().toISOString() }; saveDecisions(done);
    sourceRows = sourceRows.filter(item => item.key !== row.key); render(sourceRows); setInfo(`${row.nama} diterima dan sudah masuk Arsip Siswa.`);
  }

  function reject(row) {
    if (!row || !confirm(`Tolak ${row.nama}? Data tidak akan masuk Arsip.`)) return;
    const done = decisions(); done[row.key] = { decision: "rejected", at: new Date().toISOString() }; saveDecisions(done);
    sourceRows = sourceRows.filter(item => item.key !== row.key); render(sourceRows); setInfo(`${row.nama} ditolak dan tidak masuk Arsip.`);
  }

  $("ppdbConfigButton")?.addEventListener("click", configure);
  $("ppdbLoadButton")?.addEventListener("click", () => load().catch(error => { console.error(error); setInfo(error.message || String(error), true); }));
})();
