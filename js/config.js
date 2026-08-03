/* Global configuration that is safe to expose in the browser. */
const CONFIG = Object.freeze({
  foundation: Object.freeze({
    name: "Yayasan Pendidikan Islam Al-Amin Al-Ma'arif",
    shortName: "YPI Al-Amin Al-Ma'arif"
  }),

  theme: Object.freeze({
    primary: "#0B5D3B",
    primaryDark: "#08452B",
    accent: "#D4AF37"
  }),

  images: Object.freeze({
    logo: "assets/logo.png",
    banner: "assets/banner.jpg",
    chairman: "assets/ketua.jpg",
    favicon: "assets/favicon.png"
  }),

  data: Object.freeze({
    units: "data/unit.json",
    ppdb: "data/ppdb.json",
    donation: "data/donation.json",
    social: "data/social.json"
  }),

  cloudinary: Object.freeze({
    cloudName: "k8jsv9np",
    galleryTag: "yayasan-gallery",
    pageSize: 12
  }),

  youtube: Object.freeze({
    channelUrl: "https://www.youtube.com/@ypialaminalmaarif",
    channelId: "UC5ailsw8uuQsQhJ7zvy68oQ",
    apiKey: "AIzaSyDeWLR64BnvmycnvkQPDaTVoJTDklNTq4A"
  }),

  features: Object.freeze({
    animation: true,
    lazyLoading: true,
    backToTop: true,
    floatingWhatsApp: true
  }),

  animationDuration: 800
});
