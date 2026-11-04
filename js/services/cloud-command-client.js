import { auth } from '../auth/firebase-client.js';

const API_BASE_URL = (window.BITSECURE_COMMAND_API_URL || '').replace(/\/$/, '');

export async function runCloudCommand(command) {
  if (!API_BASE_URL) {
    throw new Error('Cloud command service is not configured yet. Set window.BITSECURE_COMMAND_API_URL to your deployed backend URL.');
  }
  if (!auth.currentUser) {
    throw new Error('Sign in before using live network diagnostics.');
  }

  const token = await auth.currentUser.getIdToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/commands/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ command }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Command service returned HTTP ${response.status}.`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
