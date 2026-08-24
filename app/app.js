(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = n => new Intl.NumberFormat('id-ID').format(Number(n||0));
  const fn = name => `${APP_CONFIG.supabaseUrl}/functions/v1/${name}`;

  // Simpan setiap menu pada browser history agar tombol Back Android kembali
  // ke Beranda, bukan langsung keluar dari aplikasi.
  const viewIds = new Set(['home', 'upload', 'payment', 'register', 'feedback', 'notifications']);

  function viewFromUrl() {
    const id = window.location.hash.replace('#', '');
    return viewIds.has(id) ? id : 'home';
  }

  function setView(id, saveHistory = true) {
    if (!viewIds.has(id)) id = 'home';
    document.querySelectorAll('.app-view').forEach(v => v.hidden = v.id !== id);
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === id));

    if (saveHistory && viewFromUrl() !== id) {
      const url = id === 'home'
        ? `${window.location.pathname}${window.location.search}`
        : `${window.location.pathname}${window.location.search}#${id}`;
      window.history.pushState({ view: id }, '', url);
    }

    window.scrollTo({top:0,behavior:'smooth'});
    if (id === 'notifications') markNotificationsRead();
  }

  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  window.addEventListener('popstate', () => setView(viewFromUrl(), false));
  setView(viewFromUrl(), false);

  // Public website
  $('openWebsite')?.addEventListener('click', () => location.href = APP_CONFIG.siteUrl);
  $('openDashboard')?.addEventListener('click', () => location.href = APP_CONFIG.dashboardUrl);
  $('openArchive')?.addEventListener('click', () => location.href = APP_CONFIG.archiveUrl);

  // Notifikasi: unit dipilih sekali per perangkat. Aplikasi Android meneruskan
  // pilihan ini ke Firebase agar perangkat hanya menerima topik unit tersebut.
  const notificationTopics = Object.freeze({
    KB: 'kb', RA: 'ra', TPQ: 'tpq', MDT: 'mdt', Pesantren: 'pesantren', MTs: 'mts', MA: 'ma'
  });
  const notificationUnit = $('notificationUnit');
  const notificationHistory = $('notificationHistory');
  let notifications = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  }

  function selectedNotificationTopic() {
    return notificationTopics[notificationUnit?.value] || '';
  }

  function readNotificationIds() {
    try { return new Set(JSON.parse(localStorage.getItem('read_notification_ids') || '[]')); }
    catch { return new Set(); }
  }

  function updateNotificationBadge() {
    const read = readNotificationIds();
    const count = notifications.filter(item => !read.has(item.id)).length;
    ['notificationUnreadCount', 'notificationTileUnread'].forEach(id => {
      const badge = $(id);
      if (!badge) return;
      badge.hidden = count === 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    });
  }

  function renderNotifications() {
    if (!notificationHistory) return;
    if (!notifications.length) {
      notificationHistory.innerHTML = '<p class="small">Belum ada notifikasi untuk Anda.</p>';
      return;
    }
    notificationHistory.innerHTML = notifications.map(item => {
      const date = new Date(item.sent_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      return `<article class="notification-item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><time>${date}</time></article>`;
    }).join('');
  }

  function markNotificationsRead() {
    if (!notifications.length) return;
    localStorage.setItem('read_notification_ids', JSON.stringify(notifications.map(item => item.id)));
    updateNotificationBadge();
  }

  async function loadNotifications() {
    if (!notificationHistory) return;
    notificationHistory.textContent = 'Memuat riwayat notifikasi...';
    try {
      const unit = selectedNotificationTopic();
      const response = await fetch(`${fn(APP_CONFIG.notificationFeedFunction)}?unit=${encodeURIComponent(unit)}`, {
        headers: { apikey: APP_CONFIG.supabasePublishableKey }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Riwayat notifikasi tidak dapat dimuat.');
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      renderNotifications();
      updateNotificationBadge();
      if (viewFromUrl() === 'notifications') markNotificationsRead();
    } catch (error) {
      notificationHistory.textContent = error.message || 'Riwayat notifikasi tidak dapat dimuat.';
    }
  }

  if (notificationUnit) {
    Object.keys(notificationTopics).forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      notificationUnit.appendChild(option);
    });
    notificationUnit.value = localStorage.getItem('notification_unit') || '';
    window.YayasanNotifications?.setUnit(selectedNotificationTopic());
    notificationUnit.addEventListener('change', () => {
      localStorage.setItem('notification_unit', notificationUnit.value);
      // Antarmuka ini hanya tersedia di APK Android; browser tetap menampilkan riwayat.
      window.YayasanNotifications?.setUnit(selectedNotificationTopic());
      loadNotifications();
    });
  }
  loadNotifications();

  // Upload PIN: the PIN itself is never stored in this public application.
  $('verifyPin')?.addEventListener('click', async () => {
    const pin = $('uploadPin').value.trim();
    const msg = $('pinMessage');
    msg.textContent = 'Memeriksa PIN...';
    try {
      const r = await fetch(fn(APP_CONFIG.uploadPinFunction), {
        method:'POST', headers:{'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey}, body:JSON.stringify({pin})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'PIN salah.');
      sessionStorage.setItem('upload_pin_verified', JSON.stringify({at:Date.now(),token:d.token}));
      $('uploadChooser').hidden = false; $('pinBox').hidden = true; msg.textContent = 'PIN benar. Pilih jenis foto.';
    } catch(e) { msg.textContent = e.message || 'Gagal memverifikasi PIN.'; }
  });
  function allowUploadPage(url) {
    const raw = sessionStorage.getItem('upload_pin_verified');
    try { const d=JSON.parse(raw||'null'); if(!d || Date.now()-d.at>8*60*60*1000) throw 0; location.href=url; } catch { alert('Masukkan PIN upload terlebih dahulu.'); }
  }
  $('activityUpload')?.addEventListener('click',()=>allowUploadPage(APP_CONFIG.uploadActivityUrl));
  $('achievementUpload')?.addEventListener('click',()=>allowUploadPage(APP_CONFIG.uploadAchievementUrl));

  // Payment
  $('paymentForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const button=$('payButton'), status=$('paymentMessage');
    const amount=Number($('amount').value);
    const payload={student_name:$('studentName').value.trim(),unit:$('paymentUnit').value,payment_status:$('paymentStatus').value,amount,description:$('description').value.trim()};
    if(!payload.student_name || !payload.unit || !payload.payment_status || !Number.isFinite(amount) || amount<1000) { status.textContent='Lengkapi data pembayaran. Minimal Rp1.000.'; return; }
    button.disabled=true; status.textContent='Menyiapkan pembayaran...';
    try {
      const r=await fetch(fn(APP_CONFIG.paymentFunction),{method:'POST',headers:{'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey},body:JSON.stringify(payload)});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Gagal membuat pembayaran.');
      const snapSrc=d.environment==='production'?'https://app.midtrans.com/snap/snap.js':'https://app.sandbox.midtrans.com/snap/snap.js';
      await new Promise((resolve,reject)=>{ 
        if(window.snap){
          resolve();
          return;
        } 
        const sc=document.createElement('script');
        sc.src=`${snapSrc}?client-key=${encodeURIComponent(d.client_key)}`;
        sc.onload=resolve;
        sc.onerror=reject;
        document.head.appendChild(sc); 
      });
      window.snap.pay(d.token,{
        onSuccess:()=>{
          status.textContent=`Pembayaran berhasil. ID: ${d.order_id}`;
          form.reset();
          button.disabled=false;
        },
        onPending:()=>{
          status.textContent='Pembayaran sedang diverifikasi...';
          button.disabled=false;
        },
        onError:()=>{
          status.textContent='Pembayaran gagal.';
          button.disabled=false;
        },
        onClose:()=>{
          status.textContent='Jendela pembayaran ditutup. Anda dapat mencoba lagi.';
          button.disabled=false;
        }
      });

    } catch(e) {
      status.textContent = e instanceof TypeError && /fetch/i.test(e.message)
        ? 'Tidak dapat menghubungi layanan pembayaran. Pastikan Edge Function create-payment sudah dideploy dan URL Supabase benar.'
        : (e.message || 'Pembayaran gagal.');
      button.disabled=false;
    }
  });

  // Registration buttons
  const reg=$('registrationUnit');
  APP_CONFIG.units.forEach(unit=>{const o=document.createElement('option');o.value=unit;o.textContent=unit;reg.appendChild(o);});
  $('registerButton')?.addEventListener('click',()=>{const unit=reg.value;const url=APP_CONFIG.ppdb[unit]; if(!url){$('registrationMessage').textContent='Formulir untuk unit ini belum tersedia.';return;} location.href=url;});

  /// Feedback -> Supabase -> WhatsApp
  $('feedbackForm')?.addEventListener('submit', async e => {
    e.preventDefault();

    const text = $('feedbackText').value.trim();
    const button = e.currentTarget.querySelector('button[type="submit"]');

    if (!text) return;

    button.disabled = true;
    button.textContent = 'Menyimpan...';

    try {
      const r = await fetch(fn(APP_CONFIG.feedbackFunction), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': APP_CONFIG.supabasePublishableKey
        },
        body: JSON.stringify({
          message: text
        })
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.error || 'Gagal menyimpan saran.');
      }

      const message =
        `Saran & Masukan Yayasan Al-Amin\n\n${text}`;

      $('feedbackText').value = '';

      location.href =
        `https://wa.me/${APP_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;

    } catch (err) {
      alert(err.message || 'Gagal menyimpan saran.');
    } finally {
      button.disabled = false;
      button.textContent = 'Kirim ke WhatsApp';
    }
  });

  // Populate payment units
  const pu=$('paymentUnit'); APP_CONFIG.units.forEach(unit=>{const o=document.createElement('option');o.value=unit;o.textContent=unit;pu.appendChild(o);});
})();
