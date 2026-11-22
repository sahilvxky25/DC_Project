/* Real email/password authentication through Firebase Auth. */
import { auth } from './firebase-client.js';
import { activateProgressForUser, deactivateProgressUser, flushProgressSync } from '../core/storage.js';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  getRedirectResult,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  updatePassword
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

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
const changePasswordBtn = document.getElementById('changePasswordBtn');
const editUsernameBtn = document.getElementById('editUsernameBtn');
const editUsernameDialog = document.getElementById('editUsernameDialog');
const editUsernameForm = document.getElementById('editUsernameForm');
const editUsernameInput = document.getElementById('editUsernameInput');
const usernameChangeMessage = document.getElementById('usernameChangeMessage');
const usernameChangeSubmit = document.getElementById('usernameChangeSubmit');
const cancelUsernameChange = document.getElementById('cancelUsernameChange');
const changePasswordDialog = document.getElementById('changePasswordDialog');
const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
const passwordChangeMessage = document.getElementById('passwordChangeMessage');
const passwordChangeSubmit = document.getElementById('passwordChangeSubmit');
const cancelPasswordChange = document.getElementById('cancelPasswordChange');
const signInTab = document.getElementById('signin-tab');
const signUpTab = document.getElementById('signup-tab');
const nameField = document.getElementById('name-field');
const nameInput = document.getElementById('login-name');
const intro = document.getElementById('login-intro');
const submitBtn = document.getElementById('login-submit');
const googleSignInBtn = document.getElementById('google-signin-btn');
const rememberMe = document.getElementById('remember-me');
const forgotPasswordLink = document.getElementById('forgot-password');
const verificationPanel = document.getElementById('verification-panel');
const verificationEmail = document.getElementById('verification-email');
const verificationContinue = document.getElementById('verification-continue');

const appAuthLoading = document.getElementById('app-auth-loading');
const appAuthLoadingTitle = document.getElementById('app-auth-loading-title');
const passwordAuthLoading = document.getElementById('password-auth-loading');

function showPasswordAuthLoading() {
  passwordAuthLoading.hidden = false;
  changePasswordDialog.setAttribute('aria-busy', 'true');
}

function hidePasswordAuthLoading() {
  passwordAuthLoading.hidden = true;
  changePasswordDialog.removeAttribute('aria-busy');
}

function showAppAuthLoading(message) {
  appAuthLoadingTitle.textContent = message;
  appAuthLoading.hidden = false;
  appScreen.setAttribute('aria-busy', 'true');
}

function hideAppAuthLoading() {
  appAuthLoading.hidden = true;
  appScreen.removeAttribute('aria-busy');
}

let authMode = 'signin';

const authLoading = document.getElementById('auth-loading');
const authLoadingTitle = document.getElementById('auth-loading-title');

function showAuthLoading(message = 'Signing in...') {
  authLoadingTitle.textContent = message;
  authLoading.hidden = false;
  loginScreen.setAttribute('aria-busy', 'true');
}

function hideAuthLoading() {
  authLoading.hidden = true;
  loginScreen.removeAttribute('aria-busy');
}

// Firebase restores a persisted session asynchronously after the page loads.
showAuthLoading('Checking your session...');

function setMessage(message, kind = 'error') {
  errorBox.textContent = message;
  errorBox.classList.toggle('is-success', kind === 'success');
}

function closeProfileMenu({ restoreFocus = false } = {}) {
  const wasOpen = !profileDropdown.hidden;
  profileDropdown.hidden = true;
  profileBtn.setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) profileBtn.focus();
}

function profileMenuItems() {
  return [...profileDropdown.querySelectorAll('.profile-menu-item:not([hidden]):not(:disabled)')];
}

function openProfileMenu({ focus = 'none' } = {}) {
  profileDropdown.hidden = false;
  profileBtn.setAttribute('aria-expanded', 'true');
  const items = profileMenuItems();
  if (focus === 'first') items[0]?.focus();
  if (focus === 'last') items.at(-1)?.focus();
}

function renderProfile(user) {
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'User';
  profileName.textContent = name;
  profileEmail.textContent = user.email || '';
  profileAvatar.textContent = name.charAt(0).toUpperCase();
  // Google-only accounts manage their password with Google, not BitSecure.
  changePasswordBtn.hidden = !user.providerData.some(provider => provider.providerId === 'password');
  profileBtn.setAttribute('aria-label', `User Profile: ${name}`);
}

