const jsonCache = new Map();

const UNIT_ICON_CLASSES = Object.freeze({
  school: "fa-school",
  menu_book: "fa-book-quran",
  mosque: "fa-mosque",
  auto_stories: "fa-book-open",
  groups: "fa-people-group"
});

function getJSON(path) {
  if (!jsonCache.has(path)) {
    jsonCache.set(path, fetch(path).then(response => {
      if (!response.ok) {
        throw new Error(`Gagal membaca ${path} (${response.status}).`);
      }

      return response.json();
    }));
  }

  return jsonCache.get(path);
}

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.id) element.id = options.id;

  return element;
}

function createExternalLink(url, text, className, ariaLabel) {
  const link = createElement("a", { className, text });
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (ariaLabel) link.setAttribute("aria-label", ariaLabel);
  return link;
}

function setSectionMessage(container, message, isError = false) {
  if (!container) return;
  const status = createElement("p", {
    className: isError ? "section-status is-error" : "section-status",
    text: message
  });
  container.replaceChildren(status);
}

function setImageSource(id, source, alt) {
  const image = document.getElementById(id);
  if (!image) return;
  image.src = source;
  image.alt = alt;
}

function loadWebsiteConfig() {
  document.title = CONFIG.foundation.name;
  document.documentElement.style.setProperty("--primary", CONFIG.theme.primary);
  document.documentElement.style.setProperty("--primary-dark", CONFIG.theme.primaryDark);
  document.documentElement.style.setProperty("--gold", CONFIG.theme.accent);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = CONFIG.theme.primary;

  const favicon = document.getElementById("siteFavicon");
  if (favicon) favicon.href = CONFIG.images.favicon;

  setImageSource("loaderLogo", CONFIG.images.logo, `Logo ${CONFIG.foundation.shortName}`);
  setImageSource("navbarLogo", CONFIG.images.logo, `Logo ${CONFIG.foundation.shortName}`);
  setImageSource("footerLogo", CONFIG.images.logo, `Logo ${CONFIG.foundation.shortName}`);
  setImageSource("heroBanner", CONFIG.images.banner, `Kegiatan ${CONFIG.foundation.name}`);
  setImageSource("chairmanPhoto", CONFIG.images.chairman, "Ust. Drs. Ahmad Nasyruddin, Ketua Yayasan");
}

function createUnitCard(unit) {
  const article = createElement("article", { className: "unit-card" });
  if (unit.warna) article.style.setProperty("--unit-color", unit.warna);

  const heading = createElement("h3");
  const icon = createElement("i", {
    className: `fa-solid ${UNIT_ICON_CLASSES[unit.icon] || "fa-school"} unit-icon`
  });
  icon.setAttribute("aria-hidden", "true");
  heading.append(icon, document.createTextNode(unit.nama || "Unit Pendidikan"));

  const type = createElement("p", { className: "unit-type", text: unit.jenis || "" });
  const profile = createElement("p", { className: "unit-profile", text: unit.profil || "" });
  article.append(heading, type, profile);

  if (unit.jadwal) {
    const schedule = createElement("div", { className: "unit-schedule" });
    schedule.append(
      createElement("strong", { text: unit.jadwal.label || "Jadwal" }),
      createElement("p", { text: unit.jadwal.hari || "" }),
      createElement("p", { text: unit.jadwal.waktu || "" })
    );
    article.append(schedule);
  }

  if (Array.isArray(unit.program) && unit.program.length) {
    const programs = createElement("ul", { className: "unit-program" });
    unit.program.forEach(program => programs.append(createElement("li", { text: program })));
    article.append(programs);
  }

  if (unit.ppdb) {
    const registration = createElement("a", {
      className: "btn-primary",
      text: "Daftar Sekarang"
    });
    registration.href = "#ppdb";
    article.append(registration);
  }

  return article;
}

async function loadUnits() {
  const container = document.getElementById("unitContainer");
  if (!container) return;

  setSectionMessage(container, "Memuat unit pendidikan...");

  try {
    const units = await getJSON(CONFIG.data.units);
    if (!Array.isArray(units) || units.length === 0) {
      setSectionMessage(container, "Informasi unit pendidikan belum tersedia.");
      return;
    }

    container.replaceChildren(...units.map(createUnitCard));
  } catch (error) {
    console.error("Load Unit Error:", error);
    setSectionMessage(container, "Informasi unit pendidikan belum dapat dimuat.", true);
  }
}

function createPpdbStatus(status, schoolYear) {
  const isOpen = Boolean(status && status.buka);
  const element = createElement("section", {
    className: `ppdb-status ${isOpen ? "ppdb-open" : "ppdb-closed"}`
  });

  const title = createElement("h3", { text: isOpen ? "PPDB DIBUKA" : "PPDB DITUTUP" });
  const description = createElement("p", {
    text: status && status.keterangan ? status.keterangan : "Informasi status PPDB belum tersedia."
  });
  const year = createElement("p", { className: "ppdb-year", text: `Tahun Ajaran ${schoolYear || "-"}` });
  element.append(title, description, year);
  return element;
}

