/* ==========================================================
   DASHBOARD YAYASAN - UTILITAS UNIT & TAHUN AJARAN (BATCH 3)
   ========================================================== */

const DASHBOARD_DEFAULT_YEAR = "2026/2027";
const DASHBOARD_YEAR_STORAGE_KEY = "dashboard_tahun_ajaran";
const DASHBOARD_DEFAULT_UNIT = "RA";
const DASHBOARD_UNIT_STORAGE_KEY = "dashboard_unit";
const DASHBOARD_FIXED_UNITS = ["KB", "RA", "TPQ", "MDT", "Pesantren", "Majelis Taklim", "MTs", "MA"];

function getDashboardYearFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tahun_ajaran") || "";
}

function getDashboardUnitFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("unit") || "";
}

function getDashboardYear() {
  const fromUrl = getDashboardYearFromUrl();
  if (fromUrl) {
    localStorage.setItem(DASHBOARD_YEAR_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(DASHBOARD_YEAR_STORAGE_KEY) || DASHBOARD_DEFAULT_YEAR;
}

function getDashboardUnit() {
  const fromUrl = getDashboardUnitFromUrl();
  if (fromUrl) {
    localStorage.setItem(DASHBOARD_UNIT_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(DASHBOARD_UNIT_STORAGE_KEY) || DASHBOARD_DEFAULT_UNIT;
}

function setDashboardYear(year, reload = true) {
  const value = String(year || "").trim();
  if (!value) return;

  localStorage.setItem(DASHBOARD_YEAR_STORAGE_KEY, value);

  if (reload) {
    const url = new URL(window.location.href);
    url.searchParams.set("tahun_ajaran", value);
    url.searchParams.set("unit", getDashboardUnit());
    window.location.href = url.toString();
  }
}

function setDashboardUnit(unit, reload = true) {
  const value = String(unit || "").trim();
  if (!value) return;

  localStorage.setItem(DASHBOARD_UNIT_STORAGE_KEY, value);

  if (reload) {
    const url = new URL(window.location.href);
    url.searchParams.set("tahun_ajaran", getDashboardYear());
    url.searchParams.set("unit", value);
    window.location.href = url.toString();
  }
}

function generateAcademicYears(baseYear = DASHBOARD_DEFAULT_YEAR, count = 5) {
  const match = String(baseYear).match(/^(\d{4})\/(\d{4})$/);
  const start = match ? Number(match[1]) : Number(DASHBOARD_DEFAULT_YEAR.slice(0, 4));
  const result = [];

  for (let i = 0; i < count; i++) {
    const a = start + i;
    result.push(`${a}/${a + 1}`);
  }

  return result;
}

function getYearPickerValue(selectId, customId) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!select) return getDashboardYear();

  if (select.value === "__custom__") {
    return (custom?.value || "").trim();
  }

  return select.value;
}

function setYearPickerValue(selectId, customId, value) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!select) return;

  const years = Array.from(select.options).map(option => option.value);
  const valueString = String(value || "").trim();

  if (valueString && !years.includes(valueString) && valueString !== "__custom__") {
    const option = document.createElement("option");
    option.value = valueString;
    option.textContent = valueString;
    select.insertBefore(option, select.querySelector('option[value="__custom__"]'));
  }

  if (valueString && Array.from(select.options).some(option => option.value === valueString)) {
    select.value = valueString;
    if (custom) custom.hidden = true;
  } else {
    select.value = "__custom__";
    if (custom) {
      custom.hidden = false;
      custom.value = valueString;
    }
  }
}

function setupYearPicker(selectId, customId, applyButtonId, options = {}) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  const apply = document.getElementById(applyButtonId);
  if (!select) return;

  const current = options.value || getDashboardYear();
  const base = options.baseYear || current;
  const years = generateAcademicYears(base, 5);

  select.innerHTML = "";
  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    select.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Custom (ketik sendiri)";
  select.appendChild(customOption);

  setYearPickerValue(selectId, customId, current);
  if (apply) apply.hidden = select.value !== "__custom__";

  select.addEventListener("change", () => {
    const isCustom = select.value === "__custom__";
    if (custom) custom.hidden = !isCustom;
    if (apply) apply.hidden = !isCustom;
    if (!isCustom && options.onChange) options.onChange(select.value);
  });

  if (custom) {
    custom.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        apply?.click();
      }
    });
  }

  if (apply) {
    apply.addEventListener("click", () => {
      const value = getYearPickerValue(selectId, customId);
      if (!/^\d{4}\/\d{4}$/.test(value)) {
        alert("Format tahun ajaran harus seperti 2026/2027.");
        return;
      }
      if (options.onChange) options.onChange(value);
    });
  }
}

