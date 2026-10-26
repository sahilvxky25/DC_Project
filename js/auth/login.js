/* Real email/password authentication through Firebase Auth. */
import { auth } from './firebase-client.js';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

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
const forgotPasswordLink = document.getElementById('forgot-password');

let authMode = 'signin';

function setMessage(message, kind = 'error') {
  errorBox.textContent = message;
  errorBox.classList.toggle('is-success', kind === 'success');
}

function showApp() {
  // Keep a durable signal in case the application module finishes loading after this module.
  window.__bitSecureAuthenticated = true;
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
  passwordInput.placeholder = signingUp ? 'At least 8 characters' : 'Your password';
  forgotPasswordLink.hidden = signingUp;
  document.getElementById('login-title').textContent = signingUp ? 'Create your account.' : 'Welcome back.';
  intro.textContent = signingUp
    ? 'Create your BitSecure account to get started with the networking lab.'
    : 'Sign in to explore protocols, simulate networks, and follow a message end to end.';
  submitBtn.innerHTML = signingUp
    ? 'Create Account <span aria-hidden="true">→</span>'
    : 'Sign In <span aria-hidden="true">→</span>';
  setMessage('');
}

function friendlyError(error) {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists. Choose Sign In instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled. Contact the site administrator.',
    'auth/too-many-requests': 'Too many attempts. Please wait a while and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled. Enable it in Firebase Authentication settings.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase. Add it under Authentication settings → Authorized domains.',
    'auth/invalid-api-key': 'Firebase configuration is invalid. Check the web app configuration.'
  };
  return messages[error?.code] || 'Authentication failed. Please try again.';
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
  const name = nameInput.value.trim();

  if (!validEmail(email)) {
    setMessage('Enter a valid email address.');
    emailInput.focus();
    return;
  }
  if (!password || (authMode === 'signup' && !name)) {
    setMessage(authMode === 'signup'
      ? 'Enter your name and password.'
      : 'Enter your password.');
    return;
  }
  if (password.length < 8) {
    setMessage('Use a password with at least 8 characters.');
    passwordInput.focus();
    return;
  }

  submitBtn.disabled = true;
  try {
    if (authMode === 'signup') {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
      await signOut(auth);

      setMode('signin');
      emailInput.value = email;
      passwordInput.value = '';
      setMessage('Account created. Check your inbox and verify your email before signing in.', 'success');
      return;
    }

    const persistence = rememberMe.checked
      ? browserLocalPersistence
      : browserSessionPersistence;
    await setPersistence(auth, persistence);

    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (!credential.user.emailVerified) {
      await signOut(auth);
      setMessage('Please verify your email using the link we sent when you signed up, then sign in again.');
      return;
    }

    setMessage('');
    // onAuthStateChanged opens the app once Firebase confirms the verified session.
  } catch (error) {
    // If signup created an unverified account but a later step failed, clear that temporary session.
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await signOut(auth).catch(() => {});
    }
    setMessage(friendlyError(error));
  } finally {
    submitBtn.disabled = false;
  }
});

forgotPasswordLink.addEventListener('click', async event => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();

  if (!validEmail(email)) {
    setMessage('Enter your email address first, then select Forgot password.');
    emailInput.focus();
    return;
  }

  forgotPasswordLink.setAttribute('aria-disabled', 'true');
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage('If an account exists for this email, a password-reset message will be sent.', 'success');
  } catch (error) {
    if (error?.code === 'auth/unauthorized-domain' ||
        error?.code === 'auth/operation-not-allowed' ||
        error?.code === 'auth/invalid-api-key' ||
        error?.code === 'auth/network-request-failed') {
      setMessage(friendlyError(error));
    } else {
      // Do not reveal whether a particular email address has an account.
      setMessage('If an account exists for this email, a password-reset message will be sent.', 'success');
    }
  } finally {
    forgotPasswordLink.removeAttribute('aria-disabled');
  }
});

showPasswordBtn.addEventListener('click', () => {
  const reveal = passwordInput.type === 'password';
  passwordInput.type = reveal ? 'text' : 'password';
  showPasswordBtn.textContent = reveal ? 'Hide' : 'Show';
  showPasswordBtn.setAttribute('aria-pressed', String(reveal));
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    setMessage('You have been signed out.', 'success');
    showLogin({ focus: true });
  } catch (error) {
    setMessage(friendlyError(error));
  }
});

// Remove the old client-only demo flags so they cannot unlock the application.
sessionStorage.removeItem('bitsecure.demo-session');
localStorage.removeItem('bitsecure.demo-remembered');
localStorage.removeItem('bitsecure.demo-accounts');

onAuthStateChanged(auth, user => {
  if (user?.emailVerified) {
    showApp();
    return;
  }

  showLogin();
  // Unverified users remain on the login screen. Signup signs out after sending
  // the verification email; sign-in explicitly signs out any unverified account.
});
