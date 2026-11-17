import { auth } from '../auth/firebase-client.js';
import { getIdToken } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import '../config.js';

const launcher = document.querySelector('#chatbotLauncher');
const panel = document.querySelector('#chatbotPanel');
const closeButton = document.querySelector('#chatbotClose');
const messages = document.querySelector('#chatbotMessages');
const form = document.querySelector('#chatbotForm');
const input = document.querySelector('#chatbotInput');
const sendButton = document.querySelector('#chatbotSend');
const status = document.querySelector('#chatbotStatus');

const MAX_HISTORY = 8;
const MAX_HISTORY_MESSAGE_CHARS = 6500;
let history = [];
let busy = false;

function addMessage(role, content) {
  if (!messages) return;
  const item = document.createElement('div');
  item.className = 'chatbot-message ' + role;
  item.textContent = content;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
}

function setStatus(message) {
  if (status) status.textContent = message;
}

function setOpen(open) {
  if (!panel || !launcher) return;
  panel.hidden = !open;
  launcher.setAttribute('aria-expanded', String(open));
  launcher.setAttribute('aria-label', open ? 'Close BitSecure assistant' : 'Open BitSecure assistant');
  if (open) input?.focus();
}

if (launcher && panel && closeButton && messages && form && input && sendButton) {
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;

    if (!window.BITSECURE_API_URL) {
      addMessage('assistant', 'The AI service is not connected yet. Configure the FastAPI backend URL in js/config.js before using the assistant.');
      return;
    }

    busy = true;
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;
    setStatus('Thinking…');
    addMessage('user', message);

    const pending = document.createElement('div');
    pending.className = 'chatbot-message assistant pending';
    pending.textContent = 'Thinking…';
    messages.append(pending);
    messages.scrollTop = messages.scrollHeight;

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please sign in again to use your personalized BitSecure assistant.');
      }

      const token = await getIdToken(user);
      const apiBase = window.BITSECURE_API_URL.replace(/\/+$/, '');
      const response = await fetch(apiBase + '/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          message,
          history: history.slice(-MAX_HISTORY).map(item => ({
            role: item.role,
            content: String(item.content).slice(-MAX_HISTORY_MESSAGE_CHARS)
          }))
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'The assistant could not answer right now.');
      }

      const answer = data.answer || 'I could not generate an answer. Please try again.';
      pending.remove();
      addMessage('assistant', answer);
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: answer }
      );
      history = history.slice(-MAX_HISTORY);
      setStatus(data.progressContextLoaded ? 'Your BitSecure progress was loaded for this reply.' : '');
    } catch (error) {
      pending.remove();
      addMessage('assistant', error.message || 'Something went wrong. Please try again.');
      setStatus('The request could not be completed.');
    } finally {
      busy = false;
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
}