function createBrochureCard(brochure) {
  const article = createElement("article", { className: "ppdb-brosur" });

  if (brochure.thumbnail) {
    const image = document.createElement("img");
    image.src = brochure.thumbnail;
    image.alt = brochure.judul || "Brosur PPDB";
    image.loading = CONFIG.features.lazyLoading ? "lazy" : "eager";
    image.decoding = "async";
    article.append(image);
  }

  const content = createElement("div", { className: "ppdb-brosur-content" });
  content.append(createElement("h3", { text: brochure.judul || "Brosur PPDB" }));

  if (brochure.file) {
    content.append(createExternalLink(
      brochure.file,
      "Lihat Brosur PPDB",
      "btn-secondary",
      "Buka brosur PPDB di tab baru"
    ));
  }

  article.append(content);
  return article;
}

function createPpdbUnitCard(unit) {
  const article = createElement("article", { className: "ppdb-card" });
  article.dataset.unit = unit.id || "";
  article.append(createElement("h3", { text: unit.nama || "Unit Pendidikan" }));

  if (unit.formulir) {
    article.append(createExternalLink(
      unit.formulir,
      "Daftar Sekarang",
      "btn-primary",
      `Buka formulir pendaftaran ${unit.nama || "unit pendidikan"} di tab baru`
    ));
  }

  return article;
}

function createPpdbContact(contact, isOpen) {
  const section = createElement("section", { className: "ppdb-contact" });
  section.append(createElement("h3", { text: isOpen ? "Butuh informasi PPDB?" : "Informasi PPDB" }));

  const description = [contact.nama, contact.jabatan].filter(Boolean).join(" — ");
  if (description) section.append(createElement("p", { text: description }));

  if (contact.whatsapp) {
    const message = isOpen
      ? "Assalamu'alaikum, saya ingin mendapatkan informasi PPDB."
      : "Assalamu'alaikum, saya ingin mendapatkan informasi PPDB berikutnya.";
    section.append(createExternalLink(
      `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`,
      "Hubungi via WhatsApp",
      "btn-secondary",
      "Hubungi panitia PPDB melalui WhatsApp"
    ));
  }

  return section;
}

async function loadPPDB() {
  const container = document.getElementById("ppdbContainer");
  if (!container) return;

  setSectionMessage(container, "Memuat informasi PPDB...");

  try {
    const data = await getJSON(CONFIG.data.ppdb);
    const isOpen = Boolean(data.status && data.status.buka);
    const fragment = document.createDocumentFragment();

    fragment.append(createPpdbStatus(data.status, data.tahun_ajaran));

    if (data.brosur) fragment.append(createBrochureCard(data.brosur));

    if (isOpen) {
      const activeUnits = Array.isArray(data.unit)
        ? data.unit.filter(unit => unit.aktif && unit.formulir)
        : [];

      if (activeUnits.length) {
        const grid = createElement("div", { className: "ppdb-grid" });
        grid.append(...activeUnits.map(createPpdbUnitCard));
        fragment.append(grid);
      } else {
        fragment.append(createElement("p", {
          className: "section-status",
          text: "Formulir pendaftaran belum tersedia."
        }));
      }
    }

    if (data.kontak) fragment.append(createPpdbContact(data.kontak, isOpen));
    container.replaceChildren(fragment);
  } catch (error) {
    console.error("Load PPDB Error:", error);
    setSectionMessage(container, "Informasi PPDB belum dapat dimuat.", true);
  }
}

async function loadDonation() {
  const container = document.getElementById("donationContainer");
  if (!container) return;

  setSectionMessage(container, "Memuat informasi donasi...");

  try {
    const data = await getJSON(CONFIG.data.donation);
    const card = createElement("article", { className: "donation-card" });
    const bank = data.bank || {};
    const confirmation = data.konfirmasi || {};

    card.append(
      createElement("h3", { text: "Rekening Donasi" }),
      createElement("p", { text: `Bank: ${bank.nama || "-"}` }),
      createElement("p", { text: `No. Rekening: ${bank.nomor || "-"}` }),
      createElement("p", { text: `Atas Nama: ${bank.atas_nama || "-"}` })
    );

    const contact = createElement("div", { className: "donation-contact" });
    contact.append(
      createElement("h3", { text: "Konfirmasi Donasi" }),
      createElement("p", { text: confirmation.nama || "" }),
      createElement("p", { text: confirmation.jabatan || "" })
    );

    if (confirmation.whatsapp) {
      contact.append(createExternalLink(
        `https://wa.me/${confirmation.whatsapp}?text=${encodeURIComponent(confirmation.pesan || "")}`,
        "Konfirmasi Donasi",
        "btn-primary",
        "Konfirmasi donasi melalui WhatsApp"
      ));
    }

    card.append(contact);
    container.replaceChildren(card);
  } catch (error) {
    console.error("Load Donation Error:", error);
    setSectionMessage(container, "Informasi donasi belum dapat dimuat.", true);
  }
}

