import { RAZORPAY_API_BASE_URL } from './support-config.js';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const AMOUNTS = [49, 99, 199];

function showMessage(target, message, kind = 'error') {
  target.className = kind === 'success' ? 'support-payment-success' : 'support-payment-error';
  target.textContent = message;
}

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (window.__bitsecureRazorpayScript) return window.__bitsecureRazorpayScript;
  window.__bitsecureRazorpayScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay Checkout did not initialize.'));
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.head.append(script);
  }).catch(error => {
    window.__bitsecureRazorpayScript = null;
    throw error;
  });
  return window.__bitsecureRazorpayScript;
}

/** Render the Support Us page and return its router cleanup function. */
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

    <section class="support-giving-layout" aria-labelledby="support-giving-title">
      <div class="support-giving-copy">
        <span class="info-kicker">ONE-TIME PROJECT SUPPORT</span>
        <h2 id="support-giving-title">Choose an amount that feels right.</h2>
        <p>There is no subscription or expectation to contribute. Even a small one-time contribution can help us keep improving the project.</p>
        <div class="support-amount-label">Contribution amount (INR)</div>
        <div class="support-amount-options" role="group" aria-label="Choose a contribution amount">
          ${AMOUNTS.map((amount, index) => `<button class="support-amount-option${index === 1 ? ' is-selected' : ''}" type="button" data-amount="${amount}" aria-pressed="${index === 1}">₹${amount}</button>`).join('')}
          <button class="support-amount-option" type="button" data-amount="custom" aria-pressed="false">Custom</button>
        </div>
        <label class="support-custom-label" for="support-custom-amount" hidden>Custom amount (₹)</label>
        <input class="support-custom-input" id="support-custom-amount" type="number" min="1" max="100000" step="1" inputmode="numeric" placeholder="Enter amount in ₹" hidden>
        <p class="support-amount-help">Minimum contribution is ₹1. You can choose a suggested amount or enter a custom whole-rupee amount.</p>
        <div class="support-trust-points">
          <div><span aria-hidden="true">✓</span><span>One-time, voluntary support</span></div>
          <div><span aria-hidden="true">✓</span><span>Payment details handled by Razorpay</span></div>
          <div><span aria-hidden="true">✓</span><span>No BitSecure account required to contribute</span></div>
        </div>
      </div>

      <aside class="support-payment-card" aria-labelledby="support-payment-title">
        <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">⌑</span><span class="support-payment-provider">SECURE CHECKOUT · RAZORPAY</span></div>
        <h3 id="support-payment-title">Support BitSecure</h3>
        <p>Your payment opens in Razorpay's secure checkout. BitSecure never receives your card details, UPI PIN, or banking password.</p>
        <div class="support-payment-slot" id="support-payment-slot" aria-live="polite">
          <button class="btn support-checkout-button" id="support-pay-button" type="button">Continue to secure payment <span aria-hidden="true">→</span></button>
          <p class="support-payment-status" id="support-payment-status" role="status"></p>
        </div>
        <p class="support-payment-footnote">Test mode is used until you configure live credentials in your Cloudflare Worker. A verified signature confirms the checkout response; reconcile captured payments in the Razorpay Dashboard.</p>
      </aside>
    </section>

    <section class="support-upi-section" aria-labelledby="support-upi-title">
      <div class="support-upi-copy">
        <span class="info-kicker">DIRECT UPI PAYMENT</span>
        <h2 id="support-upi-title">Prefer paying with your UPI app?</h2>
        <p>Scan this QR code with any supported UPI app. Enter the contribution amount you selected above before confirming the payment.</p>
        <div class="support-upi-id-row">
          <div><span class="support-upi-label">UPI ID</span><strong id="support-upi-id">8598032563@slc</strong></div>
          <button class="btn support-upi-copy-button" id="support-upi-copy" type="button">Copy UPI ID</button>
        </div>
        <a class="btn support-upi-open-button" id="support-upi-open" href="upi://pay?pa=8598032563%40slc&amp;pn=Mr%20Sahil%20Kumar%20Patra&amp;cu=INR&amp;tn=BitSecure%20project%20support">Open UPI app <span aria-hidden="true">↗</span></a>
        <p class="support-upi-status" id="support-upi-status" role="status" aria-live="polite"></p>
        <p class="support-upi-note">Direct UPI payments are made to the UPI ID above, outside Razorpay. They are not automatically verified or recorded by BitSecure. Keep your UPI transaction reference for your records.</p>
      </div>
      <figure class="support-upi-qr-card">
        <img src="assets/support-upi-qr.svg" alt="UPI QR code for 8598032563@slc" width="270" height="270" loading="lazy">
        <figcaption><strong>Mr Sahil Kumar Patra</strong><span>Scan to pay using UPI</span></figcaption>
      </figure>
    </section>

    <section class="support-thanks-panel"><div><span class="info-kicker">THANK YOU</span><h2>Support is more than a payment.</h2><p>Sharing BitSecure with a classmate, reporting an issue, suggesting a feature, or contributing code also helps the project move forward.</p></div><a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a></section>
    <p class="support-disclaimer">Contributions are voluntary project support, not a purchase, investment, or promise of a particular feature. Do not assume they are tax-deductible.</p>
  `;

  const slot = root.querySelector('#support-payment-slot');
  const payButton = root.querySelector('#support-pay-button');
  const status = root.querySelector('#support-payment-status');
  const customInput = root.querySelector('#support-custom-amount');
  const customLabel = root.querySelector('.support-custom-label');
  let selectedAmount = 99;
  let disposed = false;
  const upiOpenButton = root.querySelector('#support-upi-open');
  const upiStatus = root.querySelector('#support-upi-status');
  const upiId = '8598032563@slc';

  function updateUpiLink() {
    const rupees = selectedAmount === 'custom' ? Number(customInput.value) : selectedAmount;
    const params = new URLSearchParams({
      pa: upiId,
      pn: 'Mr Sahil Kumar Patra',
      cu: 'INR',
      tn: 'BitSecure project support'
    });
    if (Number.isSafeInteger(rupees) && rupees >= 1 && rupees <= 100000) params.set('am', String(rupees));
    upiOpenButton.href = 'upi://pay?' + params.toString();
  }

  updateUpiLink();
  root.querySelector('#support-upi-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      upiStatus.textContent = 'UPI ID copied. Open your UPI app and enter the selected amount.';
    } catch {
      upiStatus.textContent = 'Copy is unavailable in this browser. Select and copy: ' + upiId;
    }
  });
  upiOpenButton.addEventListener('click', () => {
    upiStatus.textContent = 'If no UPI app opens, scan the QR code or copy the UPI ID instead.';
  });
  customInput.addEventListener('input', updateUpiLink);

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
      status.textContent = '';
      upiStatus.textContent = '';
      updateUpiLink();
    });
  });

  async function postJson(path, payload) {
    const response = await fetch(`${RAZORPAY_API_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Payment service request failed.');
    return data;
  }

  async function startCheckout() {
    const rupees = selectedAmount === 'custom' ? Number(customInput.value) : selectedAmount;
    if (!Number.isSafeInteger(rupees) || rupees < 1 || rupees > 100000) {
      showMessage(status, 'Enter a whole-rupee amount between ₹1 and ₹1,00,000.');
      return;
    }
    if (!RAZORPAY_API_BASE_URL || !/^https:\/\//.test(RAZORPAY_API_BASE_URL)) {
      showMessage(slot, 'Checkout is not configured yet. Set the Cloudflare Worker URL in js/app/support-config.js.');
      return;
    }

    payButton.disabled = true;
    payButton.textContent = 'Preparing secure checkout…';
    status.textContent = 'Creating your payment order.';
    try {
      const order = await postJson('/api/create-order', { amount: rupees * 100 });
      await loadCheckoutScript();
      if (disposed) return;
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'BitSecure',
        description: 'Voluntary project support',
        order_id: order.order_id,
        theme: { color: '#6d7cff' },
        modal: {
          ondismiss: () => {
            if (!disposed) status.textContent = 'Checkout was closed. No payment confirmation was received.';
          }
        },
        handler: async response => {
          if (disposed) return;
          status.textContent = 'Verifying payment signature…';
          payButton.disabled = true;
          try {
            const verification = await postJson('/api/verify-payment', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
            if (verification.verified) showMessage(slot, 'Thank you! Razorpay payment signature verified successfully.', 'success');
            else throw new Error('Payment could not be verified. Please contact support before retrying.');
          } catch (error) {
            showMessage(slot, error.message || 'Payment verification failed. Do not retry until you check your Razorpay transaction status.');
          } finally {
            if (!disposed) {
              payButton.disabled = false;
              payButton.textContent = 'Continue to secure payment →';
            }
          }
        }
      });
      checkout.on('payment.failed', event => {
        if (!disposed) {
          const description = event?.error?.description || 'The payment failed or was declined.';
          showMessage(slot, description + ' You can try again or use another payment method.');
        }
      });
      checkout.open();
      status.textContent = '';
    } catch (error) {
      if (!disposed) showMessage(slot, error.message || 'Unable to start Razorpay checkout.');
    } finally {
      if (!disposed) {
        payButton.disabled = false;
        payButton.textContent = 'Continue to secure payment →';
      }
    }
  }

  payButton.addEventListener('click', startCheckout);
  return () => {
    disposed = true;
    root.replaceChildren();
  };
}
