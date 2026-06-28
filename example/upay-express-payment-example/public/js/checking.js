const page = document.querySelector('[data-order-id]');
const statusBox = document.getElementById('statusBox');
const orderId = page?.dataset.orderId;

async function poll() {
  if (!orderId) return;
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, { cache: 'no-store' });
    const data = await response.json();
    statusBox.textContent = JSON.stringify(data, null, 2);
    if (data.status === 'paid' && data.thankYouUrl) {
      window.location.href = data.thankYouUrl;
      return;
    }
  } catch (error) {
    statusBox.textContent = `Error: ${error.message}`;
  }
  setTimeout(poll, 1400);
}

poll();
