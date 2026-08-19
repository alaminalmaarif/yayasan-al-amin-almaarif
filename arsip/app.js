(() => {
  "use strict";

  const sessionRaw = localStorage.getItem("supabase_session");
  if (!sessionRaw) {
    window.location.href = "../dashboard/login.html";
    return;
  }

  const $ = id => document.getElementById(id);
  const state = {
    token: null,
    tokenExpiresAt: 0,
    tokenClient: null,
    googleReady: false,
    setup: null,
    category: null,
    editing: null,
    rows: [],
    saving: false
  };

  const UNIT_KEYS = Object.keys(ARSIP_UNITS);
  const UNIT_LABELS = Object.fromEntries(UNIT_KEYS.map(k => [k, ARSIP_UNITS[k].label]));

  const BASE_COLUMNS = ["ID", "Dibuat", "Diubah"];
  const SCHEMAS = {
    Siswa: BASE_COLUMNS.concat(["Nama Lengkap", "NIK", "NIS/NISN", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Nama Ayah", "Nama Ibu", "Tanggal Masuk", "Status", "Tahun Lulus", "Pindah Ke", "Lanjut Ke", "Keterangan", "Akta", "KK", "KTP Orang Tua", "Dokumen Lain", "Ijazah", "e-Rapor"]),
    Pegawai: BASE_COLUMNS.concat(["Nama Lengkap", "NIK", "NUPTK/NPK", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Pendidikan", "Jabatan", "Tanggal Mulai", "Status", "Unit", "Keterangan", "KK", "KTP", "NPWP", "Rekening", "Ijazah", "Sertifikat", "Dokumen Lain"]),
    Lembaga: BASE_COLUMNS.concat(["Nama Lembaga", "Nomor Identitas", "Alamat", "Kepala/Pimpinan", "Tanggal Berdiri", "Status", "Keterangan", "Akta", "SK/Legalitas", "NPWP", "Dokumen Lain"]),
    Yayasan: BASE_COLUMNS.concat(["Nama Yayasan", "Nomor Identitas", "Alamat", "Ketua", "Tanggal Berdiri", "Status", "Keterangan", "Akta Notaris", "SK Kemenkumham", "NPWP", "Dokumen Lain"]),
    Persuratan: BASE_COLUMNS.concat(["Nomor Surat", "Unit", "Kode Unit", "Jenis Kode", "Jenis Surat", "Tanggal Surat", "Bulan", "Tahun", "Perihal", "Keterangan", "File"])
  };

  const FILE_FIELDS = {
    Siswa: [["akta","Akta"],["kk","KK"],["ktp_ortu","KTP Orang Tua"],["ijazah","Ijazah"],["e_rapor","e-Rapor"],["dokumen_lain","Dokumen Lain"]],
    Pegawai: [["kk","KK"],["ktp","KTP"],["npwp","NPWP"],["rekening","Rekening"],["ijazah","Ijazah"],["sertifikat","Sertifikat"],["dokumen_lain","Dokumen Lain"]],
    Lembaga: [["akta","Akta"],["sk_legalitas","SK/Legalitas"],["npwp","NPWP"],["dokumen_lain","Dokumen Lain"]],
    Yayasan: [["akta_notaris","Akta Notaris"],["sk_kemenkumham","SK Kemenkumham"],["npwp","NPWP"],["dokumen_lain","Dokumen Lain"]],
    Persuratan: [["file","File Surat"]]
  };

  function clientId() {
    return localStorage.getItem("arsip_google_client_id") || GOOGLE_CLIENT_ID || "";
  }

  function setStatus(text, type = "warn") {
    const el = $("googleStatus");
    el.textContent = text;
    el.className = "status " + (type === "ok" ? "" : type);
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  function romanMonth(month) {
    return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][Number(month)-1] || "";
  }

  function nowIso() { return new Date().toISOString(); }

  function currentUser() {
    try {
      const s = JSON.parse(localStorage.getItem("supabase_session") || "null");
      return s?.user?.email || s?.user?.id || "admin";
    } catch { return "admin"; }
  }

  function googleSetup() {
    try { return JSON.parse(localStorage.getItem(ARSIP_STORAGE_KEY) || "null"); } catch { return null; }
  }

  function saveGoogleSetup(v) { localStorage.setItem(ARSIP_STORAGE_KEY, JSON.stringify(v)); state.setup = v; }

  // V3: the Drive/Sheets structure is owned by Google, not by this browser.
  // A small app marker lets a new device discover the existing root folder.
  const DRIVE_APP_MARKER = "ypi-alamin-arsip-v3"; // kept for compatibility with the existing V3 structure

  async function findDriveFiles(q, fields = "files(id,name,mimeType,parents,appProperties,createdTime)") {
    const params = new URLSearchParams({
      q,
      spaces: "drive",
      pageSize: "100",
      orderBy: "createdTime",
      fields
    });
    const res = await googleFetch("https://www.googleapis.com/drive/v3/files?" + params.toString());
    return (await res.json()).files || [];
  }

  async function markDriveFile(fileId) {
    return createDriveJson(`/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,appProperties`, {
      appProperties: { arsipApp: DRIVE_APP_MARKER }
    }, "PATCH");
  }

  async function findExistingGoogleStructure() {
    let roots = await findDriveFiles(
      `mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='arsipApp' and value='${DRIVE_APP_MARKER}' }`
    );
    if (!roots.length) {
      // Backward compatibility with structures made before the marker existed.
      roots = await findDriveFiles(
        `name='${ARSIP_APP_NAME.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      );
    }
    if (!roots.length) return null;

    // Use the oldest matching root. Once marked, later devices will always find it.
    roots.sort((a,b)=>String(a.createdTime||"").localeCompare(String(b.createdTime||"")));
    const root = roots[0];
    try { await markDriveFile(root.id); } catch {}

    const setup = {version:4, rootFolderId:root.id, discoveredAt:nowIso(), units:{}};
    const children = await findDriveFiles(`'${root.id}' in parents and trashed=false`);

    for (const key of UNIT_KEYS) {
      const unit = ARSIP_UNITS[key];
      let unitFolder = children.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === `${unit.label} - ${unit.shortCode}`);
      if (!unitFolder) unitFolder = children.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === unit.label);
      if (!unitFolder) return null;

      const unitChildren = await findDriveFiles(`'${unitFolder.id}' in parents and trashed=false`);
      const docsFolder = unitChildren.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === 'Dokumen');
      const spreadsheet = unitChildren.find(f => f.mimeType === 'application/vnd.google-apps.spreadsheet' && f.name === unit.spreadsheetName);
      if (!docsFolder || !spreadsheet) return null;

      const docChildren = await findDriveFiles(`'${docsFolder.id}' in parents and trashed=false`);
      const categoryFolders = {};
      for (const cat of unit.categories) {
        const folder = docChildren.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === cat);
        if (!folder) return null;
        categoryFolders[cat] = folder.id;
      }
      setup.units[key] = {
        folderId:unitFolder.id,
        docsFolderId:docsFolder.id,
        categoryFolders,
        spreadsheetId:spreadsheet.id,
        sheets:unit.categories
      };
    }
    saveGoogleSetup(setup);
    return setup;
  }

  async function ensureGoogleStructure() {
    const cached = googleSetup();
    if (cached?.rootFolderId && cached?.units && Object.keys(cached.units).length === UNIT_KEYS.length) {
      state.setup = cached;
      return cached;
    }
    return await findExistingGoogleStructure();
  }

  async function googleFetch(url, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 20000);
    const fetchOptions = {...options};
    delete fetchOptions.timeoutMs;

    if (!state.token || Date.now() > state.tokenExpiresAt - 60000) {
      throw new Error("Google belum terhubung pada sesi ini. Klik Hubungkan Google terlebih dahulu.");
    }

    async function doFetch() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers = new Headers(fetchOptions.headers || {});
        headers.set("Authorization", "Bearer " + state.token);
        if (fetchOptions.body && !(fetchOptions.body instanceof Blob) && !(fetchOptions.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }
        return await fetch(url, {...fetchOptions, headers, signal: controller.signal});
      } catch (e) {
        if (e?.name === "AbortError") throw new Error(`Google API tidak merespons dalam ${Math.round(timeoutMs/1000)} detik.`);
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }

    let res = await doFetch();
    if (res.status === 401) {
      // Do not silently open OAuth from an arbitrary background operation.
      // The caller must reconnect from an explicit user action.
      state.token = null;
      state.tokenExpiresAt = 0;
      state.googleReady = false;
      throw new Error("Sesi Google sudah kedaluwarsa. Klik Hubungkan Google lalu ulangi tindakan.");
    }
    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try {
        const j = JSON.parse(txt);
        msg = j.error?.message || j.error_description || txt;
      } catch {}
      throw new Error(msg || `Google API error ${res.status}`);
    }
    return res;
  }

  function applyGoogleToken(response) {
    if (response?.error) {
      state.token = null;
      state.tokenExpiresAt = 0;
      state.googleReady = false;
      const msg = response.error_description || response.error || "Google OAuth gagal.";
      setStatus("Gagal menghubungkan Google: " + msg, "err");
      throw new Error(msg);
    }
    state.token = response.access_token;
    state.tokenExpiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000);
    state.googleReady = true;
    setStatus("Google terhubung. Akun siap digunakan untuk Sheets & Drive.", "ok");
    if ($("setupBtn")) $("setupBtn").disabled = false;
    renderAppReady();
    return response;
  }

  function initGoogleClient() {
    if (!clientId()) throw new Error("Google OAuth Client ID belum diisi.");
    if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services belum siap. Coba muat ulang halaman.");
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
      callback: response => {
        const pending = state.tokenRequest;
        state.tokenRequest = null;
        try {
          const result = applyGoogleToken(response);
          if (pending) pending.resolve(result);
        } catch (e) {
          if (pending) pending.reject(e);
        }
      }
    });
  }

  function requestGoogleTokenOnce(prompt = "") {
    if (!state.tokenClient) initGoogleClient();
    if (state.tokenRequest) return state.tokenRequest.promise;

    let resolvePromise, rejectPromise;
    let timer;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = value => { clearTimeout(timer); resolve(value); };
      rejectPromise = error => { clearTimeout(timer); reject(error); };
    });
    state.tokenRequest = {promise, resolve: resolvePromise, reject: rejectPromise};

    // Never leave Save/Search hanging forever if a browser blocks or loses the
    // OAuth popup callback. The caller can then retry with an interactive prompt.
    timer = setTimeout(() => {
      if (state.tokenRequest?.promise === promise) {
        state.tokenRequest = null;
        rejectPromise(new Error("Google OAuth tidak merespons. Jika popup diblokir, izinkan popup untuk situs ini lalu klik Hubungkan Google lagi."));
      }
    }, 12000);

    try {
      state.tokenClient.requestAccessToken({prompt});
    } catch (e) {
      state.tokenRequest = null;
      rejectPromise(e);
    }
    return promise;
  }

  async function requestGoogleToken(options = {}) {
    const interactive = options.interactive !== false;
    if (state.token && Date.now() < state.tokenExpiresAt - 60000) {
      state.googleReady = true;
      return {access_token: state.token, expires_in: Math.max(1, Math.floor((state.tokenExpiresAt - Date.now()) / 1000))};
    }

    // First try the no-prompt token flow. This avoids unnecessary Google popups
    // after the user has already granted this application access.
    try {
      return await requestGoogleTokenOnce("");
    } catch (e) {
      const msg = String(e?.message || e || "");
      const needsInteraction = /interaction_required|login_required|consent_required|access_denied|tidak merespons|popup/i.test(msg);
      if (!interactive || !needsInteraction) throw e;
      // This function is normally called from a real user click (Connect, Save,
      // Search, Edit or Delete), so Google may safely open its authorization UI.
      return await requestGoogleTokenOnce("consent");
    }
  }

  async function createDriveJson(path, body, method = "POST") {
    const res = await googleFetch("https://www.googleapis.com/drive/v3/files" + path, {method, body: JSON.stringify(body)});
    return res.json();
  }

  async function createFolder(name, parentId = null) {
    const body = {name, mimeType:"application/vnd.google-apps.folder"};
    if (parentId) body.parents = [parentId];
    return createDriveJson("", body);
  }

  async function moveFile(fileId, parentId) {
    return createDriveJson(`/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(parentId)}&removeParents=root&fields=id,parents`, {}, "PATCH");
  }

  async function createSpreadsheet(name, tabs) {
    const body = {properties:{title:name}, sheets:tabs.map(title => ({properties:{title}}))};
    const res = await googleFetch("https://sheets.googleapis.com/v4/spreadsheets", {method:"POST", body:JSON.stringify(body)});
    return res.json();
  }

  async function clearSheet(spreadsheetId, title) {
    const range = encodeURIComponent(`${title}!A:ZZ`);
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:clear`, {method:"POST", body:"{}"});
  }

  async function writeSheetHeader(spreadsheetId, title, headers) {
    const range = encodeURIComponent(`${title}!A1`);
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`, {method:"PUT", body:JSON.stringify({range:`${title}!A1`,majorDimension:"ROWS",values:[headers]})});
  }

  async function setupGoogleStructure() {
    try {
      await requestGoogleToken({interactive:true});
      setStatus("Memeriksa struktur Google yang sudah ada...", "warn");
      $("setupBtn").disabled = true;

      const existing = await findExistingGoogleStructure();
      if (existing?.rootFolderId && existing?.units) {
        setStatus("Struktur Google sudah ada dan digunakan kembali. Tidak membuat folder/Spreadsheet baru.", "ok");
        $("setupBtn").disabled = false;
        renderAppReady();
        return;
      }

      // No matching root exists, so this is the first setup for this Google account/app.
      const root = await createFolder(ARSIP_APP_NAME);
      await markDriveFile(root.id);
      const setup = {version:4, rootFolderId:root.id, createdAt:nowIso(), units:{}};

      for (const key of UNIT_KEYS) {
        const unit = ARSIP_UNITS[key];
        const unitFolder = await createFolder(`${unit.label} - ${unit.shortCode}`, root.id);
        await markDriveFile(unitFolder.id);
        const docsFolder = await createFolder("Dokumen", unitFolder.id);
        await markDriveFile(docsFolder.id);
        const spreadsheet = await createSpreadsheet(unit.spreadsheetName, unit.categories);
        await moveFile(spreadsheet.spreadsheetId, unitFolder.id);
        await markDriveFile(spreadsheet.spreadsheetId);
        const categoryFolders = {};
        for (const cat of unit.categories) {
          categoryFolders[cat] = (await createFolder(cat, docsFolder.id)).id;
        }
        for (const cat of unit.categories) {
          await writeSheetHeader(spreadsheet.spreadsheetId, cat, SCHEMAS[cat]);
        }
        setup.units[key] = {folderId:unitFolder.id, docsFolderId:docsFolder.id, categoryFolders, spreadsheetId:spreadsheet.spreadsheetId, sheets:unit.categories};
      }
      saveGoogleSetup(setup);
      setStatus("Struktur arsip Google berhasil dibuat satu kali. Struktur ini akan dipakai kembali.", "ok");
      $("setupBtn").disabled = false;
      renderAppReady();
    } catch (e) {
      $("setupBtn").disabled = false;
      throw e;
    }
  }

  function renderAppReady() {
    state.setup = googleSetup();
    // The form itself does not need a Google token. This lets a user open /arsip
    // on another device and start typing immediately. Google is required only
    // when searching/saving/uploading/editing/deleting.
    $("appCard").classList.remove("hidden");
    buildUnitOptions();
    buildTypeOptions();
    renderTabs();
    if (!state.category) {
      state.category = ARSIP_UNITS["ra"]?.categories?.[0] || "Siswa";
      renderTabs();
      renderForm();
    }
    if (state.setup?.units) {
      $("authCard").classList.add("hidden");
    } else {
      $("authCard").classList.remove("hidden");
    }
  }

  function buildUnitOptions() {
    const selects = [$("searchUnit")];
    for (const sel of selects) {
      sel.innerHTML = `<option value="">Semua unit</option>` + UNIT_KEYS.map(k=>`<option value="${k}">${escapeHtml(UNIT_LABELS[k])}</option>`).join("");
    }
  }

  function buildTypeOptions() {
    $("searchType").innerHTML = `<option value="">Semua</option>` + SURAT_TYPES.map(([c,l])=>`<option value="${c}">${c} — ${escapeHtml(l)}</option>`).join("");
  }

  function renderTabs() {
    const cats = ["Siswa","Pegawai","Lembaga","Yayasan","Persuratan"];
    $("categoryTabs").innerHTML = cats.map(c=>`<button class="tab ${state.category===c?'active':''}" data-cat="${c}">${c}</button>`).join("");
    document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>selectCategory(btn.dataset.cat)));
  }

  function unitHasCategory(key, category) { return Boolean(ARSIP_UNITS[key]?.categories?.includes(category)); }

  function availableUnits(category) { return UNIT_KEYS.filter(k=>unitHasCategory(k, category)); }

  function selectCategory(category) {
    state.category = category;
    renderTabs();
    $("searchTypeWrap").classList.toggle("hidden", category !== "Persuratan");
    renderForm();
    if (state.googleReady && state.setup?.units) searchRecords().catch(e=>setStatus("Gagal memuat arsip: " + (e?.message || e), "err"));
  }

  function renderForm(editRecord = null) {
    const category = state.category;
    $("formTitle").textContent = editRecord ? "Edit Arsip" : `Tambah ${category}`;
    $("formHint").textContent = category === "Persuratan" ? "Pilih unit dan tanggal; nomor surat dibuat otomatis berdasarkan urutan unit." : "Isi data teks lalu unggah dokumen yang tersedia. File akan masuk ke Google Drive dan link-nya disimpan di Google Sheets.";
    const units = availableUnits(category);
    const unitDefault = editRecord?.unitKey || units[0] || "ra";
    let html = `<div class="grid two">`;
    html += `<div class="field"><label>Unit</label><select id="f_unit" class="select">${units.map(k=>`<option value="${k}" ${k===unitDefault?'selected':''}>${escapeHtml(UNIT_LABELS[k])}</option>`).join("")}</select></div>`;
    if (category === "Persuratan") {
      html += `<div class="field"><label>Jenis Surat</label><select id="f_type" class="select">${SURAT_TYPES.map(([c,l])=>`<option value="${c}" ${editRecord?.jenisKode===c?'selected':''}>${c} — ${escapeHtml(l)}</option>`).join("")}</select></div>`;
      html += `</div><div class="grid two" style="margin-top:12px"><div class="field"><label>Tanggal Surat</label><input id="f_date" class="input" type="date" value="${escapeHtml(editRecord?.tanggal || '')}"></div><div class="field"><label>Perihal</label><input id="f_perihal" class="input" value="${escapeHtml(editRecord?.perihal || '')}" placeholder="Perihal surat"></div></div>`;
      html += `<div style="margin-top:12px" id="numberPreview" class="number-preview">Nomor surat akan dihitung saat disimpan.</div>`;
      html += `<div class="field" style="margin-top:12px"><label>Keterangan</label><textarea id="f_keterangan" class="textarea">${escapeHtml(editRecord?.keterangan || '')}</textarea></div>`;
      html += fileInputHtml(category, editRecord);
    } else {
      html += `</div>`;
      html += genericFieldsHtml(category, editRecord);
      html += fileInputHtml(category, editRecord);
    }
    html += `<div style="display:flex;gap:8px;margin-top:16px"><button id="saveBtn" class="btn">${editRecord?'Simpan Perubahan':'Simpan Arsip'}</button>${editRecord?'<button id="cancelEdit" class="btn gray">Batal</button>':''}</div>`;
    $("formBody").innerHTML = html;
    $("f_unit")?.addEventListener("change", previewNumber);
    $("f_type")?.addEventListener("change", previewNumber);
    $("f_date")?.addEventListener("change", previewNumber);
    $("saveBtn").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); void saveRecord(editRecord); });
    $("cancelEdit")?.addEventListener("click", () => {state.editing=null;renderForm();});
    previewNumber();
  }

  function genericFieldsHtml(category, r) {
    const v = r || {};
    if (category === "Siswa") return `<div class="grid two" style="margin-top:12px">
      ${field("Nama Lengkap","f_nama",v.nama)}${field("NIK","f_nik",v.nik)}${field("NIS/NISN","f_nisn",v.nisn)}${field("Tempat Lahir","f_tempat_lahir",v.tempatLahir)}${field("Tanggal Lahir","f_tgl_lahir",v.tglLahir,"date")}${field("Alamat","f_alamat",v.alamat)}${field("Nama Ayah","f_ayah",v.ayah)}${field("Nama Ibu","f_ibu",v.ibu)}${field("Tanggal Masuk","f_tgl_masuk",v.tglMasuk,"date")}${field("Status","f_status",v.status||"Aktif")}${field("Tahun Lulus","f_lulus",v.tahunLulus,"number")}${field("Pindah Ke","f_pindah",v.pindahKe)}${field("Lanjut Ke","f_lanjut",v.lanjutKe)}${field("Keterangan","f_keterangan",v.keterangan,"textarea")}</div>`;
    if (category === "Pegawai") return `<div class="grid two" style="margin-top:12px">${field("Nama Lengkap","f_nama",v.nama)}${field("NIK","f_nik",v.nik)}${field("NUPTK/NPK","f_nuptk",v.nuptk)}${field("Tempat Lahir","f_tempat_lahir",v.tempatLahir)}${field("Tanggal Lahir","f_tgl_lahir",v.tglLahir,"date")}${field("Alamat","f_alamat",v.alamat)}${field("Pendidikan","f_pendidikan",v.pendidikan)}${field("Jabatan","f_jabatan",v.jabatan)}${field("Tanggal Mulai","f_tgl_mulai",v.tglMulai,"date")}${field("Status","f_status",v.status||"Aktif")}${field("Unit/Lembaga","f_unit_teks",v.unitTeks)}${field("Keterangan","f_keterangan",v.keterangan,"textarea")}</div>`;
    if (category === "Lembaga") return `<div class="grid two" style="margin-top:12px">${field("Nama Lembaga","f_nama",v.nama)}${field("Nomor Identitas","f_nomor",v.nomor)}${field("Alamat","f_alamat",v.alamat)}${field("Kepala/Pimpinan","f_pimpinan",v.pimpinan)}${field("Tanggal Berdiri","f_tgl_berdiri",v.tglBerdiri,"date")}${field("Status","f_status",v.status||"Aktif")}${field("Keterangan","f_keterangan",v.keterangan,"textarea")}</div>`;
    if (category === "Yayasan") return `<div class="grid two" style="margin-top:12px">${field("Nama Yayasan","f_nama",v.nama)}${field("Nomor Identitas","f_nomor",v.nomor)}${field("Alamat","f_alamat",v.alamat)}${field("Ketua","f_ketua",v.ketua)}${field("Tanggal Berdiri","f_tgl_berdiri",v.tglBerdiri,"date")}${field("Status","f_status",v.status||"Aktif")}${field("Keterangan","f_keterangan",v.keterangan,"textarea")}</div>`;
    return "";
  }

  function field(label,id,value="",type="text") {
    const safe = escapeHtml(value);
    if (type === "textarea") return `<div class="field"><label>${label}</label><textarea id="${id}" class="textarea">${safe}</textarea></div>`;
    return `<div class="field"><label>${label}</label><input id="${id}" class="input" type="${type}" value="${safe}"></div>`;
  }

  function fileInputHtml(category, r) {
    const fields = FILE_FIELDS[category] || [];
    return `<div style="margin-top:16px"><strong>Dokumen</strong><div class="file-list">${fields.map(([key,label])=>`<div class="file-item"><label>${label}</label><input data-file-key="${key}" type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"></div>`).join("")}</div><p class="google-note">File baru hanya mengganti dokumen pada kolom tersebut. File lama tidak dihapus otomatis.</p></div>`;
  }

  async function previewNumber() {
    if (state.category !== "Persuratan" || !$("numberPreview")) return;
    const unitKey = $("f_unit")?.value;
    const type = $("f_type")?.value;
    const date = $("f_date")?.value;
    if (!unitKey || !type || !date) { $("numberPreview").textContent = "Nomor surat akan dihitung saat disimpan."; return; }
    try {
      const next = await nextLetterNumber(unitKey);
      const d = new Date(date + "T00:00:00");
      $("numberPreview").textContent = `${ARSIP_UNITS[unitKey].code}/${String(next).padStart(3,"0")}/${type}/${ARSIP_UNITS[unitKey].shortCode}/${romanMonth(d.getMonth()+1)}/${d.getFullYear()}`;
    } catch (e) { $("numberPreview").textContent = "Nomor akan dihitung saat disimpan."; }
  }

  async function ensureCategoryHeaders(unitKey, category) {
    const u = state.setup.units[unitKey];
    if (!u || !u.spreadsheetId || !u.sheets.includes(category)) return;
    const required = SCHEMAS[category] || [];
    const range = encodeURIComponent(`${category}!A1:ZZ1`);
    const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}/values/${range}`);
    const data = await res.json();
    const current = data.values?.[0] || [];
    if (!current.length) {
      await writeSheetHeader(u.spreadsheetId, category, required);
      return;
    }
    const missing = required.filter(h => !current.includes(h));
    if (!missing.length) return;
    // Append missing columns at the end so existing data/column positions remain intact.
    const merged = current.concat(missing);
    await writeSheetHeader(u.spreadsheetId, category, merged);
  }

  async function getSheetValues(unitKey, category) {
    const u = state.setup.units[unitKey];
    if (!u || !u.sheets.includes(category)) return [];
    await ensureCategoryHeaders(unitKey, category);
    const range = encodeURIComponent(`${category}!A:ZZ`);
    const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}/values/${range}`);
    return (await res.json()).values || [];
  }

  function rowsToObjects(values) {
    if (!values.length) return [];
    const headers = values[0];
    return values.slice(1).map((row, idx) => {
      const o = {_row:idx+2};
      headers.forEach((h,i)=>o[h]=row[i] ?? "");
      return o;
    });
  }

  async function nextLetterNumber(unitKey) {
    const values = await getSheetValues(unitKey, "Persuratan");
    if (values.length <= 1) return 1;
    const idx = values[0].indexOf("Nomor Surat");
    const codeIdx = values[0].indexOf("Kode Unit");
    const unitCode = ARSIP_UNITS[unitKey].code;
    let max = 0;
    for (const row of values.slice(1)) {
      if (codeIdx >= 0 && row[codeIdx] !== unitCode) continue;
      const m = String(row[idx] || "").match(new RegExp("^" + unitCode.replace(".","\\.") + "\\/(\\d+)\\/"));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  }

  async function appendRow(unitKey, category, row) {
    const u = state.setup.units[unitKey];
    const range = encodeURIComponent(`${category}!A1`);
    const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {method:"POST", body:JSON.stringify({majorDimension:"ROWS",values:[row]})});
    const data = await res.json();
    if (Number(data?.updates?.updatedRows || 0) !== 1) throw new Error("Google Sheets tidak mengonfirmasi penambahan 1 baris.");
    return data;
  }

  async function updateRow(unitKey, category, rowNumber, row) {
    const u = state.setup.units[unitKey];
    const range = encodeURIComponent(`${category}!A${rowNumber}`);
    const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}/values/${range}?valueInputOption=RAW`, {method:"PUT", body:JSON.stringify({majorDimension:"ROWS",values:[row]})});
    const data = await res.json();
    if (Number(data?.updatedRows || 0) !== 1) throw new Error("Google Sheets tidak mengonfirmasi perubahan 1 baris.");
    return data;
  }

  async function deleteDriveFileByUrl(url) {
    if (!url) return;
    let id = null;
    const m1 = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    const m2 = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m1) id = m1[1]; else if (m2) id = m2[1];
    if (!id) return;
    try { await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, {method:"DELETE"}); } catch (e) { console.warn("File Drive tidak berhasil dihapus:", id, e.message); }
  }

  async function deleteRow(unitKey, category, rowNumber) {
    const u = state.setup.units[unitKey];
    const metaRes = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}?fields=sheets(properties(sheetId,title))`);
    const meta = await metaRes.json();
    const sheet = meta.sheets.find(s=>s.properties.title===category);
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(u.spreadsheetId)}:batchUpdate`, {method:"POST",body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:sheet.properties.sheetId,dimension:"ROWS",startIndex:rowNumber-1,endIndex:rowNumber}}}]})});
  }

  async function uploadFile(file, folderId) {
    if (!file) return null;
    const metadata = {name:file.name, parents:[folderId], description:`Arsip YPI Al-Amin Al-Ma'arif | ${currentUser()}`};
    const boundary = "-------arsip" + Math.random().toString(16).slice(2);
    const meta = JSON.stringify(metadata);
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`, file, `\r\n--${boundary}--`]);
    const res = await googleFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink", {method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body});
    return res.json();
  }

  function value(id) { return $(id)?.value?.trim() || ""; }

  async function collectFiles(category, unitKey) {
    const folderId = state.setup.units[unitKey].categoryFolders[category] || state.setup.units[unitKey].docsFolderId;
    const out = {};
    for (const [key] of (FILE_FIELDS[category] || [])) {
      const input = document.querySelector(`input[data-file-key="${key}"]`);
      if (input?.files?.[0]) out[key] = await uploadFile(input.files[0], folderId);
    }
    return out;
  }

  function mergeLinks(record, files) {
    const r = {...record};
    Object.entries(files).forEach(([key,f])=>{ if (!f) return; r[key] = f.webViewLink || `https://drive.google.com/open?id=${f.id}`; r[key+"_download"] = f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`; r[key+"_fileId"] = f.id; r[key+"_fileName"] = f.name; });
    return r;
  }

  function readGenericForm(category) {
    const unitKey = value("f_unit");
    const common = {unitKey, unitLabel:UNIT_LABELS[unitKey]};
    if (category === "Siswa") return {...common,nama:value("f_nama"),nik:value("f_nik"),nisn:value("f_nisn"),tempatLahir:value("f_tempat_lahir"),tglLahir:value("f_tgl_lahir"),alamat:value("f_alamat"),ayah:value("f_ayah"),ibu:value("f_ibu"),tglMasuk:value("f_tgl_masuk"),status:value("f_status"),tahunLulus:value("f_lulus"),pindahKe:value("f_pindah"),lanjutKe:value("f_lanjut"),keterangan:value("f_keterangan")};
    if (category === "Pegawai") return {...common,nama:value("f_nama"),nik:value("f_nik"),nuptk:value("f_nuptk"),tempatLahir:value("f_tempat_lahir"),tglLahir:value("f_tgl_lahir"),alamat:value("f_alamat"),pendidikan:value("f_pendidikan"),jabatan:value("f_jabatan"),tglMulai:value("f_tgl_mulai"),status:value("f_status"),unitTeks:value("f_unit_teks"),keterangan:value("f_keterangan")};
    if (category === "Lembaga") return {...common,nama:value("f_nama"),nomor:value("f_nomor"),alamat:value("f_alamat"),pimpinan:value("f_pimpinan"),tglBerdiri:value("f_tgl_berdiri"),status:value("f_status"),keterangan:value("f_keterangan")};
    if (category === "Yayasan") return {...common,nama:value("f_nama"),nomor:value("f_nomor"),alamat:value("f_alamat"),ketua:value("f_ketua"),tglBerdiri:value("f_tgl_berdiri"),status:value("f_status"),keterangan:value("f_keterangan")};
  }

  function objectToRow(category, r) {
    const c = SCHEMAS[category];
    const map = {
      "ID":r.id,"Dibuat":r.dibuat,"Diubah":r.diubah,"Nama Lengkap":r.nama,"NIK":r.nik,"NIS/NISN":r.nisn,"Tempat Lahir":r.tempatLahir,"Tanggal Lahir":r.tglLahir,"Alamat":r.alamat,"Nama Ayah":r.ayah,"Nama Ibu":r.ibu,"Tanggal Masuk":r.tglMasuk,"Status":r.status,"Tahun Lulus":r.tahunLulus,"Pindah Ke":r.pindahKe,"Lanjut Ke":r.lanjutKe,"Keterangan":r.keterangan,"NUPTK/NPK":r.nuptk,"Pendidikan":r.pendidikan,"Jabatan":r.jabatan,"Tanggal Mulai":r.tglMulai,"Unit":r.unitLabel,"Unit/Lembaga":r.unitTeks,"Nama Lembaga":r.nama,"Nama Yayasan":r.nama,"Nomor Identitas":r.nomor,"Kepala/Pimpinan":r.pimpinan,"Ketua":r.ketua,"Tanggal Berdiri":r.tglBerdiri,
      "Akta":r.akta,"KK":r.kk,"KTP Orang Tua":r.ktp_ortu,"KTP":r.ktp,"NPWP":r.npwp,"Rekening":r.rekening,"Ijazah":r.ijazah,"e-Rapor":r.e_rapor,"Sertifikat":r.sertifikat,"SK/Legalitas":r.sk_legalitas,"Akta Notaris":r.akta_notaris,"SK Kemenkumham":r.sk_kemenkumham,"Dokumen Lain":r.dokumen_lain,
      "Nomor Surat":r.nomorSurat,"Kode Unit":r.kodeUnit,"Jenis Kode":r.jenisKode,"Jenis Surat":r.jenisLabel,"Tanggal Surat":r.tanggal,"Bulan":r.bulan,"Tahun":r.tahun,"Perihal":r.perihal,"File":r.file
    };
    return c.map(h=>map[h] ?? "");
  }

  async function saveRecord(editRecord) {
    const btn = $("saveBtn");
    if (state.saving) return;
    state.saving = true;
    if (btn) { btn.disabled = true; btn.textContent = editRecord ? "Menyimpan perubahan..." : "Menyimpan..."; }
    setStatus("Menyiapkan penyimpanan...", "warn");
    try {
      if (!state.setup?.units) throw new Error("Struktur arsip Google belum ditemukan. Klik Hubungkan Google terlebih dahulu.");

      // Do not silently open OAuth from a background state. If this browser has
      // no active Google token, ask the user to use the explicit Connect button.
      if (!state.googleReady || !state.token || Date.now() >= state.tokenExpiresAt - 60000) {
        throw new Error("Google belum terhubung pada sesi ini. Klik tombol \"Hubungkan Google\" terlebih dahulu, lalu klik Simpan lagi.");
      }

      const category = state.category;
      const unitKey = value("f_unit");
      if (!unitKey || !unitHasCategory(unitKey, category)) throw new Error("Unit tidak sesuai dengan jenis arsip.");

      setStatus("Membaca data formulir...", "warn");
      const formData = category === "Persuratan" ? await readLetterForm(unitKey, editRecord) : readGenericForm(category);
      if (category !== "Persuratan" && !formData.nama) throw new Error("Nama wajib diisi.");

      const base = editRecord ? {...editRecord, ...formData} : formData;
      setStatus("Mengunggah dokumen ke Google Drive...", "warn");
      const files = await collectFiles(category, unitKey);
      const uploadedFileIds = Object.values(files).filter(Boolean).map(f => f.id).filter(Boolean);
      const merged = mergeLinks(base, files);
      merged.id = editRecord?.id || uuid();
      merged.dibuat = editRecord?.dibuat || nowIso();
      merged.diubah = nowIso();

      setStatus("Menyimpan data ke Google Sheets...", "warn");
      try {
        if (editRecord) await updateRow(unitKey, category, editRecord._row, objectToRow(category, merged));
        else await appendRow(unitKey, category, objectToRow(category, merged));
      } catch (sheetError) {
        // Prevent orphaned uploads when the Sheet write fails.
        if (!editRecord) {
          for (const fileId of uploadedFileIds) {
            try { await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {method:"DELETE"}); } catch (cleanupError) { console.warn("Cleanup upload gagal:", cleanupError); }
          }
        }
        throw sheetError;
      }

      state.editing = null;
      renderForm();
      setStatus(editRecord ? "Arsip berhasil diperbarui." : "Arsip berhasil disimpan.", "ok");
      alert(editRecord ? "✅ Arsip berhasil diperbarui." : "✅ Arsip berhasil disimpan.\n\nData teks/link sudah masuk ke Google Sheets dan file yang diunggah masuk ke Google Drive.");
      // Refresh the visible results only after the success notification.
      // If the refresh fails, it must not turn a successful save into a false failure.
      try { await searchRecords(); } catch (refreshError) {
        console.warn("Arsip tersimpan, tetapi penyegaran hasil pencarian gagal:", refreshError);
      }
    } catch(e) {
      console.error("[ARSIP SAVE ERROR]", e);
      setStatus("Gagal menyimpan: " + (e?.message || e), "err");
      alert("❌ Gagal menyimpan.\n\n" + (e?.message || e));
    } finally {
      state.saving = false;
      const currentBtn = $("saveBtn");
      if (currentBtn) { currentBtn.disabled = false; currentBtn.textContent = state.editing ? "Simpan Perubahan" : "Simpan Arsip"; }
    }
  }

  async function readLetterForm(unitKey, editRecord) {
    const type = value("f_type"), date = value("f_date");
    if (!type || !date) throw new Error("Jenis surat dan tanggal wajib diisi.");
    const d = new Date(date+"T00:00:00");
    let number;
    if (editRecord?.nomorSurat) number = editRecord.nomorSurat;
    else number = `${ARSIP_UNITS[unitKey].code}/${String(await nextLetterNumber(unitKey)).padStart(3,"0")}/${type}/${ARSIP_UNITS[unitKey].shortCode}/${romanMonth(d.getMonth()+1)}/${d.getFullYear()}`;
    const label = Object.fromEntries(SURAT_TYPES)[type];
    return {unitKey,unitLabel:UNIT_LABELS[unitKey],nomorSurat:number,kodeUnit:ARSIP_UNITS[unitKey].code,jenisKode:type,jenisLabel:label,tanggal:date,bulan:romanMonth(d.getMonth()+1),tahun:d.getFullYear(),perihal:value("f_perihal"),keterangan:value("f_keterangan")};
  }

  function normalizeSearch(obj, category) {
    return [obj.nama,obj.nik,obj.nisn,obj.alamat,obj.jabatan,obj.unitLabel,obj.nomorSurat,obj.jenisLabel,obj.tanggal,obj.tahun,obj.perihal,obj.keterangan,obj.nomor].filter(Boolean).join(" ").toLowerCase();
  }

  async function searchRecords() {
    if (!state.setup?.units || !state.category) return [];
    const category = state.category;
    const selectedUnit = $("searchUnit").value;
    const q = $("searchText").value.trim().toLowerCase();
    const year = $("searchYear").value.trim();
    const type = $("searchType").value;
    const units = selectedUnit ? [selectedUnit] : availableUnits(category);
    const all=[];
    const resultsByUnit = await Promise.all(units.map(async unitKey => {
      const vals = await getSheetValues(unitKey, category);
      const matches = [];
      for (const r of rowsToObjects(vals)) {
        const obj = sheetObject(category,r,unitKey);
        if (q && !normalizeSearch(obj,category).includes(q)) continue;
        if (year && String(obj.tahun || obj.tanggal || "").slice(0,4) !== year) continue;
        if (category === "Persuratan" && type && obj.jenisKode !== type) continue;
        matches.push(obj);
      }
      return matches;
    }));
    resultsByUnit.forEach(matches => all.push(...matches));
    all.sort((a,b)=>String(b.diubah||b.dibuat).localeCompare(String(a.diubah||a.dibuat)));
    state.rows=all;
    renderResults(all);
    return all;
  }

  function sheetObject(category,r,unitKey) {
    const o={_row:r._row,unitKey,unitLabel:UNIT_LABELS[unitKey],id:r.ID,dibuat:r.Dibuat,diubah:r.Diubah};
    if (category === "Siswa") Object.assign(o,{nama:r["Nama Lengkap"],nik:r.NIK,nisn:r["NIS/NISN"],tempatLahir:r["Tempat Lahir"],tglLahir:r["Tanggal Lahir"],alamat:r.Alamat,ayah:r["Nama Ayah"],ibu:r["Nama Ibu"],tglMasuk:r["Tanggal Masuk"],status:r.Status,tahunLulus:r["Tahun Lulus"],pindahKe:r["Pindah Ke"],lanjutKe:r["Lanjut Ke"],keterangan:r.Keterangan,akta:r.Akta,kk:r.KK,ktp_ortu:r["KTP Orang Tua"],ijazah:r.Ijazah,e_rapor:r["e-Rapor"],dokumen_lain:r["Dokumen Lain"]});
    if (category === "Pegawai") Object.assign(o,{nama:r["Nama Lengkap"],nik:r.NIK,nuptk:r["NUPTK/NPK"],tempatLahir:r["Tempat Lahir"],tglLahir:r["Tanggal Lahir"],alamat:r.Alamat,pendidikan:r.Pendidikan,jabatan:r.Jabatan,tglMulai:r["Tanggal Mulai"],status:r.Status,unitTeks:r["Unit/Lembaga"],keterangan:r.Keterangan,kk:r.KK,ktp:r.KTP,npwp:r.NPWP,rekening:r.Rekening,ijazah:r.Ijazah,sertifikat:r.Sertifikat,dokumen_lain:r["Dokumen Lain"]});
    if (category === "Lembaga") Object.assign(o,{nama:r["Nama Lembaga"],nomor:r["Nomor Identitas"],alamat:r.Alamat,pimpinan:r["Kepala/Pimpinan"],tglBerdiri:r["Tanggal Berdiri"],status:r.Status,keterangan:r.Keterangan,akta:r.Akta,sk_legalitas:r["SK/Legalitas"],npwp:r.NPWP,dokumen_lain:r["Dokumen Lain"]});
    if (category === "Yayasan") Object.assign(o,{nama:r["Nama Yayasan"],nomor:r["Nomor Identitas"],alamat:r.Alamat,ketua:r.Ketua,tglBerdiri:r["Tanggal Berdiri"],status:r.Status,keterangan:r.Keterangan,akta_notaris:r["Akta Notaris"],sk_kemenkumham:r["SK Kemenkumham"],npwp:r.NPWP,dokumen_lain:r["Dokumen Lain"]});
    if (category === "Persuratan") Object.assign(o,{nomorSurat:r["Nomor Surat"],kodeUnit:r["Kode Unit"],jenisKode:r["Jenis Kode"],jenisLabel:r["Jenis Surat"],tanggal:r["Tanggal Surat"],bulan:r.Bulan,tahun:r.Tahun,perihal:r.Perihal,keterangan:r.Keterangan,file:r.File});
    return o;
  }

  function driveFileId(url) {
    if (!url) return "";
    const m1 = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    const m2 = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m1?.[1] || m2?.[1] || "";
  }

  function linkHtml(label,url) {
    if (!url) return "";
    const id = driveFileId(url);
    const download = id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : url;
    return `<span class="doc-link-group"><a class="pill" target="_blank" rel="noopener" href="${escapeHtml(url)}">Lihat ${escapeHtml(label)}</a><a class="pill" target="_blank" rel="noopener" href="${escapeHtml(download)}">Download</a></span>`;
  }

  function renderResults(rows) {
    $("resultInfo").textContent = `${rows.length} arsip ditemukan.`;
    if (!rows.length) { $("results").innerHTML='<div class="empty">Belum ada data yang cocok.</div>'; return; }
    $("results").innerHTML = rows.map((r,i)=>resultCard(r,i)).join("");
    rows.forEach((r,i)=>{
      $("edit_"+i)?.addEventListener("click",()=>editRecord(r));
      $("delete_"+i)?.addEventListener("click",()=>deleteRecordConfirm(r));
    });
  }

  function resultCard(r,i) {
    const title = state.category === "Persuratan" ? r.nomorSurat : r.nama;
    const subtitle = state.category === "Persuratan" ? `${r.jenisLabel || r.jenisKode || ""} • ${r.tanggal || ""} • ${r.unitLabel}` : `${r.unitLabel} • ${r.status || ""}`;
    let detail="";
    if (state.category === "Siswa") detail=`NIK: ${escapeHtml(r.nik)}<br>Masuk: ${escapeHtml(r.tglMasuk)}<br>Lanjut: ${escapeHtml(r.lanjutKe)}<br>Alamat: ${escapeHtml(r.alamat)}`;
    if (state.category === "Pegawai") detail=`NIK: ${escapeHtml(r.nik)}<br>Jabatan: ${escapeHtml(r.jabatan)}<br>Unit: ${escapeHtml(r.unitTeks)}`;
    if (state.category === "Lembaga") detail=`Nomor: ${escapeHtml(r.nomor)}<br>Pimpinan: ${escapeHtml(r.pimpinan)}<br>Alamat: ${escapeHtml(r.alamat)}`;
    if (state.category === "Yayasan") detail=`Nomor: ${escapeHtml(r.nomor)}<br>Ketua: ${escapeHtml(r.ketua)}<br>Alamat: ${escapeHtml(r.alamat)}`;
    if (state.category === "Persuratan") detail=`Perihal: ${escapeHtml(r.perihal)}<br>Keterangan: ${escapeHtml(r.keterangan)}`;
    const docs = state.category === "Siswa" ? [["Akta",r.akta],["KK",r.kk],["KTP Ortu",r.ktp_ortu],["Ijazah",r.ijazah],["e-Rapor",r.e_rapor],["Lain",r.dokumen_lain]] : state.category === "Pegawai" ? [["KK",r.kk],["KTP",r.ktp],["NPWP",r.npwp],["Rekening",r.rekening],["Ijazah",r.ijazah],["Sertifikat",r.sertifikat],["Lain",r.dokumen_lain]] : state.category === "Lembaga" ? [["Akta",r.akta],["SK/Legalitas",r.sk_legalitas],["NPWP",r.npwp],["Lain",r.dokumen_lain]] : state.category === "Yayasan" ? [["Akta Notaris",r.akta_notaris],["SK Kemenkumham",r.sk_kemenkumham],["NPWP",r.npwp],["Lain",r.dokumen_lain]] : [["File Surat",r.file]];
    return `<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><strong>${escapeHtml(title || "Tanpa nama")}</strong><div class="muted">${escapeHtml(subtitle)}</div></div><div class="actions"><button id="edit_${i}" class="btn small">Edit</button><button id="delete_${i}" class="btn danger small">Hapus</button></div></div><div class="muted" style="margin-top:10px;line-height:1.7">${detail}</div><div class="doc-links" style="margin-top:10px">${docs.map(([l,u])=>linkHtml(l,u)).join("")}</div></div>`;
  }

  function editRecord(r) { state.editing=r; renderForm(r); window.scrollTo({top:document.getElementById("formCard").offsetTop-20,behavior:"smooth"}); }

  async function deleteRecordConfirm(r) {
    if (!confirm(`Hapus arsip ${state.category === "Persuratan" ? r.nomorSurat : r.nama || r.id}?\n\nBaris Google Sheets dan file Drive terkait akan dihapus.`)) return;
    try {
      if (!state.setup?.units) throw new Error("Google belum terhubung.");
      await requestGoogleToken({interactive:true});
      await deleteRow(r.unitKey,state.category,r._row);
      const urls = Object.values(r).filter(v => typeof v === "string" && v.includes("drive.google.com"));
      for (const url of [...new Set(urls)]) await deleteDriveFileByUrl(url);
      await searchRecords();
      alert("Arsip dan file terkait berhasil dihapus.");
    } catch(e){alert("❌ Gagal menghapus.\n\n"+(e?.message || e));}
  }

  $("clientIdInput").value = clientId();
  $("clientIdInput").addEventListener("change", e => localStorage.setItem("arsip_google_client_id", e.target.value.trim()));

  $("googleBtn").addEventListener("click", async()=>{
    try {
      if (!clientId()) throw new Error("Isi Google OAuth Client ID terlebih dahulu.");
      initGoogleClient();
      setStatus("Menghubungkan Google...", "warn");
      await requestGoogleToken({interactive:true});
      const recovered = await ensureGoogleStructure();
      if (recovered) {
        setStatus("Google terhubung. Struktur arsip yang lama ditemukan dan dipakai kembali.", "ok");
        renderAppReady();
      } else {
        setStatus("Google terhubung, tetapi struktur arsip belum ditemukan. Klik Siapkan Struktur untuk membuatnya satu kali.", "warn");
        renderAppReady();
        $("authCard").classList.remove("hidden");
        $("setupBtn").disabled = false;
      }
    } catch(e) {
      console.error(e);
      setStatus("Gagal menghubungkan Google: " + (e?.message || e), "err");
    }
  });

  $("setupBtn").addEventListener("click",()=>setupGoogleStructure().catch(e=>{
    console.error(e);
    setStatus("Gagal menyiapkan struktur: " + (e?.message || e),"err");
    $("setupBtn").disabled=false;
  }));

  $("searchBtn").addEventListener("click", async()=>{
    try {
      if (!state.setup?.units) throw new Error("Struktur arsip Google belum ditemukan.");
      if (!state.googleReady || !state.token || Date.now() >= state.tokenExpiresAt - 60000) {
        throw new Error("Google belum terhubung pada sesi ini. Klik tombol Hubungkan Google terlebih dahulu.");
      }
      setStatus("Mencari arsip...", "warn");
      await searchRecords();
      setStatus("Google terhubung. Pencarian selesai.", "ok");
    } catch(e) {
      console.error("[ARSIP SEARCH ERROR]", e);
      $("results").innerHTML=`<div class="status err">${escapeHtml(e?.message || e)}</div>`;
      setStatus("Gagal mencari: " + (e?.message || e), "err");
    }
  });
  $("searchText").addEventListener("keydown",e=>{if(e.key==="Enter") $("searchBtn").click();});
  $("searchUnit").addEventListener("change",()=>{if(state.googleReady && state.setup?.units) searchRecords().catch(e=>setStatus("Gagal mencari: " + (e?.message || e), "err"));});
  $("searchType").addEventListener("change",()=>{if(state.googleReady && state.setup?.units) searchRecords().catch(e=>setStatus("Gagal mencari: " + (e?.message || e), "err"));});
  $("searchYear").addEventListener("change",()=>{if(state.googleReady && state.setup?.units) searchRecords().catch(e=>setStatus("Gagal mencari: " + (e?.message || e), "err"));});
  $("logoutBtn").addEventListener("click",()=>{localStorage.removeItem("supabase_session");window.location.href="../dashboard/login.html";});
  $("modalClose").addEventListener("click",()=>$ ("modal").classList.add("hidden"));

  // No OAuth popup is attempted automatically on page load. This is deliberate:
  // browsers may block an OAuth popup that is not caused by a user gesture.
  // If the previous device has a cached structure, the form is shown immediately.
  // Google access is requested only from an explicit user action (Connect/Search/Save/Edit/Delete).
  renderAppReady();

})();
