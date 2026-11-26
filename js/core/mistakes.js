import { P, save } from './storage.js';
import { DC } from './state.js';

const MAX_MISTAKES = 200;
const records = () => Array.isArray(P.notes.mistakes) ? P.notes.mistakes : [];

export function addMistake(entry) {
  if (!entry || !entry.question || !entry.correctAnswer) return;
  const list = records();
  const key = String(entry.moduleId || 'daily') + '::' + entry.question;
  const existing = list.find(item => item.key === key);
  const now = Date.now();
  const moduleTitle = entry.moduleTitle || DC.mods.find(m => m.id === entry.moduleId)?.title || 'Daily challenge';
  if (existing) {
    existing.selectedAnswer = String(entry.selectedAnswer);
    existing.correctAnswer = String(entry.correctAnswer);
    existing.options = Array.isArray(entry.options) ? entry.options.map(String) : existing.options;
    existing.attempts = (Number(existing.attempts) || 1) + 1;
    existing.lastSeen = now;
    existing.reviewed = false;
  } else {
    list.unshift({
      id: 'mistake_' + now + '_' + Math.random().toString(36).slice(2, 8),
      key,
      moduleId: entry.moduleId || 'daily',
      moduleTitle,
      question: String(entry.question),
      selectedAnswer: String(entry.selectedAnswer),
      correctAnswer: String(entry.correctAnswer),
      options: Array.isArray(entry.options) ? entry.options.map(String) : [],
      attempts: 1,
      firstSeen: now,
      lastSeen: now,
      reviewed: false
    });
  }
  P.notes.mistakes = list.slice(0, MAX_MISTAKES);
  save();
}
