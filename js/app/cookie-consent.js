/**
 * Site-wide cookie and browser-storage consent controls.
 * Essential application storage is always available; optional analytics consent is
 * recorded separately so future analytics integrations can be gated on this choice.
 */
const CONSENT_KEY = 'bitsecure.cookieConsent.v1';
const CONSENT_VERSION = 1;

function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (!saved || saved.version !== CONSENT_VERSION || typeof saved.analytics !== 'boolean') return null;
    return saved;
  } catch {
    return null;
  }
}

function storeConsent(analytics) {
  const record = {
    version: CONSENT_VERSION,
    essential: true,
    analytics: Boolean(analytics),
    decidedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // Keep the controls usable if browser storage is disabled; the banner will reappear later.
  }
  return record;
}

/** Returns the saved decision for an optional category (currently only analytics). */
export function hasOptionalConsent(category) {
  const consent = readConsent();
  return category === 'analytics' && Boolean(consent?.analytics);
}

export function initCookieConsent() {
  const banner = document.getElementById('cookieBanner');
  const dialog = document.getElementById('cookiePreferencesDialog');
  if (!banner || !dialog) return;

  const analyticsToggle = document.getElementById('cookieAnalytics');
  const status = document.getElementById('cookieConsentStatus');
  const showBanner = () => { banner.hidden = false; };
  const hideBanner = () => { banner.hidden = true; };
  const openPreferences = () => {
    const consent = readConsent();
    analyticsToggle.checked = Boolean(consent?.analytics);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const closePreferences = () => {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  };
  const announce = message => {
    if (status) status.textContent = message;
  };
  const saveChoice = analytics => {
    storeConsent(analytics);
    hideBanner();
    closePreferences();
    announce(analytics ? 'Cookie preferences saved. Optional analytics preference is enabled.' : 'Cookie preferences saved. Optional analytics are disabled.');
  };

  const existing = readConsent();
  if (!existing) showBanner();
  else hideBanner();

  document.getElementById('cookieAcceptAll')?.addEventListener('click', () => saveChoice(true));
  document.getElementById('cookieRejectOptional')?.addEventListener('click', () => saveChoice(false));
  document.getElementById('cookieCustomize')?.addEventListener('click', openPreferences);
  document.getElementById('cookieLearnMore')?.addEventListener('click', openPreferences);
  document.getElementById('cookieSettingsFooter')?.addEventListener('click', openPreferences);
  document.getElementById('cookieDialogReject')?.addEventListener('click', () => saveChoice(false));
  document.getElementById('cookieSavePreferences')?.addEventListener('click', () => saveChoice(analyticsToggle.checked));

  dialog.addEventListener('click', event => {
    if (event.target === dialog) closePreferences();
  });
  dialog.addEventListener('close', () => {
    if (!readConsent()) showBanner();
  });
}
