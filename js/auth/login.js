/* Frontend-only demo login. This does NOT authenticate or protect private data. */
const loginScreen = document.getElementById('login-screen');
const appScreen = document.querySelector('.app');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const errorBox = document.getElementById('login-error');
const showPasswordBtn = document.getElementById('show-password');
const logoutBtn = document.getElementById('logoutBtn');

const SESSION_KEY = 'bitsecure.demo-session';
const REMEMBER_KEY = 'bitsecure.demo-remembered';

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
  emailInput.focus();
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  errorBox.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    errorBox.textContent = 'Enter both your email address and password.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorBox.textContent = 'Enter a valid email address.';
    emailInput.focus();
    return;
  }

  // Demo mode intentionally accepts any non-empty password; no password is stored.
  if (document.getElementById('remember-me').checked) {
    localStorage.setItem(REMEMBER_KEY, '1');
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.setItem(SESSION_KEY, '1');
  }
  showApp();
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
