let galleryResources = [];
let visibleGalleryItems = 0;

function getGalleryListUrl() {
  const { cloudName, galleryTag } = CONFIG.cloudinary;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/list/${encodeURIComponent(galleryTag)}.json`;
}

function encodePublicId(publicId) {
  return publicId
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

function getCloudinaryImageUrl(resource, width) {
  const version = resource.version ? `v${resource.version}/` : "";
  const format = resource.format ? `.${resource.format}` : "";
  const publicId = encodePublicId(resource.public_id);

  return `https://res.cloudinary.com/${encodeURIComponent(CONFIG.cloudinary.cloudName)}/image/upload/f_auto,q_auto,c_fill,g_auto,w_${width},h_${Math.round(width * 0.75)}/${version}${publicId}${format}`;
}

function getGalleryCaption(resource) {
  const customContext = resource.context && resource.context.custom;
  const configuredCaption = customContext && (customContext.caption || customContext.alt);

  if (configuredCaption) return configuredCaption;

  return (resource.display_name || resource.public_id.split("/").pop())
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function setGalleryMessage(message, isError = false) {
  const container = document.getElementById("galleryContainer");
  if (!container) return;

  container.replaceChildren();
  const status = document.createElement("p");
  status.className = isError ? "section-status is-error" : "section-status";
  status.textContent = message;
  container.append(status);
}

function openGalleryLightbox(resource) {
  const dialog = document.getElementById("galleryLightbox");
  const image = document.getElementById("galleryLightboxImage");
  const caption = document.getElementById("galleryLightboxCaption");
  if (!dialog || !image || !caption) return;

  const text = getGalleryCaption(resource);
  image.src = getCloudinaryImageUrl(resource, 1600);
  image.alt = text;
  caption.textContent = text;

  if (!dialog.open) dialog.showModal();
}

function createGalleryItem(resource) {
  const caption = getGalleryCaption(resource);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gallery-item";
  button.setAttribute("aria-label", `Perbesar foto: ${caption}`);

  const image = document.createElement("img");
  image.src = getCloudinaryImageUrl(resource, 900);
  image.alt = caption;
  image.loading = CONFIG.features.lazyLoading ? "lazy" : "eager";
  image.decoding = "async";
  image.width = 900;
  image.height = 675;

  const label = document.createElement("span");
  label.className = "gallery-caption";
  label.textContent = caption;

  button.append(image, label);
  button.addEventListener("click", () => openGalleryLightbox(resource));
  return button;
}

function renderNextGalleryPage() {
  const container = document.getElementById("galleryContainer");
  const loadMoreButton = document.getElementById("loadMoreGallery");
  if (!container || !loadMoreButton) return;

  const nextResources = galleryResources.slice(
    visibleGalleryItems,
    visibleGalleryItems + CONFIG.cloudinary.pageSize
  );

  nextResources.forEach(resource => container.append(createGalleryItem(resource)));
  visibleGalleryItems += nextResources.length;
  loadMoreButton.hidden = visibleGalleryItems >= galleryResources.length;
}

function initGalleryLightbox() {
  const dialog = document.getElementById("galleryLightbox");
  const closeButton = document.getElementById("closeGalleryLightbox");
  if (!dialog || !closeButton) return;

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
}

async function loadGallery() {
  const container = document.getElementById("galleryContainer");
  const loadMoreButton = document.getElementById("loadMoreGallery");
  if (!container || !loadMoreButton) return;

  setGalleryMessage("Memuat galeri kegiatan...");
  initGalleryLightbox();

  try {
    const response = await fetch(getGalleryListUrl(), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Cloudinary mengembalikan status ${response.status}.`);
    }

    const payload = await response.json();
    galleryResources = Array.isArray(payload.resources)
      ? payload.resources.filter(resource => resource.public_id && resource.format)
      : [];

    galleryResources.sort((first, second) => {
      return new Date(second.created_at || 0) - new Date(first.created_at || 0);
    });

    if (galleryResources.length === 0) {
      setGalleryMessage("Belum ada dokumentasi kegiatan yang tersedia.");
      return;
    }

    visibleGalleryItems = 0;
    container.replaceChildren();
    renderNextGalleryPage();
    loadMoreButton.addEventListener("click", renderNextGalleryPage, { once: false });
  } catch (error) {
    console.error("Gallery Error:", error);
    setGalleryMessage(
      "Galeri belum dapat dimuat. Silakan coba lagi beberapa saat lagi.",
      true
    );
  }
}