function setupUnitPicker(selectId, customId, applyButtonId, options = {}) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  const apply = document.getElementById(applyButtonId);
  if (!select) return;

  const current = String(options.value || getDashboardUnit()).trim();

  select.innerHTML = "";
  DASHBOARD_FIXED_UNITS.forEach(unit => {
    const option = document.createElement("option");
    option.value = unit;
    option.textContent = unit;
    select.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Lainnya (ketik manual)";
  select.appendChild(customOption);

  setUnitPickerValue(selectId, customId, current);
  if (apply) apply.hidden = select.value !== "__custom__";

  select.addEventListener("change", () => {
    const isCustom = select.value === "__custom__";
    if (custom) custom.hidden = !isCustom;
    if (apply) apply.hidden = !isCustom;
    if (!isCustom && options.onChange) options.onChange(select.value);
  });

  if (custom) {
    custom.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        apply?.click();
      }
    });
  }

  if (apply) {
    apply.addEventListener("click", () => {
      const value = getUnitPickerValue(selectId, customId);
      if (!value) {
        alert("Nama unit wajib diisi.");
        return;
      }
      if (options.onChange) options.onChange(value);
    });
  }
}

function getUnitPickerValue(selectId, customId) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!select) return getDashboardUnit();
  if (select.value === "__custom__") return (custom?.value || "").trim();
  return select.value;
}

function setUnitPickerValue(selectId, customId, value) {
  const select = document.getElementById(selectId);
  const custom = document.getElementById(customId);
  if (!select) return;

  const valueString = String(value || "").trim();
  const exists = Array.from(select.options).some(option => option.value === valueString);

  if (valueString && !exists && valueString !== "__custom__") {
    select.value = "__custom__";
    if (custom) {
      custom.hidden = false;
      custom.value = valueString;
    }
    return;
  }

  if (valueString && exists) {
    select.value = valueString;
    if (custom) {
      custom.hidden = true;
      custom.value = "";
    }
  } else {
    select.value = "__custom__";
    if (custom) {
      custom.hidden = false;
      custom.value = valueString;
    }
  }
}

function matchesDashboardYear(item, field = "tahun_ajaran") {
  const active = getDashboardYear();
  const value = item?.[field];
  if (!value && active === DASHBOARD_DEFAULT_YEAR) return true;
  return String(value || "") === active;
}

function matchesDashboardUnit(item, field = "unit") {
  const active = getDashboardUnit();
  const value = item?.[field];

  // Semua data lama sebelum Batch 3 dianggap milik RA.
  if (!value && active === DASHBOARD_DEFAULT_UNIT) return true;
  return String(value || "").trim() === active;
}

function matchesDashboardContext(item, yearField = "tahun_ajaran", unitField = "unit") {
  return matchesDashboardYear(item, yearField) && matchesDashboardUnit(item, unitField);
}

function updateDashboardLinks() {
  const year = getDashboardYear();
  const unit = getDashboardUnit();
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    const href = link.getAttribute("href");
    if (!href || href === "login.html" || href === "index.html") return;
    if (!/^(mingguan|semesteran|tahunan|kondisional|pengadaan)\.html$/.test(href)) return;
    const url = new URL(href, window.location.href);
    url.searchParams.set("tahun_ajaran", year);
    url.searchParams.set("unit", unit);
    link.setAttribute("href", url.pathname.split("/").pop() + url.search);
  });
}

function formatDashboardYear(value) {
  return value || "-";
}

function formatDashboardUnit(value) {
  return value || "-";
}

let DASHBOARD_RELATED_PROCUREMENT_CACHE = null;

async function loadRelatedProcurement() {
  if (Array.isArray(DASHBOARD_RELATED_PROCUREMENT_CACHE)) {
    return DASHBOARD_RELATED_PROCUREMENT_CACHE;
  }

  try {
    const session = JSON.parse(localStorage.getItem("supabase_session") || "null");
    if (!session?.access_token || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_KEY === "undefined") {
      return [];
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/pengadaan?select=id,nama,kategori,status,prioritas,target,kegiatan_id,unit&order=created_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    DASHBOARD_RELATED_PROCUREMENT_CACHE = Array.isArray(data) ? data : [];
    return DASHBOARD_RELATED_PROCUREMENT_CACHE;
  } catch (error) {
    console.error("Gagal memuat pengadaan terkait:", error);
    return [];
  }
}

function renderRelatedProcurement(activityId) {
  const rows = (DASHBOARD_RELATED_PROCUREMENT_CACHE || []).filter(
    item => String(item.kegiatan_id || "") === String(activityId || "") && matchesDashboardUnit(item)
  );

  if (!rows.length) return "";

  const statusLabel = {
    belum: "Belum",
    proses: "Proses",
    selesai: "Selesai"
  };

  return `
    <div class="related-procurement" style="margin-top:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px;">
      <strong>🛒 Pengadaan Terkait</strong>
      ${rows.map(item => `
        <div style="margin-top:8px;line-height:1.5;">
          <strong>${escapeHTML(String(item.nama || "Tanpa nama"))}</strong>
          <span> — ${escapeHTML(statusLabel[item.status] || item.status || "-")}</span>
          ${item.target ? `<div style="font-size:13px;color:#6b7280;">Target: ${escapeHTML(item.target)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