function showApp(user = auth.currentUser) {
  hideAuthLoading();
  // Keep a durable signal in case the application module finishes loading after this module.
  window.__bitSecureAuthenticated = true;
  if (user) renderProfile(user);
  closeProfileMenu();
  loginScreen.hidden = true;
  appScreen.hidden = false;
  document.dispatchEvent(new CustomEvent('auth-success'));
}

function showLogin({ focus = false } = {}) {
  hideAppAuthLoading();
  window.__bitSecureAuthenticated = false;
  appScreen.hidden = true;
  loginScreen.hidden = false;
  passwordInput.value = '';
  if (focus) emailInput.focus();
}

function setMode(mode) {
  verificationPanel.hidden = true;
  document.querySelector('.auth-tabs').hidden = false;
  loginForm.hidden = false;
  authMode = mode;
  const signingUp = mode === 'signup';
  signInTab.classList.toggle('is-active', !signingUp);
  signUpTab.classList.toggle('is-active', signingUp);
  signInTab.setAttribute('aria-selected', String(!signingUp));
  signUpTab.setAttribute('aria-selected', String(signingUp));
  signInTab.tabIndex = signingUp ? -1 : 0;
  signUpTab.tabIndex = signingUp ? 0 : -1;
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
  googleSignInBtn.querySelector('span').textContent = signingUp ? 'Sign up with Google' : 'Continue with Google';
  setMessage('');
}

function showVerificationNotice(email) {
  verificationEmail.textContent = email;
  document.querySelector('.auth-tabs').hidden = true;
  loginForm.hidden = true;
  verificationPanel.hidden = false;
  document.getElementById('login-title').textContent = 'One last step!';
  intro.textContent = 'Your account is ready. Verify your email address to activate it.';
  setMessage('');
}

verificationContinue.addEventListener('click', () => {
  verificationPanel.hidden = true;
  document.querySelector('.auth-tabs').hidden = false;
  loginForm.hidden = false;
  setMode('signin');
  emailInput.value = verificationEmail.textContent;
  passwordInput.value = '';
  setMessage('Sign in after verifying your email. If you have not received the message, signing in will send a fresh verification email.');
});

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

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function friendlyGoogleError(error) {
  const messages = {
    'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign-in method. Sign in with that method first; do not create a second account.',
    'auth/credential-already-in-use': 'This Google account is already linked to another BitSecure account.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled. Enable the Google provider in Firebase Authentication settings.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow redirects/pop-ups and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a while and try again.'
  };
  return messages[error?.code] || friendlyError(error);
}

async function handleGoogleSignIn() {
  googleSignInBtn.disabled = true;
  setMessage('');
  showAuthLoading(authMode === 'signup' ? 'Creating your account with Google...' : 'Connecting to Google...');
  try {
    // Respect the same Remember me choice used by email/password sign-in.
    const persistence = rememberMe.checked ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    await signInWithRedirect(auth, googleProvider);
    // Firebase redirects away from this page; onAuthStateChanged restores the user on return.
  } catch (error) {
    hideAuthLoading();
    setMessage(friendlyGoogleError(error));
    googleSignInBtn.disabled = false;
  }
}

googleSignInBtn.addEventListener('click', handleGoogleSignIn);

// A successful redirect is completed by the existing auth-state listener below.
// This also surfaces provider/configuration errors when Google sends the user back.
getRedirectResult(auth).catch(error => {
  hideAuthLoading();
  setMessage(friendlyGoogleError(error));
  googleSignInBtn.disabled = false;
});

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

signInTab.addEventListener('click', () => setMode('signin'));
signUpTab.addEventListener('click', () => setMode('signup'));

