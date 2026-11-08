/**
 * Gemini-powered adaptive quiz. The standard Challenges and checks module remains unchanged.
 * Questions are generated one at a time; the API keeps answer keys server-side.
 */
import { auth } from '../../auth/firebase-client.js';
import { P, save } from '../../core/storage.js';
import { panel, statRow, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { regMod } from '../registry.js';

const API_BASE = (document.querySelector('meta[name="bitsecure-quiz-api"]')?.content || '').trim().replace(/\/$/, '');
const QUESTION_LIMIT = 8;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'];
const TOPICS = ['Mixed networking', 'OSI and TCP/IP', 'Framing and error control', 'IP addressing and subnetting', 'Routing', 'TCP, UDP and congestion', 'DNS, HTTP and TLS', 'Network security'];

regMod({
  id: 'ai-quiz',
  group: 'learn',
  title: 'AI Adaptive Quiz',
  desc: 'A Gemini-powered quiz that adjusts networking question difficulty and topics from your answers.',
  obj: [
    'Answer one AI-generated question at a time.',
    'Difficulty adapts to recent correct and incorrect answers.',
    'Review topic performance and explanations at the end.'
  ],
  mount(root) {
    let index = 0;
    let score = 0;
    let difficulty = 2;
    let current = null;
    let history = [];
    let topicStats = {};
    let answered = false;
    let hinted = false;
    let requestStartedAt = 0;
    let closed = false;

    const saved = P.stats.aiQuiz || {};
    const previous = Array.isArray(saved.history) ? saved.history : [];
    const best = Number(saved.best) || 0;

    const getLevel = () => LEVELS[Math.min(4, Math.floor((Number(P.stats.aiQuiz?.levelIndex) || 0)))];
    const token = async () => {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to use the AI Adaptive Quiz.');
      return user.getIdToken();
    };
    const api = async (route, body) => {
      if (!API_BASE) throw new Error('The AI quiz API has not been configured yet. Add your Azure Function App URL to the bitsecure-quiz-api meta tag in index.html.');
      const idToken = await token();
      const response = await fetch(API_BASE + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The AI quiz service is temporarily unavailable.');
      return data;
    };
    const updateSaved = () => {
      const old = P.stats.aiQuiz || {};
      P.stats.aiQuiz = {
        ...old,
        best: Math.max(Number(old.best) || 0, Math.round((score / Math.max(1, index + 1)) * 100)),
        topicStats: { ...(old.topicStats || {}), ...topicStats }
      };
      save();
    };
    const chooseTopic = () => {
      const weakest = Object.entries(topicStats)
        .filter(([, value]) => value.total >= 1)
        .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];
      return weakest?.[0] || TOPICS[(index + Math.floor(Math.random() * TOPICS.length)) % TOPICS.length];
    };
    const adapt = correct => {
      const recent = history.slice(-2);
      if (correct && recent.every(item => item.correct)) difficulty = Math.min(5, difficulty + 1);
      else if (!correct && recent.length && recent.every(item => !item.correct)) difficulty = Math.max(1, difficulty - 1);
      else if (correct) difficulty = Math.min(5, difficulty + 0.25);
      else difficulty = Math.max(1, difficulty - 0.25);
    };
    const showError = message => {
      if (closed) return;
      root.innerHTML = panel('AI Adaptive Quiz', `
        ${vd('bad', 'Could not load the AI quiz.', esc(message))}
        <p class="hint">Your standard Challenges and checks quiz is still available and has not been changed.</p>
        <div class="btnrow"><button class="btn" id="aiRetry">Try again</button><a class="btn ghost" href="#/m/challenges">Open standard quiz</a></div>`);
      $('#aiRetry', root).onclick = start;
    };
    const finish = () => {
      const pct = Math.round((score / QUESTION_LIMIT) * 100);
      const old = P.stats.aiQuiz || {};
      const bestScore = Math.max(Number(old.best) || 0, pct);
      P.stats.aiQuiz = {
        best: bestScore,
        runs: (Number(old.runs) || 0) + 1,
        levelIndex: Math.min(4, Math.floor((Number(old.levelIndex) || 0) + (pct >= 75 ? 1 : 0))),
        history: [...history, ...(Array.isArray(old.history) ? old.history : [])].slice(0, 12),
        topicStats: { ...(old.topicStats || {}), ...topicStats }
      };
      save();
      const rows = Object.entries(topicStats).map(([topic, value]) => [
        esc(topic), value.correct + ' / ' + value.total
      ]);
      root.innerHTML = panel('AI quiz results', `
        <div class="quizq"><p class="big">${score} of ${QUESTION_LIMIT} correct (${pct}%)</p><p class="hint">The next attempt will use your recent performance to choose a starting difficulty and focus topics.</p></div>
        ${statRow([[pct + '%', 'this attempt'], [bestScore + '%', 'best score'], [getLevel(), 'learner level']])}
        ${rows.length ? tbl(['Topic', 'Correct'], rows) : ''}
        ${pct >= 75 ? vd('ok', 'Strong work.', 'Your next attempt will start at a higher level.') : vd('info', 'Keep practising.', 'The next attempt will focus more on topics that need improvement.')}
        <div class="btnrow"><button class="btn" id="aiAgain">Start another AI quiz</button><a class="btn ghost" href="#/m/challenges">Standard quiz</a></div>`);
      $('#aiAgain', root).onclick = start;
    };
    const loadQuestion = async () => {
      if (closed) return;
      if (index >= QUESTION_LIMIT) return finish();
      root.innerHTML = panel('AI Adaptive Quiz', `
        <div class="quizq"><p class="big">Preparing your next question…</p><p class="hint">Gemini is adapting the topic and difficulty from your answers.</p></div>
        <div class="bar"><i style="width:${(index / QUESTION_LIMIT) * 100}%"></i></div>`);
      try {
        const data = await api('/quiz/generate', {
          difficulty: Math.round(difficulty),
          level: getLevel(),
          topic: chooseTopic(),
          recent: history.slice(-6).map(item => ({
            topic: item.topic, correct: item.correct, difficulty: item.difficulty
          }))
        });
        if (closed) return;
        if (!data.questionId || !Array.isArray(data.options) || data.options.length !== 4 || !data.answerToken) {
          throw new Error('The AI service returned an incomplete question. Please try again.');
        }
        current = data;
        answered = false;
        hinted = false;
        requestStartedAt = Date.now();
        renderQuestion();
      } catch (error) {
        showError(error.message);
      }
    };
    const renderQuestion = () => {
      const q = current;
      root.innerHTML = panel(`AI question ${index + 1} of ${QUESTION_LIMIT}`, `
        <div class="bar"><i style="width:${(index / QUESTION_LIMIT) * 100}%"></i></div>
        <div class="quizq"><small class="tagc">${esc(q.topic)} · Difficulty ${q.difficulty}/5</small><p class="big">${esc(q.question)}</p></div>
        <div class="opts" id="aiOptions">${q.options.map((option, n) => `<button class="opt" data-k="${n}"><span>${'ABCD'[n]}</span>${esc(option)}</button>`).join('')}</div>
        <div id="aiFeedback"></div>
        <div class="btnrow"><button class="btn ghost sm" id="aiHint">Show hint</button><button class="btn ghost sm" id="aiSkip">Skip question</button></div>`);
      $('#aiHint', root).onclick = () => {
        hinted = true;
        $('#aiFeedback', root).innerHTML = vd('info', 'Hint', esc(q.hint || 'Think about the core networking principle.'));
      };
      $('#aiSkip', root).onclick = () => submitAnswer(-1);
      $('#aiOptions', root).onclick = event => {
        const button = event.target.closest('.opt');
        if (button && !answered) submitAnswer(Number(button.dataset.k));
      };
    };
    const submitAnswer = async selectedIndex => {
      if (answered || !current) return;
      answered = true;
      $('#aiOptions', root)?.querySelectorAll('button').forEach(button => { button.disabled = true; });
      $('#aiHint', root).disabled = true;
      $('#aiSkip', root).disabled = true;
      $('#aiFeedback', root).innerHTML = '<p class="hint">Checking your answer…</p>';
      try {
        const result = await api('/quiz/answer', {
          answerToken: current.answerToken,
          selectedIndex: selectedIndex < 0 ? 4 : selectedIndex
        });
        if (closed) return;
        const correct = selectedIndex >= 0 && result.correct === true;
        if (correct) score++;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - requestStartedAt) / 1000));
        history.push({
          topic: current.topic, correct, difficulty: current.difficulty,
          hinted, skipped: selectedIndex < 0, seconds: elapsedSeconds
        });
        topicStats[current.topic] = topicStats[current.topic] || { correct: 0, total: 0 };
        topicStats[current.topic].total++;
        if (correct) topicStats[current.topic].correct++;
        adapt(correct);
        updateSaved();
        $('#aiOptions', root)?.querySelectorAll('.opt').forEach((button, n) => {
          button.classList.toggle('right', n === result.correctIndex);
          button.classList.toggle('wrong', n === selectedIndex && !correct);
        });
        $('#aiFeedback', root).innerHTML =
          (correct ? vd('ok', hinted ? 'Correct (hint used).' : 'Correct.', esc(result.explanation)) :
            vd('bad', selectedIndex < 0 ? 'Skipped.' : 'Not quite.', esc(result.explanation))) +
          `<div class="btnrow"><button class="btn" id="aiNext">${index + 1 >= QUESTION_LIMIT ? 'See results' : 'Next question'}</button></div>`;
        $('#aiNext', root).onclick = () => { index++; loadQuestion(); };
        $('#aiNext', root).focus();
      } catch (error) {
        answered = false;
        $('#aiFeedback', root).innerHTML = vd('bad', 'Could not check answer.', esc(error.message));
      }
    };
    async function start() {
      index = 0; score = 0; difficulty = 2; current = null;
      history = []; topicStats = { ...(P.stats.aiQuiz?.topicStats || {}) }; answered = false; hinted = false;
      const savedData = P.stats.aiQuiz || {};
      const recent = Array.isArray(savedData.history) ? savedData.history.slice(0, 6) : [];
      const recentAccuracy = recent.length
        ? recent.filter(item => item.correct).length / recent.length : 0.5;
      difficulty = recent.length >= 3 ? (recentAccuracy >= 0.8 ? 3 : recentAccuracy < 0.4 ? 1 : 2) : 2;
      loadQuestion();
    }
    if (!API_BASE) {
      showError('The Azure quiz API URL has not been configured. Once the API is deployed, add its /api URL to the bitsecure-quiz-api meta tag in index.html.');
    } else {
      start();
    }
    return () => { closed = true; };
  }
});
