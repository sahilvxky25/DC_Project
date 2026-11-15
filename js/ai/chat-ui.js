/* Public BitSecure AI Tutor widget. Does not depend on Firebase login or app boot. */
const apiBase = (document.querySelector('meta[name="bitsecure-ai-api"]')?.content || "").trim().replace(/\/$/, "");
const launcher = document.getElementById("bitsecure-ai-launcher");
const panel = document.getElementById("bitsecure-ai-panel");
const closeButton = document.getElementById("bitsecure-ai-close");
const form = document.getElementById("bitsecure-ai-form");
const input = document.getElementById("bitsecure-ai-input");
const messages = document.getElementById("bitsecure-ai-messages");
const status = document.getElementById("bitsecure-ai-status");
const sendButton = document.getElementById("bitsecure-ai-send");
const clearButton = document.getElementById("bitsecure-ai-clear");
if (launcher && panel && form && input && messages) {
  const history = [];
  let busy = false;

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }
  function appendMessage(role, content, sources = []) {
    const item = document.createElement("article");
    item.className = `bitsecure-ai-message is-${role}`;
    const label = document.createElement("strong");
    label.className = "bitsecure-ai-message-label";
    label.textContent = role === "user" ? "You" : "BitSecure AI Tutor";
    const body = document.createElement("p");
    body.className = "bitsecure-ai-message-body";
    body.textContent = content;
    item.append(label, body);
    if (sources.length) {
      const sourceWrap = document.createElement("div");
      sourceWrap.className = "bitsecure-ai-sources";
      const sourceTitle = document.createElement("span");
      sourceTitle.textContent = "Knowledge used";
      sourceWrap.append(sourceTitle);
      sources.forEach(source => {
        const tag = document.createElement("span");
        tag.textContent = source.title;
        sourceWrap.append(tag);
      });
      item.append(sourceWrap);
    }
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }
  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    input.disabled = value;
    status.textContent = value ? "Thinking…" : "";
    panel.setAttribute("aria-busy", String(value));
  }
  function addSuggestions(items) {
    const wrap = document.createElement("div");
    wrap.className = "bitsecure-ai-suggestions";
    items.slice(0, 3).forEach(text => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bitsecure-ai-suggestion";
      button.textContent = text;
      button.addEventListener("click", () => {
        input.value = text;
        form.requestSubmit();
      });
      wrap.append(button);
    });
    messages.append(wrap);
    messages.scrollTop = messages.scrollHeight;
  }
  launcher.addEventListener("click", () => panel.hidden ? openPanel() : closePanel());
  closeButton?.addEventListener("click", closePanel);
  clearButton?.addEventListener("click", () => {
    history.length = 0;
    messages.replaceChildren();
    appendMessage("assistant", "Your chat has been cleared. What networking topic can I help you with?");
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const message = input.value.trim();
    if (!message) return;
    if (!apiBase) {
      appendMessage("assistant", "The AI Tutor interface is installed, but its Azure API address has not been configured yet. Add your deployed API URL to the bitsecure-ai-api meta tag in index.html.");
      input.value = "";
      return;
    }
    appendMessage("user", message);
    input.value = "";
    setBusy(true);
    const pending = appendMessage("assistant", "Thinking…");
    try {
      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-8) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "The AI Tutor could not answer right now.");
      pending.remove();
      appendMessage("assistant", payload.answer || "I couldn't generate an answer. Please try again.", payload.sources || []);
      history.push({ role: "user", content: message }, { role: "assistant", content: payload.answer || "" });
      addSuggestions(payload.suggestions || []);
    } catch (error) {
      pending.querySelector(".bitsecure-ai-message-body").textContent = error.message || "Connection failed. Please try again.";
    } finally {
      setBusy(false);
      input.focus();
    }
  });
  appendMessage("assistant", "Hello! I'm the BitSecure AI Tutor. Ask me about data communication, computer networks, or how to use the BitSecure learning labs.");
}
