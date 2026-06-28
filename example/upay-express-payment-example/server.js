require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PAYMENT_URL = process.env.UPAY_PAYMENT_URL || 'https://app.upay.co.il/API6/clientsecure/redirectpage.php';
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveOrders(orders) {
  fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function updateOrder(orderId, patch) {
  const orders = loadOrders();
  if (!orders[orderId]) return null;
  orders[orderId] = { ...orders[orderId], ...patch, updatedAt: new Date().toISOString() };
  saveOrders(orders);
  return orders[orderId];
}

function getOrder(orderId) {
  return loadOrders()[orderId] || null;
}

function createOrder(config) {
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const order = {
    id: orderId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    expectedAmount: normalizeAmount(config.amount),
    expectedCurrency: String(config.currency || process.env.UPAY_DEFAULT_CURRENCY || 'USD').toUpperCase(),
    productDescription: String(config.paymentdetails || 'Website payment'),
    customerEmail: String(config.customerEmail || ''),
    upayMerchantEmail: String(config.upayMerchantEmail || process.env.UPAY_MERCHANT_EMAIL || ''),
    maxpayments: String(config.maxpayments || '1'),
    livesystem: String(config.livesystem || process.env.UPAY_LIVE_SYSTEM || '1'),
    commissionreduction: String(config.commissionreduction || ''),
    createinvoiceandreceipt: bool01(config.createinvoiceandreceipt),
    createinvoice: bool01(config.createinvoice),
    createreceipt: bool01(config.createreceipt),
    refername: String(config.refername || process.env.UPAY_REFERNAME || 'UPAY'),
    lang: String(config.lang || process.env.UPAY_DEFAULT_LANG || 'EN').toUpperCase(),
    returnUrl: `${PUBLIC_BASE_URL}/payment/return/${encodeURIComponent(orderId)}`,
    ipnUrl: `${PUBLIC_BASE_URL}/api/upay/ipn/${encodeURIComponent(orderId)}`,
    paymentReference: `website-order-${orderId}`,
    notificationLog: [],
    verificationLog: []
  };
  const orders = loadOrders();
  orders[orderId] = order;
  saveOrders(orders);
  return order;
}

function bool01(value) {
  return value === '1' || value === 1 || value === true || value === 'on' ? '1' : '0';
}

function normalizeAmount(value) {
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be positive');
  return number.toFixed(2);
}

function upayFormFields(order) {
  // These are the website-payment hidden fields observed from Upay's generated payment button.
  // Hidden browser fields are NOT trusted. The server verifies the final transaction later.
  return {
    email: order.upayMerchantEmail,
    amount: order.expectedAmount,
    returnurl: order.returnUrl,
    ipnurl: order.ipnUrl,
    paymentdetails: `${order.productDescription} | ${order.paymentReference}`,
    maxpayments: order.maxpayments,
    livesystem: order.livesystem,
    commissionreduction: order.commissionreduction,
    createinvoiceandreceipt: order.createinvoiceandreceipt,
    createinvoice: order.createinvoice,
    createreceipt: order.createreceipt,
    refername: order.refername,
    lang: order.lang,
    currency: order.expectedCurrency
  };
}

app.get('/', (_req, res) => {
  res.send(renderPage({
    title: 'Upay website payment example',
    body: `
      <main class="hello-page">
        <section class="hero-card">
          <div>
            <p class="eyebrow">Upay hosted payment demo</p>
            <h1>Hello page</h1>
            <p class="lead">Create a local order, configure the Upay hosted-payment fields, then open a split payment page with an iframe.</p>
          </div>
        </section>

        <form class="config-card" method="post" action="/api/orders">
          <h2>Payment configuration</h2>
          <p class="muted">The browser fields are only for creating the hosted Upay page. The server still validates the paid transaction before showing the thank-you page.</p>

          <div class="grid two">
            <label>Merchant Upay email
              <input name="upayMerchantEmail" value="${htmlEscape(process.env.UPAY_MERCHANT_EMAIL || 'helpmepro1@gmail.com')}" required>
            </label>
            <label>Customer email, optional
              <input name="customerEmail" value="customer@example.com" inputmode="email">
            </label>
          </div>

          <div class="grid three">
            <label>Amount
              <input name="amount" value="10.00" inputmode="decimal" required>
            </label>
            <label>Currency
              <select name="currency">
                <option selected>USD</option>
                <option>NIS</option>
                <option>EUR</option>
              </select>
            </label>
            <label>Max payments
              <input name="maxpayments" value="1" inputmode="numeric">
            </label>
          </div>

          <label>Product / payment details
            <input name="paymentdetails" value="Website service" required>
          </label>

          <div class="grid three check-grid">
            <label class="check"><input type="checkbox" name="createreceipt" value="1" checked> Create receipt</label>
            <label class="check"><input type="checkbox" name="createinvoice" value="1"> Create invoice</label>
            <label class="check"><input type="checkbox" name="createinvoiceandreceipt" value="1"> Invoice + receipt</label>
          </div>

          <div class="grid three">
            <label>Language
              <select name="lang">
                <option selected>EN</option>
                <option>HE</option>
              </select>
            </label>
            <label>Live system
              <select name="livesystem">
                <option selected value="1">1 - live</option>
                <option value="0">0 - test, confirm with Upay</option>
              </select>
            </label>
            <label>Refer name
              <input name="refername" value="UPAY">
            </label>
          </div>

          <label>Commission reduction, optional
            <input name="commissionreduction" value="">
          </label>

          <button class="primary" type="submit">Create order and open payment page</button>
        </form>
      </main>
    `
  }));
});

app.post('/api/orders', (req, res) => {
  try {
    const order = createOrder(req.body);
    res.redirect(`/pay/${encodeURIComponent(order.id)}`);
  } catch (error) {
    res.status(400).send(renderPage({ title: 'Invalid order', body: `<main class="message-page"><h1>Invalid order</h1><p>${htmlEscape(error.message)}</p><a href="/">Back</a></main>` }));
  }
});

app.get('/pay/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Pay with Upay</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="pay-body">
  <main class="pay-layout">
    <aside class="pay-side">
      <div class="brand-pill">Secure checkout</div>
      <h1>Almost done.</h1>
      <p class="pay-copy">Complete the payment on the right. The browser return page is optional: if you close this page after paying, Upay IPN can still trigger server-side verification and complete the order.</p>
      <div class="order-summary">
        <span>Order</span><strong>${htmlEscape(order.id.slice(0, 8))}</strong>
        <span>Amount</span><strong>${htmlEscape(order.expectedAmount)} ${htmlEscape(order.expectedCurrency)}</strong>
        <span>Item</span><strong>${htmlEscape(order.productDescription)}</strong>
      </div>
      <p class="tiny">Do not close this page until payment is complete. If the iframe is blocked by Upay, use the full-page payment button below.</p>
      <a class="secondary" href="/upay-form/${encodeURIComponent(order.id)}?full=1" target="_blank" rel="noopener">Open Upay in new tab</a>
    </aside>
    <section class="iframe-wrap" aria-label="Upay payment frame">
      <iframe title="Upay payment" src="/upay-form/${encodeURIComponent(order.id)}"></iframe>
    </section>
  </main>
</body>
</html>`);
});

app.get('/upay-form/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  const fields = upayFormFields(order);
  const inputs = Object.entries(fields).map(([name, value]) => (
    `<input type="hidden" name="${htmlEscape(name)}" value="${htmlEscape(value)}">`
  )).join('\n');

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting to Upay</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="redirect-body">
  <form id="upayform" action="${htmlEscape(PAYMENT_URL)}" method="post">
    ${inputs}
    <noscript><button class="primary" type="submit">Continue to Upay</button></noscript>
  </form>
  <div class="center-card">
    <h1>Opening Upay…</h1>
    <p>Please wait. Your secure payment page is loading.</p>
    <button class="primary" type="submit" form="upayform">Continue manually</button>
  </div>
  <script>document.getElementById('upayform').submit();</script>
</body>
</html>`);
});

