const UPI_ID = '8598032563@slc';
const PAYEE_NAME = 'Mr Sahil Kumar Patra';

function showMessage(target, message, kind = 'error') {
  target.className = 'support-payment-status ' + (kind === 'success' ? 'support-payment-success' : 'support-payment-error');
  target.textContent = message;
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
      <div class="support-payment-methods">
        <aside class="support-payment-card support-upi-card" aria-labelledby="support-upi-title">
          <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">↗</span><span class="support-payment-provider">DIRECT UPI PAYMENT</span></div>
          <h3 id="support-upi-title">Pay using UPI QR</h3>
          <p>Scan this QR code with any UPI app. Enter the amount you wish to contribute in your UPI app. Direct UPI payments are not automatically verified by BitSecure.</p>
          <div class="support-upi-qr-wrap"><img class="support-upi-qr" src="assets/sahil-upi-qr.svg" alt="UPI QR code for 8598032563@slc" width="240" height="240"></div>
          <div class="support-upi-payee"><span class="support-upi-caption">PAY TO</span><strong>${PAYEE_NAME}</strong><span class="support-upi-id">${UPI_ID}</span></div>
          <div class="support-upi-actions">
            <button class="btn support-copy-upi" id="support-copy-upi" type="button">Copy UPI ID</button>
            <a class="btn support-upi-open" id="support-upi-open" href="upi://pay?pa=8598032563%40slc&amp;pn=Mr%20Sahil%20Kumar%20Patra&amp;cu=INR&amp;tn=BitSecure%20project%20support">Open UPI app ↗</a>
          </div>
          <p class="support-payment-status" id="support-upi-status" role="status" aria-live="polite"></p>
        </aside>

        <aside class="support-payment-card support-online-card" aria-labelledby="support-online-title">
          <div class="support-payment-card-top"><span class="support-payment-lock" aria-hidden="true">⌑</span><span class="support-payment-provider">SECURE ONLINE CHECKOUT</span></div>
          <h3 id="support-online-title">Pay securely with Razorpay</h3>
          <p>Choose from payment methods enabled for the merchant account, such as UPI, cards or net banking.</p>
          <a class="btn support-checkout-button" id="support-checkout" href="https://razorpay.me/@bitsecure" target="_blank" rel="noopener noreferrer">Continue to secure payment <span aria-hidden="true">↗</span></a>
          <p class="support-payment-footnote">You will be redirected to BitSecure’s Razorpay payment page to enter or confirm your contribution amount and complete payment. BitSecure never asks for your UPI PIN, card number or banking password.</p>
        </aside>
      </div>
    </section>

    <section class="support-thanks-panel"><div><span class="info-kicker">THANK YOU</span><h2>Support is more than a payment.</h2><p>Sharing BitSecure with a classmate, reporting an issue, suggesting a feature, or contributing code also helps the project move forward.</p></div><a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a></section>
    <p class="support-disclaimer">Contributions are voluntary project support, not a purchase, investment, or promise of a particular feature. Do not assume they are tax-deductible. Direct UPI payments are not automatically verified by BitSecure. Razorpay payments are completed on Razorpay’s hosted payment page.</p>
  `;

  const upiStatus = root.querySelector('#support-upi-status');

  root.querySelector('#support-copy-upi').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      showMessage(upiStatus, 'UPI ID copied. Open your UPI app and enter the contribution amount.', 'success');
    } catch {
      showMessage(upiStatus, 'Copy is unavailable in this browser. UPI ID: ' + UPI_ID);
    }
  });

  root.querySelector('#support-upi-open').addEventListener('click', () => {
    upiStatus.textContent = '';
    showMessage(upiStatus, 'Opening your UPI app. Enter the amount you wish to contribute.', 'success');
  });

  return () => root.replaceChildren();
}
