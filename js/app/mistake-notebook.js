import { P, save } from '../core/storage.js';
import { $, esc } from '../core/utils.js';
import { DC } from '../core/state.js';
import { runQuiz } from '../game/flow.js';
import { addMistake } from '../core/mistakes.js';

const records = () => Array.isArray(P.notes.mistakes) ? P.notes.mistakes : [];
const sourceTitle = id => DC.mods.find(m => m.id === id)?.title || (id === 'daily' ? 'Daily challenge' : 'Quiz');

const formatDate = value => {
  const date = new Date(Number(value) || Date.now());
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export function renderMistakeNotebook(root) {
  let filter = 'all';
  const render = () => {
    const all = records().slice().sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    const pending = all.filter(item => !item.reviewed).length;
    const shown = all.filter(item => filter === 'all' || (filter === 'pending' ? !item.reviewed : item.reviewed));
    root.innerHTML = '<div class="mistake-page">' +
      '<a class="mn-back" href="#/">← Back to dashboard</a>' +
      '<header class="mn-hero"><span class="mn-kicker">LEARN FROM EVERY ATTEMPT</span><h1>Mistake Notebook</h1><p>Questions you answered incorrectly are saved here automatically, so you can revisit the concepts that need another look.</p>' +
      '<div class="mn-stats"><span><b>' + all.length + '</b> saved</span><span><b>' + pending + '</b> to review</span><span><b>' + all.filter(x => x.reviewed).length + '</b> reviewed</span></div></header>' +
      '<div class="mn-toolbar"><div class="mn-filters" role="group" aria-label="Filter mistakes">' +
      '<button type="button" data-filter="all" class="' + (filter === 'all' ? 'active' : '') + '">All (' + all.length + ')</button>' +
      '<button type="button" data-filter="pending" class="' + (filter === 'pending' ? 'active' : '') + '">To review (' + pending + ')</button>' +
      '<button type="button" data-filter="reviewed" class="' + (filter === 'reviewed' ? 'active' : '') + '">Reviewed (' + (all.length - pending) + ')</button></div>' +
      (all.length ? '<div class="mn-toolbar-actions">' + (!pending ? '' : '<button type="button" class="btn sm mn-practice-start">Practice to review (' + pending + ')</button>') + '<button type="button" class="btn ghost sm mn-clear">Clear notebook</button></div>' : '') + '</div>' +
      (shown.length ? '<section class="mn-list" aria-label="Saved incorrect answers">' + shown.map(item =>
        '<article class="mn-card" data-id="' + esc(item.id) + '">' +
        '<div class="mn-card-meta"><span>' + esc(item.moduleTitle || sourceTitle(item.moduleId)) + '</span><span>' + formatDate(item.lastSeen) + '</span></div>' +
        '<h2>' + esc(item.question) + '</h2>' +
        '<div class="mn-answer mn-wrong"><b>Your answer</b><span>' + esc(item.selectedAnswer) + '</span></div>' +
        '<div class="mn-answer mn-correct"><b>Correct answer</b><span>' + esc(item.correctAnswer) + '</span></div>' +
        '<div class="mn-card-foot"><small>Attempted ' + (Number(item.attempts) || 1) + ' time(s)' + (item.reviewed ? ' · Reviewed' : '') + '</small>' +
        '<div class="mn-actions">' +
        '<button type="button" class="btn ghost sm" data-action="review" data-id="' + esc(item.id) + '">' + (item.reviewed ? 'Mark to review' : 'Mark reviewed') + '</button>' +
        (item.moduleId && item.moduleId !== 'daily' ? '<a class="btn sm" href="#/m/' + encodeURIComponent(item.moduleId) + '">Revisit lesson →</a>' : '') +
        '<button type="button" class="mn-remove" data-action="remove" data-id="' + esc(item.id) + '">Remove</button>' +
        '</div></div></article>'
      ).join('') + '</section>' :
      '<div class="mn-empty"><span>📘</span><h2>' + (all.length ? 'Nothing in this filter' : 'Your notebook is empty') + '</h2><p>' + (all.length ? 'Try another filter to see your saved mistakes.' : 'Complete a module quiz or daily challenge. Incorrect answers will appear here automatically.') + '</p><a class="btn" href="#/">Explore lessons</a></div>') +
      '<p class="mn-note">Mistakes are saved to your existing account progress and sync when cloud progress sync is available. Up to 200 distinct questions are kept.</p></div>';
  };
  root.addEventListener('click', event => {
    if (event.target.closest('.mn-practice-start')) {
      const pendingItems = records().filter(item => !item.reviewed);
      startMistakePractice(root, pendingItems, (right, total) => {
        if (right === total) {
          pendingItems.forEach(item => {
            const saved = records().find(x => x.id === item.id);
            if (saved) saved.reviewed = true;
          });
          save();
        }
      }, render);
      return;
    }
    const filterButton = event.target.closest('[data-filter]');
    if (filterButton) { filter = filterButton.dataset.filter; render(); return; }
    const action = event.target.closest('[data-action]');
    if (action) {
      const id = action.dataset.id;
      if (action.dataset.action === 'remove') P.notes.mistakes = records().filter(item => item.id !== id);
      if (action.dataset.action === 'review') {
        const item = records().find(x => x.id === id);
        if (item) item.reviewed = !item.reviewed;
      }
      save(); render(); return;
    }
    if (event.target.closest('.mn-clear')) {
      if (window.confirm('Clear all saved mistakes? This cannot be undone.')) { P.notes.mistakes = []; save(); render(); }
    }
  });
  render();
  return () => {};
}

/** Optional quiz callback; existing callers retain their original behavior when omitted. */
export function mistakeCaptureOptions(moduleId, moduleTitle) {
  return {
    onIncorrect: item => addMistake({
      moduleId,
      moduleTitle,
      question: item.question,
      selectedAnswer: item.selectedAnswer,
      correctAnswer: item.correctAnswer,
      options: item.options
    })
  };
}

export function startMistakePractice(root, mistakes, onDone, onBack) {
  if (!mistakes.length) return;
  const questions = mistakes.map(item => [item.question, item.correctAnswer, ...item.options.filter(option => option !== item.correctAnswer)].slice(0, 5).join('|'));
  root.innerHTML = '<div class="mn-practice"><h2>Practice saved mistakes</h2><p>Try these questions again. This practice does not award XP or change quiz medals.</p><div id="mn-practice-stage"></div><div class="gbar"><button class="btn big" id="gnext" type="button" hidden></button></div></div>';
  const stage = root.querySelector('#mn-practice-stage');
  runQuiz(stage, questions, mistakes.map(() => 'Revision'), (right, secs) => {
    onDone?.(right, questions.length);
    root.innerHTML = '<div class="mn-empty"><span>🧠</span><h2>Practice complete</h2><p>You got ' + right + ' of ' + questions.length + ' correct.</p><button class="btn" type="button" data-practice-back>Back to notebook</button></div>';
    root.querySelector('[data-practice-back]').addEventListener('click', () => onBack?.());
  }, { onIncorrect: item => {
    const source = mistakes.find(saved => saved.question === item.question);
    addMistake({ ...item, moduleId: source?.moduleId, moduleTitle: source?.moduleTitle });
  } });
}
