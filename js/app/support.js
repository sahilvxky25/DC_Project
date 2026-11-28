import { auth } from '../auth/firebase-client.js';
import { RAZORPAY_API_BASE_URL } from './support-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

const AMOUNTS = [49, 99, 199];
const UPI_ID = '8598032563@slc';
const PAYEE_NAME = 'Mr Sahil Kumar Patra';
const MAX_AMOUNT = 100000;

function showMessage(target, message, kind = 'error') {
  target.className = 'support-payment-status ' + (kind === 'success' ? 'support-payment-success' : 'support-payment-error');
  target.textContent = message;
}

function validAmount(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_AMOUNT;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (window.__bitsecureRazorpayLoading) return window.__bitsecureRazorpayLoading;
  window.__bitsecureRazorpayLoading = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return window.__bitsecureRazorpayLoading;
}

async function apiRequest(path, options = {}) {
  if (!RAZORPAY_API_BASE_URL) throw new Error('Online payments are not configured yet. Please use the UPI QR option for now.');
  const response = await fetch(RAZORPAY_API_BASE_URL.replace(/\/$/, '') + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The payment service could not complete the request.');
  return result;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function renderAdminRows(container, records) {
  container.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'support-admin-empty';
    empty.textContent = 'No Razorpay transactions have been recorded yet.';
    container.append(empty);
    return;
  }
  const tableWrap = document.createElement('div');
  tableWrap.className = 'support-admin-table-wrap';
  const table = document.createElement('table');
  table.className = 'support-admin-table';
  const headings = ['Date', 'Amount', 'Method', 'Status', 'Payment reference'];
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headings.forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  records.forEach(record => {
    const row = document.createElement('tr');
    const values = [
      formatDate(record.createdAt),
      '₹' + ((Number(record.amount) || 0) / 100).toLocaleString('en-IN'),
      record.method || '—',
      record.status || 'unknown',
      record.paymentId || record.orderId || '—'
    ];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      if (index === 3) cell.dataset.status = String(value).toLowerCase();
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(tbody);
  tableWrap.append(table);
  container.append(tableWrap);
}

export function renderSupportPage(root) {
  root.innerHTML = `
    <div class="info-hero support-hero">
      <span class="info-kicker">SUPPORT THE MISSION</span>
      <h1>Help us make learning <span>more hands-on.</span></h1>
      <p class="info-lead">Your encouragement helps us build practical, interactive learning experiences that students can explore at their own pace.</p>
      <p>BitSecure started with Data Communications. We want to keep improving the labs and gradually bring the same learn-by-doing approach to more subjects.</p>
      <div class="support-hero-note"><span aria-hidden="true">✦</span> Every contribution is voluntary and appreciated.</div>
    </div>

    <section class="info-section support-impact-section" aria-labelledby="support-impact-title">
      <div class="info-section-heading">
        <span class="info-kicker">WHAT YOUR SUPPORT ENABLES</span>
        <h2 id="support-impact-title">Help turn more ideas into useful learning tools.</h2>
        <p>Contributions go towards the work involved in keeping the project useful, reliable, and growing.</p>
      </div>
      <div class="support-impact-grid">
        <article class="support-impact-card"><span class="support-impact-icon" aria-hidden="true">⌁</span><h3>Hosting &amp; infrastructure</h3><p>Help cover the services and resources needed to keep BitSecure available.</p></article>
        <article class="support-impact-card"><span class="support-impact-icon" aria-hidden="true">▦</span><h3>New simulations</h3><p>Make room to design and build interactive tools for more technical subjects.</p></article>
        <article class="support-impact-card"><span class="support-impact-icon" aria-hidden="true">✧</span><h3>Better learning experiences</h3><p>Improve explanations, accessibility, animations, and existing learning modules.</p></article>
      </div>
    </section>

    <section class="support-giving-layout support-upi-layout" aria-labelledby="support-giving-title">
      <div class="support-giving-copy">
        <span class="info-kicker">ONE-TIME PROJECT SUPPORT</span>
        <h2 id="support-giving-title">Choose an amount that feels right.</h2>
        <p>There is no subscription or expectation to contribute. Even a small one-time contribution can help us keep improving the project.</p>
        <div class="support-amount-label">Contribution amount (INR)</div>
        <div class="support-amount-options" role="group" aria-label="Choose a contribution amount">
          ${AMOUNTS.map((amount, index) => '<button class="support-amount-option' + (index === 1 ? ' is-selected' : '') + '" type="button" data-amount="' + amount + '" aria-pressed="' + (index === 1) + '">₹' + amount + '</button>').join('')}
          <button class="support-amount-option" type="button" data-amount="custom" aria-pressed="false">Custom</button>
        </div>
        <label class="support-custom-label" for="support-custom-amount" hidden>Custom amount (₹)</label>
        <input class="support-custom-input" id="support-custom-amount" type="number" min="1" max="100000" step="1" inputmode="numeric" placeholder="Enter amount in ₹" hidden>
        <p class="support-amount-help">Choose a suggested amount or enter a custom whole-rupee amount between ₹1 and ₹1,00,000.</p>
        <div class="support-trust-points">
          <div><span aria-hidden="true">✓</span><span>One-time, voluntary support</span></div>
          <div><span aria-hidden="true">✓</span><span>UPI QR or secure Razorpay checkout</span></div>
          <div><span aria-hidden="true">✓</span><span>No BitSecure account required to contribute</span></div>
        </div>
      </div>

      <div class="support-payment-methods">
        <aside class="support-payment-card support-upi-card" aria-labelledby="support-upi-title">
          <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">↗</span><span class="support-payment-provider">DIRECT UPI PAYMENT</span></div>
          <h3 id="support-upi-title">Pay using UPI QR</h3>
          <p>Scan this QR code with any UPI app. Direct UPI payments are not automatically verified or included in the online transaction dashboard.</p>
          <div class="support-upi-qr-wrap"><img class="support-upi-qr" src="assets/sahil-upi-qr.svg" alt="UPI QR code for 8598032563@slc" width="240" height="240"></div>
          <div class="support-upi-payee"><span class="support-upi-caption">PAY TO</span><strong>${PAYEE_NAME}</strong><span class="support-upi-id">${UPI_ID}</span></div>
          <div class="support-upi-actions">
            <button class="btn support-copy-upi" id="support-copy-upi" type="button">Copy UPI ID</button>
            <a class="btn support-upi-open" id="support-upi-open" href="upi://pay?pa=8598032563%40slc&amp;pn=Mr%20Sahil%20Kumar%20Patra&amp;cu=INR&amp;am=99&amp;tn=BitSecure%20project%20support">Open UPI app ↗</a>
          </div>
          <p class="support-payment-status" id="support-upi-status" role="status" aria-live="polite"></p>
        </aside>

        <aside class="support-payment-card support-online-card" aria-labelledby="support-online-title">
          <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">⌑</span><span class="support-payment-provider">SECURE ONLINE CHECKOUT</span></div>
          <h3 id="support-online-title">Pay securely with Razorpay</h3>
          <p>Choose from payment methods enabled for the merchant account, such as UPI, cards or net banking.</p>
          <div class="support-checkout-summary"><span>Contribution</span><strong id="support-checkout-amount">₹99</strong></div>
          <button class="btn support-checkout-button" id="support-checkout" type="button">Continue to secure payment <span aria-hidden="true">↗</span></button>
          <p class="support-payment-status" id="support-checkout-status" role="status" aria-live="polite"></p>
          <p class="support-payment-footnote">Checkout is provided by Razorpay. BitSecure never asks for your UPI PIN, card number or banking password.</p>
        </aside>
      </div>
    </section>

    <section class="support-admin-section" id="support-admin-section">
      <div class="support-admin-heading"><div><span class="info-kicker">PROJECT MANAGEMENT</span><h2>Contribution dashboard</h2><p>Restricted to the configured project administrator. Only server-verified Razorpay payments appear here.</p></div><button class="btn" id="support-admin-load" type="button">Open admin dashboard</button></div>
      <p class="support-payment-status" id="support-admin-status" role="status" aria-live="polite"></p>
      <div class="support-admin-content" id="support-admin-content" aria-live="polite"></div>
    </section>

    <section class="support-thanks-panel"><div><span class="info-kicker">THANK YOU</span><h2>Support is more than a payment.</h2><p>Sharing BitSecure with a classmate, reporting an issue, suggesting a feature, or contributing code also helps the project move forward.</p></div><a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a></section>
    <p class="support-disclaimer">Contributions are voluntary project support, not a purchase, investment, or promise of a particular feature. Do not assume they are tax-deductible. Direct UPI payments are not automatically verified by BitSecure; only captured Razorpay payments are included in the verified transaction dashboard.</p>
  `;

  const customInput = root.querySelector('#support-custom-amount');
  const customLabel = root.querySelector('.support-custom-label');
  const upiStatus = root.querySelector('#support-upi-status');
  const checkoutStatus = root.querySelector('#support-checkout-status');
  const upiLink = root.querySelector('#support-upi-open');
  const checkoutButton = root.querySelector('#support-checkout');
  const checkoutAmount = root.querySelector('#support-checkout-amount');
  const adminButton = root.querySelector('#support-admin-load');
  const adminStatus = root.querySelector('#support-admin-status');
  const adminContent = root.querySelector('#support-admin-content');
  let selectedAmount = 99;
  let activeUser = auth.currentUser || null;
  let disposed = false;

  function currentAmount() {
    return selectedAmount === 'custom' ? Number(customInput.value) : selectedAmount;
  }

  function updatePaymentLinks() {
    const amount = currentAmount();
    const valid = validAmount(amount);
    checkoutAmount.textContent = valid ? '₹' + amount.toLocaleString('en-IN') : 'Enter a valid amount';
    const params = new URLSearchParams({ pa: UPI_ID, pn: PAYEE_NAME, cu: 'INR', tn: 'BitSecure project support' });
    if (valid) params.set('am', String(amount));
    upiLink.href = 'upi://pay?' + params.toString();
    upiLink.setAttribute('aria-disabled', String(!valid));
    checkoutButton.disabled = !valid;
    return valid;
  }

  root.querySelectorAll('[data-amount]').forEach(button => {
    button.addEventListener('click', () => {
      selectedAmount = button.dataset.amount === 'custom' ? 'custom' : Number(button.dataset.amount);
      root.querySelectorAll('[data-amount]').forEach(option => {
        const active = option === button;
        option.classList.toggle('is-selected', active);
        option.setAttribute('aria-pressed', String(active));
      });
      const custom = selectedAmount === 'custom';
      customInput.hidden = !custom;
      customLabel.hidden = !custom;
      if (custom) customInput.focus();
      upiStatus.textContent = '';
      checkoutStatus.textContent = '';
      updatePaymentLinks();
    });
  });
  customInput.addEventListener('input', updatePaymentLinks);

  root.querySelector('#support-copy-upi').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      showMessage(upiStatus, 'UPI ID copied. Open your UPI app and enter the contribution amount.', 'success');
    } catch {
      showMessage(upiStatus, 'Copy is unavailable in this browser. UPI ID: ' + UPI_ID);
    }
  });

  upiLink.addEventListener('click', event => {
    if (!updatePaymentLinks()) {
      event.preventDefault();
      showMessage(upiStatus, 'Enter a whole-rupee amount between ₹1 and ₹1,00,000.');
      return;
    }
    showMessage(upiStatus, 'Opening your UPI app. If nothing happens, scan the QR code or copy the UPI ID.', 'success');
  });

  checkoutButton.addEventListener('click', async () => {
    if (!updatePaymentLinks()) return;
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'Preparing secure checkout…';
    checkoutStatus.textContent = '';
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay Checkout could not load. Check your connection and try again.');
      const amount = currentAmount();
      const order = await apiRequest('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount: amount * 100 })
      });
      if (!order.order_id || !order.key_id || order.amount !== amount * 100) {
        throw new Error('The payment service returned an invalid order. Please try again.');
      }
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'BitSecure',
        description: 'Voluntary project contribution',
        order_id: order.order_id,
        image: '/favicon.png',
        handler: async response => {
          showMessage(checkoutStatus, 'Payment submitted. Verifying the captured payment…');
          try {
            const verified = await apiRequest('/api/verify-payment', {
              method: 'POST',
              body: JSON.stringify(response)
            });
            if (!verified.verified || verified.status !== 'captured') {
              throw new Error('Payment could not be confirmed as captured. Please check your payment status before retrying.');
            }
            showMessage(checkoutStatus, 'Thank you! Your contribution was verified successfully.', 'success');
          } catch (error) {
            showMessage(checkoutStatus, error.message + ' If your account was charged, do not pay again; the payment will be reconciled through the secure webhook.');
          }
        },
        modal: {
          ondismiss: () => {
            if (!checkoutStatus.textContent) showMessage(checkoutStatus, 'Checkout closed. No successful payment has been confirmed.');
          },
          escape: true,
          confirm_close: true
        },
        prefill: activeUser?.email ? { email: activeUser.email } : {},
        notes: { source: 'BitSecure Support Us' },
        theme: { color: '#6478f5' }
      });
      checkout.on('payment.failed', response => {
        const description = response?.error?.description || 'The payment was not completed.';
        showMessage(checkoutStatus, description + ' You can try again or use the UPI QR option.');
      });
      checkout.open();
    } catch (error) {
      showMessage(checkoutStatus, error.message || 'Unable to start checkout.');
    } finally {
      checkoutButton.disabled = !validAmount(currentAmount());
      checkoutButton.innerHTML = 'Continue to secure payment <span aria-hidden="true">↗</span>';
    }
  });

  adminButton.addEventListener('click', async () => {
    adminButton.disabled = true;
    adminStatus.textContent = '';
    adminContent.replaceChildren();
    try {
      const user = auth.currentUser || activeUser;
      if (!user) throw new Error('Sign in with the configured administrator account to view this dashboard.');
      const token = await user.getIdToken();
      const result = await apiRequest('/api/admin/contributions', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token }
      });
      renderAdminRows(adminContent, result.contributions || []);
      const summary = document.createElement('div');
      summary.className = 'support-admin-summary';
      const successful = (result.contributions || []).filter(item => ['captured', 'partially_refunded'].includes(item.status));
      const total = successful.reduce((sum, item) => sum + Math.max(0, (Number(item.amount) || 0) - (Number(item.refundedAmount) || 0)), 0);
      summary.textContent = 'Net verified contributions: ₹' + (total / 100).toLocaleString('en-IN') + ' · ' + successful.length + ' successful payments';
      adminContent.prepend(summary);
      showMessage(adminStatus, 'Dashboard data loaded from verified Razorpay transactions.', 'success');
    } catch (error) {
      showMessage(adminStatus, error.message || 'Unable to load the admin dashboard.');
    } finally {
      adminButton.disabled = false;
    }
  });

  const unsubscribe = onAuthStateChanged(auth, user => { activeUser = user; });
  updatePaymentLinks();
  return () => {
    disposed = true;
    unsubscribe();
    root.replaceChildren();
  };
}