document.querySelector('.auth-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const useSignUp = event.key === 'End'
    ? true
    : event.key === 'Home'
      ? false
      : event.target === signInTab;
  const nextTab = useSignUp ? signUpTab : signInTab;
  setMode(useSignUp ? 'signup' : 'signin');
  nextTab.focus();
});

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
  let keepAuthLoading = false;
  showAuthLoading(authMode === 'signup' ? 'Creating your account...' : 'Signing in...');
  try {
    if (authMode === 'signup') {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
      await signOut(auth);

      showVerificationNotice(email);
      return;
    }

    const persistence = rememberMe.checked
      ? browserLocalPersistence
      : browserSessionPersistence;
    await setPersistence(auth, persistence);

    keepAuthLoading = true;
    showAuthLoading('Verifying your account...');
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (!credential.user.emailVerified) {
      // A retry here gives users another verification email if the original was missed.
      await sendEmailVerification(credential.user);
      await signOut(auth);
      keepAuthLoading = false;
      setMessage('Your email is not verified yet. We sent a fresh verification email. Check your inbox and spam folder, verify your address, then sign in again.');
      return;
    }

    setMessage('');
    // onAuthStateChanged opens the app once Firebase confirms the verified session.
  } catch (error) {
    keepAuthLoading = false;
    // If signup created an unverified account but a later step failed, clear that temporary session.
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await signOut(auth).catch(() => {});
    }
    setMessage(friendlyError(error));
  } finally {
    submitBtn.disabled = false;
    if (!keepAuthLoading) hideAuthLoading();
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

function setPasswordVisibility(button, input, fieldLabel) {
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(reveal));
  button.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} ${fieldLabel}`);
  button.setAttribute('title', `${reveal ? 'Hide' : 'Show'} ${fieldLabel}`);
}

showPasswordBtn.addEventListener('click', () => {
  setPasswordVisibility(showPasswordBtn, passwordInput, 'password');
});

function resetPasswordVisibility() {
  document.querySelectorAll('.password-toggle-btn').forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    const targetId = button.dataset.passwordTarget || (button.id === 'show-password' ? 'login-password' : '');
    const input = targetId ? document.getElementById(targetId) : null;
    if (input) input.type = 'password';
    const fieldLabel = button.id === 'show-password'
      ? 'password'
      : targetId === 'currentPassword'
        ? 'current password'
        : targetId === 'newPassword'
          ? 'new password'
          : 'password confirmation';
    button.setAttribute('aria-label', `Show ${fieldLabel}`);
    button.setAttribute('title', `Show ${fieldLabel}`);
  });
}

profileBtn.addEventListener('click', () => {
  if (profileDropdown.hidden) openProfileMenu();
  else closeProfileMenu();
});

profileBtn.addEventListener('keydown', event => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  openProfileMenu({ focus: event.key === 'ArrowDown' ? 'first' : 'last' });
});

profileDropdown.addEventListener('keydown', event => {
  const items = profileMenuItems();
  const currentIndex = items.indexOf(document.activeElement);
  let nextIndex = null;
  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
  if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = items.length - 1;
  if (nextIndex !== null && items.length) {
    event.preventDefault();
    items[nextIndex].focus();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeProfileMenu({ restoreFocus: true });
  }
});

document.addEventListener('click', event => {
  if (!profileMenu.contains(event.target)) closeProfileMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !profileDropdown.hidden) closeProfileMenu({ restoreFocus: true });
});

// Toggle visibility independently for each password field in the change-password dialog.
document.querySelectorAll('.password-visibility-btn[data-password-target]').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input) return;

    const fieldLabel = input.id === 'currentPassword'
      ? 'current password'
      : input.id === 'newPassword'
        ? 'new password'
        : 'password confirmation';
    setPasswordVisibility(button, input, fieldLabel);
  });
});

editUsernameBtn.addEventListener('click', () => {
  const user = auth.currentUser;
  if (!user) return;

  closeProfileMenu();
  editUsernameForm.reset();
  editUsernameInput.value = user.displayName?.trim() || user.email?.split('@')[0] || '';
  usernameChangeMessage.textContent = '';
  usernameChangeMessage.classList.remove('is-success');
  editUsernameDialog.showModal();
  editUsernameInput.focus();
});

cancelUsernameChange.addEventListener('click', () => {
  editUsernameDialog.close();
  editUsernameForm.reset();
  usernameChangeMessage.textContent = '';
  usernameChangeMessage.classList.remove('is-success');
});

function setUsernameMessage(message, success = false) {
  usernameChangeMessage.textContent = message;
  usernameChangeMessage.classList.toggle('is-success', success);
}

changePasswordBtn.addEventListener('click', () => {
  if (changePasswordBtn.hidden) return;
  closeProfileMenu();
  changePasswordForm.reset();
  resetPasswordVisibility();
  passwordChangeMessage.textContent = '';
  passwordChangeMessage.classList.remove('is-success');
  changePasswordDialog.showModal();
  currentPasswordInput.focus();
});

cancelPasswordChange.addEventListener('click', () => {
  changePasswordDialog.close();
  changePasswordForm.reset();
  resetPasswordVisibility();
  passwordChangeMessage.textContent = '';
  passwordChangeMessage.classList.remove('is-success');
});

function setPasswordMessage(message, success = false) {
  passwordChangeMessage.textContent = message;
  passwordChangeMessage.classList.toggle('is-success', success);
}

changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmNewPasswordInput.value;

  if (newPassword.length < 8) {
    setPasswordMessage('The new password must contain at least 8 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    setPasswordMessage('The new password and confirmation do not match.');
    return;
  }
  if (currentPassword === newPassword) {
    setPasswordMessage('Choose a new password different from the current one.');
    return;
  }

  const user = auth.currentUser;
  if (!user || !user.email) {
    setPasswordMessage('Your session is unavailable. Please sign in again.');
    return;
  }

  passwordChangeSubmit.disabled = true;
  setPasswordMessage('');
  showPasswordAuthLoading();
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    changePasswordForm.reset();
    setPasswordMessage('Your password has been changed successfully.', true);
  } catch (error) {
    const messages = {
      'auth/invalid-credential': 'Your current password is incorrect.',
      'auth/wrong-password': 'Your current password is incorrect.',
      'auth/weak-password': 'Please choose a stronger password.',
      'auth/requires-recent-login': 'Please sign in again before changing your password.',
      'auth/network-request-failed': 'Network error. Check your connection and try again.'
    };
    setPasswordMessage(messages[error?.code] || 'Unable to change the password. Please try again.');
  } finally {
    passwordChangeSubmit.disabled = false;
    hidePasswordAuthLoading();
  }
});

editUsernameForm.addEventListener('submit', async event => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    setUsernameMessage('Your session is unavailable. Please sign in again.');
    return;
  }

  const newUsername = editUsernameInput.value.trim().replace(/\s+/gu, ' ');
  const usernameLength = Array.from(newUsername).length;
  if (usernameLength < 2 || usernameLength > 32) {
    setUsernameMessage('Enter a username between 2 and 32 characters.');
    editUsernameInput.focus();
    return;
  }

  if (newUsername === (user.displayName || '').trim()) {
    setUsernameMessage('That is already your current username.', true);
    return;
  }

  usernameChangeSubmit.disabled = true;
  editUsernameDialog.setAttribute('aria-busy', 'true');
  setUsernameMessage('Saving your username...');
  try {
    await updateProfile(user, { displayName: newUsername });
    renderProfile(user);

    // Keep the signed-in user's existing weekly leaderboard entry in sync as well.
    // A league-sync failure must not undo a successfully saved Firebase Auth profile.
    try {
      const { syncLeagueDisplayName } = await import('../game/league-service.js');
      await syncLeagueDisplayName(newUsername, user.uid);
    } catch (error) {
      console.warn('Username saved, but the weekly leaderboard name could not be refreshed:', error);
    }

    editUsernameInput.value = newUsername;
    setUsernameMessage('Your username has been updated successfully.', true);
  } catch (error) {
    const messages = {
      'auth/network-request-failed': 'Network error. Check your connection and try again.',
      'auth/user-token-expired': 'Your session has expired. Please sign in again.',
      'auth/invalid-user-token': 'Your session is no longer valid. Please sign in again.',
      'auth/user-not-found': 'Your account could not be found. Please sign in again.'
    };
    setUsernameMessage(messages[error?.code] || 'Unable to update your username. Please try again.');
  } finally {
    usernameChangeSubmit.disabled = false;
    editUsernameDialog.removeAttribute('aria-busy');
  }
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  closeProfileMenu();
  showAppAuthLoading('Signing you out...');
  try {
    // Flush this account's latest progress before the Firebase session is cleared.
    await flushProgressSync();
    await signOut(auth);
    setMessage('You have been signed out.', 'success');
    hideAppAuthLoading();
    showLogin({ focus: true });
  } catch (error) {
    hideAppAuthLoading();
    setMessage(friendlyError(error));
  } finally {
    logoutBtn.disabled = false;
  }
});

// Remove the old client-only demo flags so they cannot unlock the application.
sessionStorage.removeItem('bitsecure.demo-session');
localStorage.removeItem('bitsecure.demo-remembered');
localStorage.removeItem('bitsecure.demo-accounts');

onAuthStateChanged(auth, async user => {
  if (user?.emailVerified) {
    // Keep the loader visible while the account's cloud/local progress is restored.
    showAuthLoading('Restoring your learning progress...');
    try {
      await activateProgressForUser(user.uid);
    } catch (error) {
      // A progress-sync issue should not leave authentication stuck behind a spinner.
      console.warn('Unable to fully restore learning progress:', error);
    }

    // Auth events can overlap while a slow Firestore request is in flight. Do not display stale
    // progress if the user signed out or changed accounts before this restore finished.
    if (auth.currentUser?.uid !== user.uid || !auth.currentUser?.emailVerified) return;
    showApp(user);
    return;
  }

  // Clear the in-memory state on sign-out so it cannot be reused by the next account.
  deactivateProgressUser();
  hideAuthLoading();
  showLogin();
  // Unverified users remain on the login screen. Signup signs out after sending
  // the verification email; sign-in explicitly signs out any unverified account.
});