app.all('/payment/return/:orderId', async (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  logNotification(order.id, 'returnurl', { query: req.query, body: req.body });
  triggerVerification(order.id, { source: 'returnurl', query: req.query, body: req.body });
  res.redirect(`/checking/${encodeURIComponent(order.id)}`);
});

app.all('/api/upay/ipn/:orderId', async (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  logNotification(order.id, 'ipnurl', { query: req.query, body: req.body });
  triggerVerification(order.id, { source: 'ipnurl', query: req.query, body: req.body });
  res.json({ ok: true, message: 'Notification received. Server-side verification started.' });
});

app.get('/checking/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  res.send(renderPage({
    title: 'Checking payment',
    body: `
      <main class="message-page checking" data-order-id="${htmlEscape(order.id)}">
        <div class="spinner"></div>
        <h1>Checking your payment…</h1>
        <p>The server is verifying the Upay transaction. This page will continue automatically. If you close this page, the IPN handler can still complete the order server-side.</p>
        <pre id="statusBox">Waiting…</pre>
        ${process.env.UPAY_VERIFY_MODE === 'mock' ? `<p class="muted">Local demo mode: <a href="/dev/simulate-upay-return/${encodeURIComponent(order.id)}">simulate successful Upay return</a></p>` : ''}
      </main>
      <script src="/js/checking.js"></script>
    `
  }));
});

