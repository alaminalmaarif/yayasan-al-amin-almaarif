function initLoader() {
  const loader = document.getElementById("loader");
  if (!loader) return;

  const hideLoader = () => {
    loader.classList.add("hide");
    window.setTimeout(() => loader.remove(), 350);
  };

  if (document.readyState === "complete") {
    hideLoader();
  } else {
    window.addEventListener("load", hideLoader, { once: true });
  }
}

function initNavbar() {
  const header = document.getElementById("header");
  if (!header) return;

  const updateNavbar = () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
  };

  updateNavbar();
  window.addEventListener("scroll", updateNavbar, { passive: true });
}

function initMobileMenu() {
  const button = document.getElementById("menuButton");
  const menu = document.querySelector(".nav-menu");
  if (!button || !menu) return;

  const closeMenu = () => {
    menu.classList.remove("active");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Buka menu navigasi");
  };

  button.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("active");
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute(
      "aria-label",
      isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"
    );
  });

  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
}

function initBackToTop() {
  const button = document.getElementById("backToTop");
  if (!button) return;

  if (!CONFIG.features.backToTop) {
    button.remove();
    return;
  }

  const updateButton = () => {
    button.classList.toggle("show", window.scrollY > 300);
  };

  updateButton();
  window.addEventListener("scroll", updateButton, { passive: true });
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function initSmoothScroll() {
  document.addEventListener("click", event => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;

    const fragment = anchor.getAttribute("href");
    if (!fragment || fragment === "#") return;

    const target = document.getElementById(fragment.slice(1));
    if (!target) return;

    event.preventDefault();
    const header = document.getElementById("header");
    const headerOffset = header ? header.offsetHeight + 12 : 0;
    const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top: targetPosition, behavior: "smooth" });
  });
}

function initAnimations() {
  if (!CONFIG.features.animation || !window.AOS) return;

  window.AOS.init({
    duration: CONFIG.animationDuration,
    once: true
  });
}

function initUi() {
  initLoader();
  initNavbar();
  initMobileMenu();
  initBackToTop();
  initSmoothScroll();
  initAnimations();
}
