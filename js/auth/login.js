/* Browser-only demo accounts. Not secure authentication; do not use real/reused passwords. */
const loginScreen = document.getElementById('login-screen');
const appScreen = document.querySelector('.app');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const errorBox = document.getElementById('login-error');
const showPasswordBtn = document.getElementById('show-password');
const logoutBtn = document.getElementById('logoutBtn');
const signInTab = document.getElementById('signin-tab');
const signUpTab = document.getElementById('signup-tab');
const nameField = document.getElementById('name-field');
const nameInput = document.getElementById('login-name');
const intro = document.getElementById('login-intro');
const submitBtn = document.getElementById('login-submit');
const rememberMe = document.getElementById('remember-me');

const SESSION_KEY = 'bitsecure.demo-session';
const REMEMBER_KEY = 'bitsecure.demo-remembered';
const ACCOUNTS_KEY = 'bitsecure.demo-accounts';
let authMode = 'signin';

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
    return accounts && typeof accounts === 'object' && !Array.isArray(accounts) ? accounts : {};
  } catch {
    return {};
  }
}

async function passwordDigest(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure browser hashing is unavailable. Open this app using HTTPS or localhost.');
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function hasDemoSession() {
  return sessionStorage.getItem(SESSION_KEY) === '1' ||
    localStorage.getItem(REMEMBER_KEY) === '1';
}

function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  document.dispatchEvent(new CustomEvent('demo-login-success'));
}

function showLogin() {
  appScreen.hidden = true;
  loginScreen.hidden = false;
  errorBox.textContent = '';
  passwordInput.value = '';
  loginScreen.querySelector('#login-email').focus();
}

function setMode(mode) {
  authMode = mode;
  const signingUp = mode === 'signup';
  signInTab.classList.toggle('is-active', !signingUp);
  signUpTab.classList.toggle('is-active', signingUp);
  signInTab.setAttribute('aria-selected', String(!signingUp));
  signUpTab.setAttribute('aria-selected', String(signingUp));
  nameField.hidden = !signingUp;
  nameInput.required = signingUp;
  passwordInput.autocomplete = signingUp ? 'new-password' : 'current-password';
  passwordInput.placeholder = signingUp ? 'At least 8 characters' : 'Enter your password';
  document.getElementById('login-title').textContent = signingUp ? 'Create your account.' : 'Welcome back.';
  intro.textContent = signingUp
    ? 'Create a demo account to get started with the networking lab.'
    : 'Sign in to explore protocols, simulate networks, and follow a message end to end.';
  submitBtn.innerHTML = signingUp ? 'Create Account <span aria-hidden="true">→</span>' : 'Sign In <span aria-hidden="true">→</span>';
  errorBox.textContent = '';
}

signInTab.addEventListener('click', () => setMode('signin'));
signUpTab.addEventListener('click', () => setMode('signup'));

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.textContent = '';

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  if (!email || !password || (authMode === 'signup' && !name)) {
    errorBox.textContent = authMode === 'signup'
      ? 'Enter your name, email address, and password.'
      : 'Enter both your email address and password.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorBox.textContent = 'Enter a valid email address.';
    emailInput.focus();
    return;
  }
  if (password.length < 8) {
    errorBox.textContent = 'Use a password with at least 8 characters.';
    passwordInput.focus();
    return;
  }

  submitBtn.disabled = true;
  try {
    const accounts = readAccounts();
    if (authMode === 'signup') {
      if (accounts[email]) {
        errorBox.textContent = 'An account with this email already exists. Please sign in.';
        setMode('signin');
        emailInput.value = email;
        return;
      }
      accounts[email] = { name, passwordHash: await passwordDigest(password) };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      setMode('signin');
      emailInput.value = email;
      passwordInput.value = '';
      errorBox.textContent = 'Demo account created. Sign in with your new credentials.';
      return;
    }

    const account = accounts[email];
    if (!account || account.passwordHash !== await passwordDigest(password)) {
      errorBox.textContent = 'Email or password is incorrect. If you are new, choose Sign Up.';
      return;
    }

    if (rememberMe.checked) {
      localStorage.setItem(REMEMBER_KEY, '1');
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.setItem(SESSION_KEY, '1');
    }
    showApp();
  } catch (error) {
    errorBox.textContent = error.message || 'Unable to process this request in the browser.';
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

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  showLogin();
});

if (hasDemoSession()) {
  showApp();
} else {
  showLogin();
}
