/**
 * Sign in / sign up against the BitSecure FastAPI backend, then open the app.
 *
 * Replaces the old Firebase version. The contract with the rest of the app is unchanged:
 *   - showApp() sets window.__bitSecureAuthenticated and fires document "auth-success",
 *     which js/app.js listens for to boot the interface;
 *   - progress is activated for the account before the app is shown (core/storage.js).
 *
 * Only an email and a password are collected. There is no password reset or email verification.
 */
import { ApiError, clearToken, fetchMe, getToken, login, register, setToken } from './api.js';
import { activateProgressForUser, deactivateProgressUser, flushProgressSync } from '../core/storage.js';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.querySelector('.app');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const errorBox = document.getElementById('login-error');
const showPasswordBtn = document.getElementById('show-password');
const logoutBtn = document.getElementById('logoutBtn');
const profileMenu = document.getElementById('profileMenu');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileAvatar = document.getElementById('profileAvatar');
const signInTab = document.getElementById('signin-tab');
const signUpTab = document.getElementById('signup-tab');
const intro = document.getElementById('login-intro');
const submitBtn = document.getElementById('login-submit');
const rememberMe = document.getElementById('remember-me');

const SIGNED_OUT_FLAG = 'bitsecure.signed-out';

let authMode = 'signin';

function setMessage(message, kind = 'error') {
  errorBox.textContent = message;
  errorBox.classList.toggle('is-success', kind === 'success');
}

function closeProfileMenu() {
  profileDropdown.hidden = true;
  profileBtn.setAttribute('aria-expanded', 'false');
}

function renderProfile(user) {
  const name = user.email?.split('@')[0] || 'User';
  profileName.textContent = name;
  profileEmail.textContent = user.email || '';
  profileAvatar.textContent = name.charAt(0).toUpperCase();
  profileBtn.setAttribute('aria-label', `User Profile: ${name}`);
}

function showApp(user) {
  // Keep a durable signal in case app.js finishes loading after this module.
  window.__bitSecureAuthenticated = true;
  renderProfile(user);
  closeProfileMenu();
  loginScreen.hidden = true;
  appScreen.hidden = false;
  document.dispatchEvent(new CustomEvent('auth-success'));
}

function showLogin({ focus = false } = {}) {
  window.__bitSecureAuthenticated = false;
  appScreen.hidden = true;
  loginScreen.hidden = false;
  passwordInput.value = '';
  if (focus) emailInput.focus();
}

/** Load this account's saved progress, then reveal the app. */
async function openAppFor(user) {
  await activateProgressForUser(user.id);
  showApp(user);
}

function setMode(mode) {
  authMode = mode;
  const signingUp = mode === 'signup';
  signInTab.classList.toggle('is-active', !signingUp);
  signUpTab.classList.toggle('is-active', signingUp);
  signInTab.setAttribute('aria-selected', String(!signingUp));
  signUpTab.setAttribute('aria-selected', String(signingUp));
  passwordInput.autocomplete = signingUp ? 'new-password' : 'current-password';
  passwordInput.placeholder = signingUp ? 'At least 8 characters' : 'Your password';
  document.getElementById('login-title').textContent = signingUp ? 'Create your account.' : 'Welcome back.';
  intro.textContent = signingUp
    ? 'Create your BitSecure account with an email and a password to get started.'
    : 'Sign in to explore protocols, simulate networks, and follow a message end to end.';
  submitBtn.innerHTML = signingUp
    ? 'Create Account <span aria-hidden="true">→</span>'
    : 'Sign In <span aria-hidden="true">→</span>';
  setMessage('');
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

signInTab.addEventListener('click', () => setMode('signin'));
signUpTab.addEventListener('click', () => setMode('signup'));

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('');

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const remember = rememberMe.checked;

  if (!validEmail(email)) {
    setMessage('Enter a valid email address.');
    emailInput.focus();
    return;
  }
  if (!password) {
    setMessage('Enter your password.');
    passwordInput.focus();
    return;
  }
  if (authMode === 'signup' && password.length < 8) {
    setMessage('Use a password with at least 8 characters.');
    passwordInput.focus();
    return;
  }

  submitBtn.disabled = true;
  try {
    const data = authMode === 'signup'
      ? await register(email, password, remember)
      : await login(email, password, remember);
    setToken(data.access_token, remember);
    await openAppFor(data.user);
  } catch (error) {
    clearToken();
    setMessage(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
  }
});

showPasswordBtn.addEventListener('click', () => {
  const reveal = passwordInput.type === 'password';
  passwordInput.type = reveal ? 'text' : 'password';
  showPasswordBtn.textContent = reveal ? 'Hide' : 'Show';
  showPasswordBtn.setAttribute('aria-pressed', String(reveal));
});

profileBtn.addEventListener('click', () => {
  const shouldOpen = profileDropdown.hidden;
  profileDropdown.hidden = !shouldOpen;
  profileBtn.setAttribute('aria-expanded', String(shouldOpen));
});

document.addEventListener('click', event => {
  if (!profileMenu.contains(event.target)) closeProfileMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeProfileMenu();
});

logoutBtn.addEventListener('click', async () => {
  // Save this account's latest progress, forget the session, then reload so the next person to
  // sign in starts from a clean interface rather than the previous user's rendered screens.
  await flushProgressSync();
  deactivateProgressUser();
  clearToken();
  try { sessionStorage.setItem(SIGNED_OUT_FLAG, '1'); } catch (error) { /* storage blocked */ }
  location.hash = '';
  location.reload();
});

/* ---- Start-up: show the login screen, or restore a stored session ---- */
(async function start() {
  showLogin();

  let signedOut = false;
  try {
    signedOut = sessionStorage.getItem(SIGNED_OUT_FLAG) === '1';
    sessionStorage.removeItem(SIGNED_OUT_FLAG);
  } catch (error) { /* storage blocked */ }
  if (signedOut) setMessage('You have been signed out.', 'success');

  if (!getToken()) return;
  try {
    await openAppFor(await fetchMe());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearToken(); // expired or invalid token: sign in again
    } else if (error instanceof ApiError) {
      setMessage(error.message); // e.g. the backend is not running
    }
  }
})();