function getSocialIcon(name) {
  const normalizedName = String(name || "").toLowerCase();
  if (normalizedName.includes("youtube")) return "fa-youtube";
  if (normalizedName.includes("facebook")) return "fa-facebook";
  if (normalizedName.includes("instagram")) return "fa-instagram";
  if (normalizedName.includes("tiktok")) return "fa-tiktok";
  return "fa-link";
}

function renderSocial(data) {
  const container = document.getElementById("socialContainer");
  if (!container) return;

  const socialEntries = Object.values(data.mediaSosial || {})
    .filter(item => item && item.aktif && item.url);

  if (!socialEntries.length) {
    setSectionMessage(container, "Media sosial belum tersedia.");
    return;
  }

  const links = socialEntries.map(item => {
    const link = createExternalLink(item.url, item.nama, "social-link", `Buka ${item.nama}`);
    const icon = createElement("i", { className: `fa-brands ${getSocialIcon(item.nama)}` });
    icon.setAttribute("aria-hidden", "true");
    link.prepend(icon);
    return link;
  });

  container.replaceChildren(...links);
}

function renderContact(data) {
  const contact = data.kontak || {};
  const whatsapp = contact.whatsapp || {};

  const address = document.getElementById("contactAddress");
  if (address) {
    address.replaceChildren();
    String(contact.alamat || "-").split(",").forEach((part, index) => {
      if (index) address.append(document.createElement("br"));
      address.append(document.createTextNode(part.trim()));
    });
  }

  const whatsappContainer = document.getElementById("contactWhatsapp");
  if (whatsappContainer) {
    whatsappContainer.replaceChildren();
    if (whatsapp.nomor) {
      whatsappContainer.append(createExternalLink(
        `https://wa.me/${whatsapp.nomor}?text=${encodeURIComponent(whatsapp.pesan || "")}`,
        whatsapp.nomor,
        "contact-link",
        "Hubungi melalui WhatsApp"
      ));
    } else {
      whatsappContainer.textContent = "-";
    }
  }

  const email = document.getElementById("contactEmail");
  if (email) {
    email.replaceChildren();
    if (contact.email) {
      const emailLink = createElement("a", { className: "contact-link", text: contact.email });
      emailLink.href = `mailto:${contact.email}`;
      email.append(emailLink);
    } else {
      email.textContent = "-";
    }
  }

  const mapContainer = document.getElementById("mapContainer");
  const mapUrl = data.googleMaps && data.googleMaps.embed;
  if (mapContainer && mapUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = mapUrl;
    iframe.title = "Lokasi Yayasan Pendidikan Islam Al-Amin Al-Ma'arif";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    mapContainer.replaceChildren(iframe);
  }
}

function renderFooter(data) {
  const website = data.website || {};
  const copyright = data.copyright || {};
  const footerTitle = document.getElementById("footerTitle");
  const footerDescription = document.getElementById("footerDescription");
  const footerCopyright = document.getElementById("footerCopyright");

  if (footerTitle) footerTitle.textContent = website.title || CONFIG.foundation.name;
  if (footerDescription) footerDescription.textContent = website.description || "";
  if (footerCopyright) footerCopyright.textContent = copyright.text || "";
}

function initFloatingWhatsApp(data) {
  const button = document.getElementById("floatingWhatsapp");
  if (!button) return;

  if (!CONFIG.features.floatingWhatsApp) {
    button.remove();
    return;
  }

  const whatsapp = data.kontak && data.kontak.whatsapp;
  if (!whatsapp || !whatsapp.nomor) return;

  button.href = `https://wa.me/${whatsapp.nomor}?text=${encodeURIComponent(whatsapp.pesan || "")}`;
  button.hidden = false;
}

function initYouTubeButton(data) {
  const button = document.getElementById("youtubeButton");
  if (!button) return;

  const youtube = data.mediaSosial && data.mediaSosial.youtube;
  const url = youtube && youtube.aktif && youtube.url
    ? youtube.url
    : CONFIG.youtube.channelUrl;

  if (!url) return;
  button.href = url;
  button.hidden = false;
}

async function loadSocialAndContact() {
  try {
    const data = await getJSON(CONFIG.data.social);
    renderSocial(data);
    renderContact(data);
    renderFooter(data);
    initFloatingWhatsApp(data);
    initYouTubeButton(data);
  } catch (error) {
    console.error("Load Social Error:", error);
    setSectionMessage(document.getElementById("socialContainer"), "Media sosial belum dapat dimuat.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadWebsiteConfig();
  initUi();
  loadYoutubeVideos();

  void Promise.all([
    loadUnits(),
    loadPPDB(),
    loadDonation(),
    loadSocialAndContact(),
    loadGallery(),
    loadPrestasi()
  ]);
});