app.get('/thank-you/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  if (order.status !== 'paid') return res.redirect(`/checking/${encodeURIComponent(order.id)}`);
  res.send(renderPage({
    title: 'Thank you',
    body: `
      <main class="message-page success">
        <div class="success-mark">✓</div>
        <h1>Thank you!</h1>
        <p>Your payment was verified server-side. This confirmation can be reached by browser return, or completed earlier by IPN if the browser was closed.</p>
        <div class="receipt-box">
          <span>Order</span><strong>${htmlEscape(order.id)}</strong>
          <span>Amount</span><strong>${htmlEscape(order.expectedAmount)} ${htmlEscape(order.expectedCurrency)}</strong>
          <span>Upay transaction</span><strong>${htmlEscape(order.upayTransactionId || order.upayCashierId || 'verified')}</strong>
          <span>Status</span><strong>${htmlEscape(order.upayStatus || 'S')}</strong>
        </div>
        <a class="secondary" href="/">Create another payment</a>
      </main>
    `
  }));
});

app.get('/api/orders/:orderId/status', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({
    ok: true,
    orderId: order.id,
    status: order.status,
    expectedAmount: order.expectedAmount,
    expectedCurrency: order.expectedCurrency,
    upayStatus: order.upayStatus || null,
    upayTransactionId: order.upayTransactionId || null,
    completedBy: order.completedBy || null,
    fulfilledAt: order.fulfilledAt || null,
    error: order.verificationError || null,
    thankYouUrl: order.status === 'paid' ? `/thank-you/${encodeURIComponent(order.id)}` : null
  });
});

app.get('/dev/simulate-upay-return/:orderId', (req, res) => {
  if (process.env.UPAY_VERIFY_MODE !== 'mock') return res.status(403).send('Only available in mock mode');
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).send('Order not found');
  triggerVerification(order.id, {
    source: 'dev-simulate',
    query: { order_id: order.id, transactionid: `mock-${order.id.slice(0, 8)}` },
    body: {}
  });
  res.redirect(`/checking/${encodeURIComponent(order.id)}`);
});

function logNotification(orderId, source, payload) {
  const order = getOrder(orderId);
  if (!order) return;
  const notificationLog = order.notificationLog || [];
  notificationLog.push({ source, payload, at: new Date().toISOString() });
  updateOrder(orderId, { notificationLog });
}

function triggerVerification(orderId, notification) {
  const order = getOrder(orderId);

  // returnurl and ipnurl are two independent triggers for the same idempotent verification.
  // If the user closes the browser after payment, ipnurl alone should still complete the order.
  // If both arrive, only the first successful verification marks the order paid.
  if (!order || order.status === 'paid' || order.status === 'verifying') return;
  updateOrder(orderId, { status: 'verifying', verificationError: null });
  verifyOrder(orderId, notification).catch((error) => {
    appendVerificationLog(orderId, { ok: false, error: error.message });
    updateOrder(orderId, { status: 'pending', verificationError: error.message });
  });
}

function appendVerificationLog(orderId, entry) {
  const order = getOrder(orderId);
  if (!order) return;
  const verificationLog = order.verificationLog || [];
  verificationLog.push({ ...entry, at: new Date().toISOString() });
  updateOrder(orderId, { verificationLog });
}

async function verifyOrder(orderId, notification) {
  const order = getOrder(orderId);
  if (!order) throw new Error('Order not found');

  // Callback/IPN is only a trigger. It is NOT proof of payment.
  // The proof is fetched server-to-server from Upay and matched to this local order.
  const transaction = await fetchAuthoritativeUpayTransaction(order, notification);

  validateTransactionAgainstOrder(order, transaction);

  // Idempotency: never allow one Upay transaction to pay two local orders.
  const orders = loadOrders();
  for (const other of Object.values(orders)) {
    if (other.id !== order.id && other.upayTransactionId && other.upayTransactionId === transaction.transactionid) {
      throw new Error('This Upay transaction is already attached to another order');
    }
  }

  const paidPatch = {
    status: 'paid',
    upayStatus: transaction.transferstatus || transaction.status || 'S',
    upayTransactionId: transaction.transactionid || null,
    upayCashierId: transaction.cashierid || null,
    upayVerifiedAt: new Date().toISOString(),
    verifiedTransactionSnapshot: transaction,
    completedBy: notification?.source || 'server-verification',
    fulfilledAt: new Date().toISOString()
  };

  // This is the right place to fulfill exactly once: send email, unlock download,
  // activate subscription, create receipt/invoice, etc. Do it after validation only.
  paidPatch.fulfillmentNote = `Fulfilled after verified ${paidPatch.completedBy}`;

  updateOrder(order.id, paidPatch);
  appendVerificationLog(order.id, { ok: true, completedBy: paidPatch.completedBy, transaction });
}

