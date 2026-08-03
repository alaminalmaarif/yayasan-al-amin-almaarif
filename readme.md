# 🏫 Website Resmi Yayasan Pendidikan Islam Al-Amin Al-Ma'arif

Website profil dan informasi terpadu Yayasan Pendidikan Islam Al-Amin Al-Ma'arif Parung, Bogor. Ditulis dengan arsitektur **HTML5, CSS3, dan Vanilla JavaScript (ES6+)** dengan pendekatan *Data-Driven Architecture*.

---

## 📁 Struktur Direktori

```text
WEBSITE-YAYASAN/
├── assets/
│   ├── brosur/
│   │   ├── brosur-ppdb.pdf
│   │   └── brosur.jpg
│   ├── banner.jpg
│   ├── favicon.png
│   ├── ketua.jpg
│   └── logo.png
├── css/
│   └── style.css
├── data/
│   ├── donation.json
│   ├── ppdb.json
│   ├── social.json
│   └── unit.json
├── js/
│   ├── config.js
│   ├── gallery.js
│   ├── script.js
│   ├── ui.js
│   └── youtube.js
├── .gitignore
├── index.html
├── LICENSE
└── README.md

## Menjalankan secara lokal

Jalankan perintah berikut dari folder utama project:

```powershell
python -m http.server 8000

```gitignore
.env
.env.*
!.env.example