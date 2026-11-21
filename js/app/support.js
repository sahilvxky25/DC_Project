import { RAZORPAY_PAYMENT_BUTTON_ID } from './support-config.js';

const RAZORPAY_BUTTON_ID_PATTERN = /^pl_[A-Za-z0-9]+$/;

/**
 * Render the Support Us page. Razorpay hosts the payment UI; BitSecure does not
 * collect or store payment credentials. Returns a cleanup function for routing.
 */
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
        <article class="support-impact-card">
          <span class="support-impact-icon" aria-hidden="true">⌁</span>
          <h3>Hosting &amp; infrastructure</h3>
          <p>Help cover the services and resources needed to keep BitSecure available.</p>
        </article>
        <article class="support-impact-card">
          <span class="support-impact-icon" aria-hidden="true">▦</span>
          <h3>New simulations</h3>
          <p>Make room to design and build interactive tools for more technical subjects.</p>
        </article>
        <article class="support-impact-card">
          <span class="support-impact-icon" aria-hidden="true">✧</span>
          <h3>Better learning experiences</h3>
          <p>Improve explanations, accessibility, animations, and existing learning modules.</p>
        </article>
      </div>
    </section>

    <section class="support-giving-layout" aria-labelledby="support-giving-title">
      <div class="support-giving-copy">
        <span class="info-kicker">ONE-TIME PROJECT SUPPORT</span>
        <h2 id="support-giving-title">Choose an amount that feels right.</h2>
        <p>There is no subscription or expectation to contribute. Even a small one-time contribution can help us keep improving the project.</p>
        <div class="support-amount-label">Suggested contribution amounts</div>
        <div class="support-amount-chips" aria-label="Suggested contribution amounts">
          <span>₹49</span><span>₹99</span><span>₹199</span><span>Custom amount</span>
        </div>
        <p class="support-amount-help">These are suggestions only. The available amount options are configured in the secure Razorpay checkout.</p>
        <div class="support-trust-points">
          <div><span aria-hidden="true">✓</span><span>One-time, voluntary support</span></div>
          <div><span aria-hidden="true">✓</span><span>Payment details handled by Razorpay</span></div>
          <div><span aria-hidden="true">✓</span><span>No BitSecure account required to contribute</span></div>
        </div>
      </div>

      <aside class="support-payment-card" aria-labelledby="support-payment-title">
        <div class="support-payment-card-top">
          <span class="support-payment-lock" aria-hidden="true">⌑</span>
          <span class="support-payment-provider">SECURE CHECKOUT · RAZORPAY</span>
        </div>
        <h3 id="support-payment-title">Support BitSecure</h3>
        <p>Continue to Razorpay to choose your contribution amount and complete payment using the methods available for your checkout.</p>
        <div class="support-payment-slot" id="support-payment-slot" aria-live="polite">
          <div class="support-payment-unavailable" role="status">
            <strong>Online contributions are being set up.</strong>
            <span>Please check back soon. No payment will be collected from this page yet.</span>
          </div>
        </div>
        <p class="support-payment-footnote">Your payment is processed on Razorpay's hosted checkout. BitSecure does not ask for or store your card details, UPI PIN, or banking password.</p>
      </aside>
    </section>

    <section class="support-thanks-panel">
      <div>
        <span class="info-kicker">THANK YOU</span>
        <h2>Support is more than a payment.</h2>
        <p>Sharing BitSecure with a classmate, reporting an issue, suggesting a feature, or contributing code also helps the project move forward.</p>
      </div>
      <a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a>
    </section>

    <p class="support-disclaimer">Contributions are voluntary project support, not a purchase, investment, or promise of a particular feature. Do not assume they are tax-deductible.</p>
  `;

  const slot = root.querySelector('#support-payment-slot');
  const buttonId = String(RAZORPAY_PAYMENT_BUTTON_ID || '').trim();
  let paymentScript = null;

  if (RAZORPAY_BUTTON_ID_PATTERN.test(buttonId)) {
    const form = document.createElement('form');
    form.className = 'support-razorpay-form';
    form.setAttribute('aria-label', 'Razorpay secure contribution checkout');

    paymentScript = document.createElement('script');
    paymentScript.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    paymentScript.setAttribute('data-payment_button_id', buttonId);
    paymentScript.addEventListener('error', () => {
      slot.innerHTML = `
        <div class="support-payment-error" role="alert">
          <strong>Checkout could not be loaded.</strong>
          <span>Please refresh the page or try again later.</span>
        </div>
      `;
    }, { once: true });

    form.append(paymentScript);
    slot.replaceChildren(form);
  }

  return () => {
    if (paymentScript) paymentScript.remove();
    root.replaceChildren();
  };
}