async function fetchAuthoritativeUpayTransaction(order, notification) {
  if ((process.env.UPAY_VERIFY_MODE || 'mock') === 'mock') {
    // Local demo mode. Replace with UPAY_VERIFY_MODE=api in production.
    await new Promise(resolve => setTimeout(resolve, 900));
    return {
      transactionid: notification?.query?.transactionid || `mock-${order.id.slice(0, 8)}`,
      cashierid: notification?.query?.cashierid || `cashier-${order.id.slice(0, 8)}`,
      amount: order.expectedAmount,
      currency: order.expectedCurrency,
      transferstatus: 'S',
      paymentdetails: `${order.productDescription} | ${order.paymentReference}`,
      merchantEmail: order.upayMerchantEmail
    };
  }

  return callUpayGetTransactions(order, notification);
}

async function callUpayGetTransactions(order, notification) {
  const apiUrl = process.env.UPAY_API_URL;
  if (!apiUrl) throw new Error('UPAY_API_URL missing');

  // Important: exact Upay filters should be confirmed by real test calls.
  // This uses multiple hints: cashierid/transactionid from notification if present, and your payment reference.
  const parameters = {
    transactionid: notification?.query?.transactionid || notification?.body?.transactionid || undefined,
    cashierid: notification?.query?.cashierid || notification?.body?.cashierid || undefined,
    paymentdetails: order.paymentReference,
    email: order.upayMerchantEmail
  };
  Object.keys(parameters).forEach(k => parameters[k] === undefined && delete parameters[k]);

  const message = {
    header: {
      refername: process.env.UPAY_REFERNAME || 'UPAY',
      livesystem: Number(order.livesystem || process.env.UPAY_LIVE_SYSTEM || 1),
      language: order.lang || process.env.UPAY_DEFAULT_LANG || 'EN',
      api_username: process.env.UPAY_API_USERNAME,
      api_key: process.env.UPAY_API_KEY
    },
    request: {
      mainaction: 'TRANSACTIONSINFO',
      minoraction: 'GETTRANSACTIONS',
      encoding: 'json',
      parameters
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ msg: JSON.stringify(message) })
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Upay returned non-JSON response: ${text.slice(0, 300)}`); }
  if (!response.ok) throw new Error(`Upay HTTP ${response.status}`);

  const candidates = extractTransactionCandidates(data);
  const match = candidates.find(tx => transactionMatchesOrder(order, tx));
  if (!match) {
    throw new Error(`No matching paid Upay transaction found. Candidates: ${candidates.length}`);
  }
  return match;
}

function extractTransactionCandidates(data) {
  // Upay response shape should be confirmed. This accepts common possible containers.
  const containers = [
    data?.response?.transactions,
    data?.response?.data,
    data?.response,
    data?.transactions,
    data?.data
  ];
  for (const value of containers) {
    if (Array.isArray(value)) return value;
  }
  if (data && typeof data === 'object') return [data];
  return [];
}

function transactionMatchesOrder(order, tx) {
  try {
    validateTransactionAgainstOrder(order, tx);
    return true;
  } catch {
    return false;
  }
}

function validateTransactionAgainstOrder(order, tx) {
  if (!tx || typeof tx !== 'object') throw new Error('Missing transaction');

  const status = String(tx.transferstatus || tx.status || '').toUpperCase();
  const paidStatuses = String(process.env.UPAY_PAID_STATUSES || 'S').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!paidStatuses.includes(status)) {
    throw new Error(`Transaction status is not final paid. Got ${status || '(empty)'}`);
  }

  const amount = normalizeAmount(tx.amount || tx.totalamount || tx.amountpayed || tx.sum);
  if (amount !== order.expectedAmount) {
    throw new Error(`Amount mismatch. Expected ${order.expectedAmount}, got ${amount}`);
  }

  const currency = String(tx.currency || tx.currencycode || order.expectedCurrency).toUpperCase();
  if (currency !== order.expectedCurrency) {
    throw new Error(`Currency mismatch. Expected ${order.expectedCurrency}, got ${currency}`);
  }

  const details = String(tx.paymentdetails || tx.description || tx.comment || '');
  const hasReference = details.includes(order.paymentReference) || JSON.stringify(tx).includes(order.id);
  if (!hasReference) {
    throw new Error('Transaction does not contain the local order reference');
  }

  return true;
}

function renderPage({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  ${body}
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`Upay example running at http://localhost:${PORT}`);
  console.log(`Verification mode: ${process.env.UPAY_VERIFY_MODE || 'mock'}`);
});
