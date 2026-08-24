(() => {
  const form = document.getElementById('notificationSendForm');
  if (!form) return;
  const status = document.getElementById('notificationStatus');
  const topicInput = document.getElementById('notificationTopicInput');
  const submitButton = document.getElementById('notificationSendButton');

  function updateButtonLabel() {
    const label = topicInput?.selectedOptions[0]?.textContent || 'Kirim Notifikasi';
    submitButton.textContent = label;
  }

  topicInput?.addEventListener('change', updateButtonLabel);
  updateButtonLabel();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const title = document.getElementById('notificationTitleInput').value.trim();
    const body = document.getElementById('notificationBodyInput').value.trim();
    const topic = topicInput.value;
    const button = form.querySelector('button[type="submit"]');
    const session = JSON.parse(localStorage.getItem('supabase_session') || 'null');
    if (!session?.access_token) {
      status.textContent = 'Silakan login Dashboard terlebih dahulu.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Mengirim notifikasi...';
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title, body, topic })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Notifikasi gagal dikirim.');
      form.reset();
      status.textContent = `Notifikasi berhasil dikirim: ${topicInput.selectedOptions[0].textContent}.`;
      topicInput.value = topic;
      updateButtonLabel();
    } catch (error) {
      status.textContent = error.message || 'Notifikasi gagal dikirim.';
    } finally {
      button.disabled = false;
    }
  });
})();
