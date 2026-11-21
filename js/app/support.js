const AMOUNTS = [49, 99, 199];
const UPI_ID = '8598032563@slc';
const PAYEE_NAME = 'Mr Sahil Kumar Patra';

function showMessage(target, message, kind = 'error') {
  target.className = kind === 'success' ? 'support-payment-status support-payment-success' : 'support-payment-status support-payment-error';
  target.textContent = message;
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

    <section class="support-giving-layout support-upi-layout" aria-labelledby="support-giving-title">
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
        <p class="support-amount-help">Minimum contribution is ₹1. Choose a suggested amount or enter a custom whole-rupee amount. You can also scan the QR code and enter an amount in your UPI app.</p>
        <div class="support-trust-points">
          <div><span aria-hidden="true">✓</span><span>One-time, voluntary support</span></div>
          <div><span aria-hidden="true">✓</span><span>Pay directly using UPI</span></div>
          <div><span aria-hidden="true">✓</span><span>No BitSecure account required to contribute</span></div>
        </div>
      </div>

      <aside class="support-payment-card support-upi-card" aria-labelledby="support-payment-title">
        <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">↗</span><span class="support-payment-provider">DIRECT UPI PAYMENT</span></div>
        <h3 id="support-payment-title">Support BitSecure</h3>
        <p>Scan this QR code with any UPI app to make a one-time contribution.</p>
        <div class="support-upi-qr-wrap">
          <img class="support-upi-qr" src="assets/sahil-upi-qr.svg" alt="UPI QR code for 8598032563@slc" width="240" height="240">
        </div>
        <div class="support-upi-payee">
          <span class="support-upi-caption">PAY TO</span>
          <strong>${PAYEE_NAME}</strong>
          <span class="support-upi-id" id="support-upi-id">${UPI_ID}</span>
        </div>
        <div class="support-upi-actions">
          <button class="btn support-copy-upi" id="support-copy-upi" type="button">Copy UPI ID</button>
          <a class="btn support-upi-open" id="support-upi-open" href="upi://pay?pa=8598032563%40slc&amp;pn=Mr%20Sahil%20Kumar%20Patra&amp;cu=INR&amp;am=99&amp;tn=BitSecure%20project%20support">Open UPI app <span aria-hidden="true">↗</span></a>
        </div>
        <p class="support-payment-status" id="support-upi-status" role="status" aria-live="polite"></p>
        <div class="support-coming-soon">
          <span class="coming-soon-pill">COMING SOON</span>
          <p>Card payments and other payment options will be available soon. For now, you can contribute using UPI.</p>
        </div>
      </aside>
    </section>

    <section class="support-thanks-panel"><div><span class="info-kicker">THANK YOU</span><h2>Support is more than a payment.</h2><p>Sharing BitSecure with a classmate, reporting an issue, suggesting a feature, or contributing code also helps the project move forward.</p></div><a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a></section>
    <p class="support-disclaimer">Contributions are voluntary project support, not a purchase, investment, or promise of a particular feature. Do not assume they are tax-deductible. UPI payments are made directly to the UPI ID shown above; BitSecure does not automatically receive payment confirmation.</p>
  `;

  const customInput = root.querySelector('#support-custom-amount');
  const customLabel = root.querySelector('.support-custom-label');
  const status = root.querySelector('#support-upi-status');
  const upiLink = root.querySelector('#support-upi-open');
  const copyButton = root.querySelector('#support-copy-upi');
  let selectedAmount = 99;

  function updateUpiLink() {
    const rupees = selectedAmount === 'custom' ? Number(customInput.value) : selectedAmount;
    const valid = Number.isSafeInteger(rupees) && rupees >= 1 && rupees <= 100000;
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: PAYEE_NAME,
      cu: 'INR',
      tn: 'BitSecure project support'
    });
    if (valid) params.set('am', String(rupees));
    upiLink.href = `upi://pay?${params.toString()}`;
    upiLink.setAttribute('aria-disabled', String(!valid));
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
      status.textContent = '';
      updateUpiLink();
    });
  });

  customInput.addEventListener('input', () => {
    status.textContent = '';
    updateUpiLink();
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      showMessage(status, 'UPI ID copied. Open your UPI app and enter the contribution amount.', 'success');
    } catch {
      showMessage(status, `Copy is unavailable in this browser. UPI ID: ${UPI_ID}`);
    }
  });

  upiLink.addEventListener('click', event => {
    if (!updateUpiLink()) {
      event.preventDefault();
      showMessage(status, 'Enter a whole-rupee amount between ₹1 and ₹1,00,000.');
      return;
    }
    status.textContent = 'Opening your UPI app. If nothing happens, scan the QR code or copy the UPI ID.';
  });

  updateUpiLink();
  return () => root.replaceChildren();
}
