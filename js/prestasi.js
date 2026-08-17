let prestasiResources = [];
let visiblePrestasiItems = 0;

function getPrestasiListUrl() {
  const { cloudName, achievementTag } = CONFIG.cloudinary;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/list/${encodeURIComponent(achievementTag)}.json`;
}

function getPrestasiImageUrl(resource, width = 900) {
  const version = resource.version ? `v${resource.version}/` : "";
  const format = resource.format ? `.${resource.format}` : "";
  const publicId = String(resource.public_id || "")
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  return `https://res.cloudinary.com/${encodeURIComponent(CONFIG.cloudinary.cloudName)}/image/upload/f_auto,q_auto,c_fill,g_auto,w_${width},h_${Math.round(width * 0.75)}/${version}${publicId}${format}`;
}

function getPrestasiContext(resource) {
  return (resource && resource.context && resource.context.custom) || {};
}

function getPrestasiData(resource) {
  const context = getPrestasiContext(resource);
  return {
    juara: String(context.juara || "").trim(),
    namaKegiatan: String(context.nama_kegiatan || context.namaKegiatan || "").trim(),
    unit: String(context.unit || "").trim(),
    tingkat: String(context.tingkat || "").trim(),
    tanggal: String(context.tanggal || "").trim()
  };
}

function formatPrestasiDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function getPrestasiTitle(data, resource) {
  return data.namaKegiatan || (resource.display_name || resource.public_id || "Prestasi yayasan")
    .split("/").pop()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function setPrestasiMessage(message, isError = false) {
  const container = document.getElementById("prestasiContainer");
  if (!container) return;
  container.replaceChildren();
  const status = document.createElement("p");
  status.className = isError ? "section-status is-error" : "section-status";
  status.textContent = message;
  container.append(status);
}

function createPrestasiInfo(data, resource) {
  const content = document.createElement("div");
  content.className = "prestasi-content";

  if (data.juara) {
    const award = document.createElement("div");
    award.className = "prestasi-juara";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-trophy";
    icon.setAttribute("aria-hidden", "true");
    award.append(icon, document.createTextNode(data.juara));
    content.append(award);
  }

  const title = document.createElement("h3");
  title.className = "prestasi-title";
  title.textContent = getPrestasiTitle(data, resource);
  content.append(title);

  const meta = document.createElement("div");
  meta.className = "prestasi-meta";

  if (data.unit || data.tingkat) {
    const level = document.createElement("p");
    level.className = "prestasi-meta-line";
    const parts = [data.unit, data.tingkat].filter(Boolean);
    level.textContent = parts.join(" · ");
    meta.append(level);
  }

  if (data.tanggal) {
    const date = document.createElement("p");
    date.className = "prestasi-meta-line prestasi-date";
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-calendar";
    icon.setAttribute("aria-hidden", "true");
    date.append(icon, document.createTextNode(formatPrestasiDate(data.tanggal)));
    meta.append(date);
  }

  if (meta.childElementCount) content.append(meta);
  return content;
}

function openPrestasiLightbox(resource) {
  const dialog = document.getElementById("prestasiLightbox");
  const image = document.getElementById("prestasiLightboxImage");
  const caption = document.getElementById("prestasiLightboxCaption");
  if (!dialog || !image || !caption) return;

  const data = getPrestasiData(resource);
  const title = getPrestasiTitle(data, resource);

  image.src = getPrestasiImageUrl(resource, 1600);
  image.alt = title;
  caption.replaceChildren();
  caption.append(createPrestasiInfo(data, resource));

  if (!dialog.open) dialog.showModal();
}

function createPrestasiItem(resource) {
  const data = getPrestasiData(resource);
  const title = getPrestasiTitle(data, resource);

  const article = document.createElement("article");
  article.className = "prestasi-card";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "prestasi-image-button";
  button.setAttribute("aria-label", `Perbesar foto prestasi: ${title}`);

  const image = document.createElement("img");
  image.src = getPrestasiImageUrl(resource, 900);
  image.alt = title;
  image.loading = CONFIG.features.lazyLoading ? "lazy" : "eager";
  image.decoding = "async";
  image.width = 900;
  image.height = 675;

  button.append(image);
  button.addEventListener("click", () => openPrestasiLightbox(resource));

  article.append(button, createPrestasiInfo(data, resource));
  return article;
}

function renderNextPrestasiPage() {
  const container = document.getElementById("prestasiContainer");
  const loadMoreButton = document.getElementById("loadMorePrestasi");
  if (!container || !loadMoreButton) return;

  const nextResources = prestasiResources.slice(
    visiblePrestasiItems,
    visiblePrestasiItems + CONFIG.cloudinary.pageSize
  );

  nextResources.forEach(resource => container.append(createPrestasiItem(resource)));
  visiblePrestasiItems += nextResources.length;
  loadMoreButton.hidden = visiblePrestasiItems >= prestasiResources.length;
}

function initPrestasiLightbox() {
  const dialog = document.getElementById("prestasiLightbox");
  const closeButton = document.getElementById("closePrestasiLightbox");
  if (!dialog || !closeButton) return;

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
}

async function loadPrestasi() {
  const container = document.getElementById("prestasiContainer");
  const loadMoreButton = document.getElementById("loadMorePrestasi");
  if (!container || !loadMoreButton) return;

  setPrestasiMessage("Memuat prestasi...");
  initPrestasiLightbox();

  try {
    const response = await fetch(getPrestasiListUrl(), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Cloudinary mengembalikan status ${response.status}.`);
    }

    const payload = await response.json();
    prestasiResources = Array.isArray(payload.resources)
      ? payload.resources.filter(resource => resource.public_id && resource.format)
      : [];

    prestasiResources.sort((first, second) => {
      const firstData = getPrestasiData(first);
      const secondData = getPrestasiData(second);
      const firstDate = firstData.tanggal || first.created_at || 0;
      const secondDate = secondData.tanggal || second.created_at || 0;
      return new Date(secondDate) - new Date(firstDate);
    });

    if (prestasiResources.length === 0) {
      setPrestasiMessage("Belum ada prestasi yang ditampilkan.");
      loadMoreButton.hidden = true;
      return;
    }

    visiblePrestasiItems = 0;
    container.replaceChildren();
    loadMoreButton.hidden = true;
    renderNextPrestasiPage();

    if (!loadMoreButton.dataset.bound) {
      loadMoreButton.addEventListener("click", renderNextPrestasiPage);
      loadMoreButton.dataset.bound = "true";
    }
  } catch (error) {
    console.error("Prestasi Error:", error);
    setPrestasiMessage(
      "Prestasi belum dapat dimuat. Silakan coba lagi beberapa saat lagi.",
      true
    );
  }
}
