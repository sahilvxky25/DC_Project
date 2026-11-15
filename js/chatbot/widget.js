/* BitSecure chatbot launcher. Presentation only: intentionally makes no API requests. */
const launcher = document.querySelector("#chatbotLauncher");
const panel = document.querySelector("#chatbotPanel");
const closeButton = document.querySelector("#chatbotClose");

if (launcher && panel && closeButton) {
  const setOpen = (open) => {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Close BitSecure assistant" : "Open BitSecure assistant");
    if (open) closeButton.focus();
    else launcher.focus();
  };

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
}
