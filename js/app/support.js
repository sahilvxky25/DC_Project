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

    <section class="support-giving-layout support-upi-layout" aria-label="Razorpay payment">
      <div class="support-payment-methods support-razorpay-only">
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

  return () => root.replaceChildren();
}
