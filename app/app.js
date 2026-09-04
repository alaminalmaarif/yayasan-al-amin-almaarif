(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = n => new Intl.NumberFormat('id-ID').format(Number(n || 0));
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

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'notifications') markNotificationsRead();
  }

  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  window.addEventListener('popstate', () => setView(viewFromUrl(), false));
  setView(viewFromUrl(), false);

  // Public website
  $('openWebsite')?.addEventListener('click', () => location.href = APP_CONFIG.siteUrl);
  $('openDashboard')?.addEventListener('click', () => location.href = APP_CONFIG.dashboardUrl);
  $('openArchive')?.addEventListener('click', () => location.href = APP_CONFIG.archiveUrl);

  // Notifikasi: unit dipilih sekali per perangkat.
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
      window.YayasanNotifications?.setUnit(selectedNotificationTopic());
      loadNotifications();
    });
  }
  loadNotifications();

  // Upload PIN: PIN tidak disimpan di aplikasi publik.
  $('verifyPin')?.addEventListener('click', async () => {
    const pin = $('uploadPin').value.trim();
    const msg = $('pinMessage');
    msg.textContent = 'Memeriksa PIN...';
    try {
      const r = await fetch(fn(APP_CONFIG.uploadPinFunction), {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey},
        body:JSON.stringify({pin})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'PIN salah.');
      sessionStorage.setItem('upload_pin_verified', JSON.stringify({at:Date.now(),token:d.token}));
      $('uploadChooser').hidden = false;
      $('pinBox').hidden = true;
      msg.textContent = 'PIN benar. Pilih jenis foto.';
    } catch(e) {
      msg.textContent = e.message || 'Gagal memverifikasi PIN.';
    }
  });

  function allowUploadPage(url) {
    const raw = sessionStorage.getItem('upload_pin_verified');
    try {
      const d=JSON.parse(raw||'null');
      if(!d || Date.now()-d.at>8*60*60*1000) throw 0;
      location.href=url;
    } catch {
      alert('Masukkan PIN upload terlebih dahulu.');
    }
  }
  $('activityUpload')?.addEventListener('click',()=>allowUploadPage(APP_CONFIG.uploadActivityUrl));
  $('achievementUpload')?.addEventListener('click',()=>allowUploadPage(APP_CONFIG.uploadAchievementUrl));

  // ============================================================
  // PEMBAYARAN
  // Alur:
  // Tahun ajaran -> Unit -> Nama siswa -> PIN (buat/verifikasi)
  // -> Jenis pembayaran -> detail sesuai jenis -> bayar -> QRIS.
  // Hanya data siswa dari finance_students yang ditampilkan.
  // ============================================================
  const FINANCE_UNITS = ['KB','RA','TPQ','MDT','Pesantren','MTs','MA'];
  const PAYMENT_TYPES = ['Tabungan Wajib','Tabungan Sukarela','SPP','Kegiatan','PPDB','Infak'];
  const PAYMENT_STATUSES = ['Lunas','Cicil','Lunasi Cicilan'];
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const ACTIVITIES = ['Maulid','Agustusan','Karyawisata','Manasik Haji','Renang','Lomba','Isi Manual'];
  const PURPOSES = ['Pembangunan','Guru','Sarana & Prasarana','Operasional','Isi Manual'];

  let paymentSessionToken = '';
  let paymentStudent = null;

  function paymentYearValue() {
    const select = $('paymentYear');
    return select?.value === 'custom'
      ? ($('paymentYearCustom')?.value || '').trim()
      : (select?.value || '').trim();
  }

  function validAcademicYear(value) {
    return /^\d{4}\/\d{4}$/.test(String(value || '').trim());
  }

  function setPaymentStatus(message, isError = false) {
    const el = $('paymentMessage');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#9b2c2c' : '';
  }

  function resetPaymentAfterContextChange() {
    paymentSessionToken = '';
    paymentStudent = null;
    const pinBox = $('studentPinBox');
    const options = $('paymentOptions');
    const report = $('studentReport');
    const qris = $('qrisBox');
    if (pinBox) pinBox.hidden = true;
    if (options) options.hidden = true;
    if (report) report.hidden = true;
    if (qris) qris.hidden = true;
    if ($('studentPinMessage')) $('studentPinMessage').textContent = '';
    setPaymentStatus('');
  }

  function resetStudentSelect(message) {
    const select = $('studentName');
    if (!select) return;
    select.innerHTML = `<option value="">${esc(message)}</option>`;
    resetPaymentAfterContextChange();
  }

  async function loadPaymentStudents() {
    const year = paymentYearValue();
    const unit = $('paymentUnit')?.value || '';
    resetStudentSelect('Memuat daftar siswa...');

    if (!validAcademicYear(year) || !FINANCE_UNITS.includes(unit)) {
      resetStudentSelect('Pilih tahun ajaran dan unit terlebih dahulu');
      return;
    }

    try {
      const r = await fetch(
        `${fn('public-students')}?year=${encodeURIComponent(year)}&unit=${encodeURIComponent(unit)}`,
        { headers: { apikey: APP_CONFIG.supabasePublishableKey } }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat daftar siswa.');

      const students = Array.isArray(d.students) ? d.students : [];
      if (!students.length) {
        resetStudentSelect('Belum ada siswa untuk tahun ajaran dan unit ini');
        setPaymentStatus('Belum ada data siswa pada konteks yang dipilih.');
        return;
      }

      const select = $('studentName');
      select.innerHTML = '<option value="">Pilih nama siswa</option>';
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = student.student_name;
        option.dataset.studentName = student.student_name;
        select.appendChild(option);
      });
      setPaymentStatus('');
    } catch (error) {
      resetStudentSelect('Gagal memuat siswa. Coba lagi.');
      setPaymentStatus(error.message || 'Gagal memuat daftar siswa.', true);
    }
  }

  async function checkStudentPin() {
    const year = paymentYearValue();
    const unit = $('paymentUnit')?.value || '';
    const select = $('studentName');
    const option = select?.selectedOptions?.[0];
    const studentId = option?.value || '';
    const studentName = option?.dataset?.studentName || option?.textContent?.trim() || '';

    resetPaymentAfterContextChange();

    if (!validAcademicYear(year) || !FINANCE_UNITS.includes(unit) || !studentId || !studentName) return;

    paymentStudent = { year, unit, studentId, studentName };
    const box = $('studentPinBox');
    const info = $('studentPinInfo');
    if (box) box.hidden = false;
    if (info) info.textContent = `Memeriksa status PIN untuk ${studentName}...`;

    try {
      const r = await fetch(fn('student-pin'), {
        method: 'POST',
        headers: {'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey},
        body: JSON.stringify({
          action: 'check',
          year,
          unit,
          student_id: studentId,
          student_name: studentName
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memeriksa PIN siswa.');

      $('pinCreateFields').hidden = !!d.has_pin;
      $('pinVerifyFields').hidden = !d.has_pin;
      $('studentPinTitle').textContent = d.has_pin ? 'Masukkan PIN Anak' : 'Buat PIN Anak';
      $('studentPinInfo').textContent = d.has_pin
        ? `PIN untuk ${studentName} sudah terdaftar. Masukkan PIN untuk melanjutkan pembayaran.`
        : `PIN untuk ${studentName} belum ada. Buat PIN 4–6 digit terlebih dahulu.`;
    } catch (error) {
      if ($('studentPinInfo')) $('studentPinInfo').textContent = error.message || 'Gagal memeriksa PIN siswa.';
    }
  }

  async function submitStudentPin(action) {
    if (!paymentStudent) return;
    const isCreate = action === 'create';
    const pin = $(isCreate ? 'studentPin' : 'studentPinVerify')?.value.trim() || '';
    const body = {
      action,
      year: paymentStudent.year,
      unit: paymentStudent.unit,
      student_id: paymentStudent.studentId,
      student_name: paymentStudent.studentName,
      pin
    };
    if (isCreate) body.pin_confirm = $('studentPinConfirm')?.value.trim() || '';

    const button = $(isCreate ? 'createStudentPin' : 'verifyStudentPin');
    const msg = $('studentPinMessage');
    if (button) button.disabled = true;
    if (msg) msg.textContent = isCreate ? 'Membuat PIN...' : 'Memverifikasi PIN...';

    try {
      const r = await fetch(fn('student-pin'), {
        method: 'POST',
        headers: {'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey},
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'PIN tidak dapat diverifikasi.');

      paymentSessionToken = d.token || '';
      if (!paymentSessionToken) throw new Error('Sesi PIN tidak diterima dari server.');

      if (msg) msg.textContent = 'PIN berhasil diverifikasi. Silakan pilih jenis pembayaran.';
      $('paymentOptions').hidden = false;
      $('qrisBox').hidden = true;
      renderPaymentDetails();
    } catch (error) {
      if (msg) msg.textContent = error.message || 'PIN tidak dapat diverifikasi.';
      paymentSessionToken = '';
      $('paymentOptions').hidden = true;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function field(label, html) {
    return `<div class="field"><label>${label}</label>${html}</div>`;
  }

  function amountField() {
    return field('Nominal (Rp)', '<input id="amount" class="input" type="number" min="1000" step="1000" placeholder="Contoh: 100000" required>');
  }

  function statusField() {
    return field('Status Pembayaran',
      `<select id="paymentStatus" class="select" required>
        <option value="">Pilih status</option>
        ${PAYMENT_STATUSES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}
      </select>`
    );
  }

  function renderPaymentDetails() {
    const type = $('paymentType')?.value || '';
    const details = $('paymentDetails');
    if (!details) return;

    details.innerHTML = '';
    $('qrisBox').hidden = true;
    setPaymentStatus('');

    if (!type) return;

    if (type === 'Tabungan Wajib' || type === 'Tabungan Sukarela') {
      details.innerHTML = [
        field('Tanggal', '<input id="paymentDate" class="input" type="date" required>'),
        amountField()
      ].join('');
    } else if (type === 'SPP') {
      details.innerHTML = [
        field('Bulan SPP',
          `<select id="paymentMonth" class="select" required>
            <option value="">Pilih bulan</option>
            ${MONTHS.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}
          </select>`
        ),
        statusField(),
        amountField()
      ].join('');
    } else if (type === 'Kegiatan') {
      details.innerHTML = [
        field('Kegiatan',
          `<select id="activity" class="select" required>
            <option value="">Pilih kegiatan</option>
            ${ACTIVITIES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}
          </select>
          <input id="activityCustom" class="input" placeholder="Tulis kegiatan" hidden>`
        ),
        statusField(),
        amountField(),
        `<div class="field"><label style="font-weight:400"><input id="deductMandatory" type="checkbox"> Potong dari saldo Tabungan Wajib</label></div>`
      ].join('');
      $('activity')?.addEventListener('change', () => {
        $('activityCustom').hidden = $('activity').value !== 'Isi Manual';
        if ($('activity').value !== 'Isi Manual') $('activityCustom').value = '';
      });
    } else if (type === 'PPDB') {
      details.innerHTML = [
        statusField(),
        amountField()
      ].join('');
    } else if (type === 'Infak') {
      details.innerHTML = [
        field('Peruntukan Infak',
          `<select id="purpose" class="select" required>
            <option value="">Pilih peruntukan</option>
            ${PURPOSES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}
          </select>
          <input id="purposeCustom" class="input" placeholder="Tulis peruntukan" hidden>`
        ),
        amountField()
      ].join('');
      $('purpose')?.addEventListener('change', () => {
        $('purposeCustom').hidden = $('purpose').value !== 'Isi Manual';
        if ($('purpose').value !== 'Isi Manual') $('purposeCustom').value = '';
      });
    }
  }

  function paymentPayload() {
    const type = $('paymentType')?.value || '';
    const activityChoice = $('activity')?.value || '';
    const purposeChoice = $('purpose')?.value || '';
    return {
      academic_year: paymentStudent.year,
      unit: paymentStudent.unit,
      student_id: paymentStudent.studentId,
      student_name: paymentStudent.studentName,
      payment_type: type,
      amount: Number($('amount')?.value),
      payment_status: $('paymentStatus')?.value || null,
      payment_date: $('paymentDate')?.value || null,
      month: $('paymentMonth')?.value || null,
      activity: activityChoice === 'Isi Manual'
        ? ($('activityCustom')?.value || '').trim()
        : activityChoice,
      purpose: purposeChoice === 'Isi Manual'
        ? ($('purposeCustom')?.value || '').trim()
        : purposeChoice,
      deduct_mandatory: $('deductMandatory')?.checked === true,
      pin_session_token: paymentSessionToken
    };
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!paymentStudent || !paymentSessionToken) {
      setPaymentStatus('Verifikasi PIN Anak terlebih dahulu.', true);
      return;
    }

    const payload = paymentPayload();
    if (!PAYMENT_TYPES.includes(payload.payment_type) || !Number.isFinite(payload.amount) || payload.amount < 1000) {
      setPaymentStatus('Lengkapi jenis pembayaran dan nominal minimal Rp1.000.', true);
      return;
    }

    if ((payload.payment_type === 'Tabungan Wajib' || payload.payment_type === 'Tabungan Sukarela') && !payload.payment_date) {
      setPaymentStatus('Tanggal wajib diisi.', true);
      return;
    }
    if (payload.payment_type === 'SPP' && (!payload.month || !payload.payment_status)) {
      setPaymentStatus('Bulan SPP dan status pembayaran wajib diisi.', true);
      return;
    }
    if (payload.payment_type === 'Kegiatan' && (!payload.activity || !payload.payment_status)) {
      setPaymentStatus('Kegiatan dan status pembayaran wajib diisi.', true);
      return;
    }
    if (payload.payment_type === 'PPDB' && !payload.payment_status) {
      setPaymentStatus('Status pembayaran wajib diisi.', true);
      return;
    }
    if (payload.payment_type === 'Infak' && !payload.purpose) {
      setPaymentStatus('Peruntukan infak wajib diisi.', true);
      return;
    }

    const button = $('payButton');
    if (button) button.disabled = true;
    setPaymentStatus('Mencatat pembayaran dan menyiapkan QRIS...');

    try {
      const r = await fetch(fn(APP_CONFIG.paymentFunction), {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':APP_CONFIG.supabasePublishableKey
        },
        body:JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal mencatat pembayaran.');

      // Pembayaran pada alur yayasan menggunakan QRIS gambar statis.
      // Transaksi dibuat sebagai "pending" dan admin memverifikasinya di dashboard.
      $('qrisBox').hidden = false;
      setPaymentStatus(`Pembayaran tercatat. ID transaksi: ${d.order_id}. Silakan scan QRIS di bawah, lalu konfirmasikan kepada admin.`);
      $('qrisBox').scrollIntoView({behavior:'smooth', block:'center'});
    } catch (error) {
      setPaymentStatus(error.message || 'Pembayaran gagal.', true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function viewPaymentReport() {
    if (!paymentStudent || !paymentSessionToken) {
      setPaymentStatus('Verifikasi PIN Anak terlebih dahulu.', true);
      return;
    }
    const body = {
      action:'report',
      year:paymentStudent.year,
      unit:paymentStudent.unit,
      student_id:paymentStudent.studentId,
      student_name:paymentStudent.studentName,
      session_token:paymentSessionToken
    };
    const section = $('studentReport');
    const reportBody = $('studentReportBody');
    if (section) section.hidden = false;
    if (reportBody) reportBody.innerHTML = '<p class="small">Memuat rekap...</p>';

    try {
      const r = await fetch(fn('student-pin'), {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':APP_CONFIG.supabasePublishableKey},
        body:JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat rekap pembayaran.');
      renderPaymentReport(d);
    } catch (error) {
      if (reportBody) reportBody.innerHTML = `<p class="status">${esc(error.message || 'Gagal memuat rekap pembayaran.')}</p>`;
    }
  }

  function renderPaymentReport(data) {
    const report = data.report || {};
    const rows = [
      ['Tabungan Wajib', `Rp ${money(report.mandatory_balance)}`],
      ['Tabungan Sukarela', `Rp ${money(report.sukarela_balance)}`],
      ['PPDB', `Rp ${money(report.ppdb_balance)}`],
      ['Infak', `Rp ${money(report.infak_balance)}`]
    ];
    const spp = Array.isArray(report.spp_paid) && report.spp_paid.length
      ? `<ul>${report.spp_paid.map(x => `<li>${esc(x.label || x.month || '-')}</li>`).join('')}</ul>`
      : '<p class="small">Belum ada pembayaran SPP diterima.</p>';
    const kegiatan = Array.isArray(report.kegiatan) && report.kegiatan.length
      ? `<ul>${report.kegiatan.map(x => `<li>${esc(x.activity || '-')}</li>`).join('')}</ul>`
      : '<p class="small">Belum ada pembayaran kegiatan diterima.</p>';

    $('studentReportBody').innerHTML =
      `<div class="grid">${rows.map(x => `<div class="summary-item"><strong>${esc(x[0])}</strong><br>${esc(x[1])}</div>`).join('')}</div>
       <div class="card" style="margin-top:12px"><strong>SPP yang sudah dibayar</strong>${spp}</div>
       <div class="card" style="margin-top:12px"><strong>Kegiatan yang sudah dibayar</strong>${kegiatan}</div>`;
    $('studentReportContext').textContent =
      `${data.student_name || paymentStudent?.studentName || ''} • ${data.unit || paymentStudent?.unit || ''} • Tahun Ajaran ${data.year || paymentStudent?.year || ''}`;
  }

  // Isi unit pembayaran secara terpisah dari APP_CONFIG.units.
  // APP_CONFIG masih boleh mempunyai unit lain untuk menu lain, tetapi
  // finance_students hanya menerima 7 unit ini.
  const paymentUnit = $('paymentUnit');
  if (paymentUnit) {
    FINANCE_UNITS.forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      paymentUnit.appendChild(option);
    });
  }

  $('paymentYear')?.addEventListener('change', () => {
    const custom = $('paymentYearCustom');
    if (custom) custom.hidden = $('paymentYear').value !== 'custom';
    loadPaymentStudents();
  });
  $('paymentYearCustom')?.addEventListener('input', loadPaymentStudents);
  $('paymentUnit')?.addEventListener('change', loadPaymentStudents);
  $('studentName')?.addEventListener('change', checkStudentPin);
  $('createStudentPin')?.addEventListener('click', () => submitStudentPin('create'));
  $('verifyStudentPin')?.addEventListener('click', () => submitStudentPin('verify'));
  $('paymentType')?.addEventListener('change', renderPaymentDetails);
  $('paymentForm')?.addEventListener('submit', submitPayment);
  $('viewReport')?.addEventListener('click', viewPaymentReport);

  $('pinSuggestion')?.addEventListener('click', () => {
    setView('feedback');
    const text = $('feedbackText');
    if (text) text.focus();
  });

  // Link WhatsApp hanya untuk bantuan PIN, bukan untuk pengiriman saran.
  $('pinWhatsapp')?.addEventListener('click', e => {
    e.preventDefault();
    const number = String(APP_CONFIG.whatsapp || '').replace(/\D/g, '');
    if (number) location.href = `https://wa.me/${number}`;
  });

  // ============================================================
  // PENDAFTARAN / PPDB
  // Pulihkan pengisian dropdown unit dan pembukaan Google Form.
  // Tidak mengubah APP_CONFIG atau fungsi lain.
  // ============================================================
  const registrationUnit = $('registrationUnit');
  const registerButton = $('registerButton');
  const registrationMessage = $('registrationMessage');

  if (registrationUnit) {
    const ppdbUnits = Array.isArray(APP_CONFIG.units)
      ? APP_CONFIG.units.filter(unit => Object.prototype.hasOwnProperty.call(APP_CONFIG.ppdb || {}, unit))
      : Object.keys(APP_CONFIG.ppdb || {});

    registrationUnit.innerHTML = '<option value="">Pilih unit</option>';

    ppdbUnits.forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      registrationUnit.appendChild(option);
    });

    // Jika ada unit di APP_CONFIG.ppdb tetapi tidak tercantum di APP_CONFIG.units,
    // tetap tampilkan agar form yang tersedia tidak hilang.
    Object.keys(APP_CONFIG.ppdb || {}).forEach(unit => {
      if (!ppdbUnits.includes(unit)) {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        registrationUnit.appendChild(option);
      }
    });
  }

  registerButton?.addEventListener('click', () => {
    const unit = registrationUnit?.value || '';
    const formUrl = APP_CONFIG.ppdb?.[unit] || '';

    if (!unit) {
      if (registrationMessage) registrationMessage.textContent = 'Silakan pilih unit terlebih dahulu.';
      return;
    }

    if (!formUrl) {
      if (registrationMessage) registrationMessage.textContent = `Formulir pendaftaran ${unit} belum tersedia.`;
      return;
    }

    if (registrationMessage) registrationMessage.textContent = 'Membuka formulir pendaftaran...';
    location.href = formUrl;
  });

  // ============================================================
  // SARAN & MASUKAN
  // Alur: Form -> Edge Function feedback -> Supabase -> Dashboard.
  // TIDAK membuka WhatsApp setelah submit.
  // ============================================================
  $('feedbackForm')?.addEventListener('submit', async e => {
    e.preventDefault();

    const text = $('feedbackText')?.value.trim() || '';
    const name = $('feedbackName')?.value.trim() || '';
    const button = e.currentTarget.querySelector('button[type="submit"]');
    const status = $('feedbackMessage');

    if (!text) {
      if (status) status.textContent = 'Saran / masukan wajib diisi.';
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Menyimpan...';
    }
    if (status) status.textContent = 'Mengirim saran ke sistem yayasan...';

    try {
      const r = await fetch(fn(APP_CONFIG.feedbackFunction), {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':APP_CONFIG.supabasePublishableKey
        },
        body:JSON.stringify({
          name,
          message:text
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan saran.');

      $('feedbackText').value = '';
      if ($('feedbackName')) $('feedbackName').value = '';
      if (status) status.textContent = 'Saran berhasil dikirim. Terima kasih atas masukannya.';
    } catch (error) {
      if (status) status.textContent = error.message || 'Gagal menyimpan saran.';
      else alert(error.message || 'Gagal menyimpan saran.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Kirim Saran';
      }
    }
  });
})();
