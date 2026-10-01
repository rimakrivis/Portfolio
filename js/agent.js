// Recruiter chat widget ("See If We Match"). Talks to /api/chat (api/index.py) and shows the agent's steps live.
// All personal texts (name, email, title, chips...) come from /agent.config.json, so the same file works on any portfolio.
(async function () {
  const API = "/api/chat";
  const MAX_CHARS = 12000;
  let cfg;
  try {
    const res = await fetch("/agent.config.json");
    if (!res.ok) throw new Error(res.status);
    cfg = await res.json();
  } catch { return; }                             // no config -> no widget (the rest of the site still works)
  const W = cfg.widget;
  const EMAIL = cfg.person.email;
  const FIRST = cfg.person.first_name;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- markup ----------
  const launcher = document.createElement("button");
  launcher.className = "agent-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", `Open ${W.title}: ${W.subtitle}`);
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = `<span class="agent-launcher-icon" aria-hidden="true">✦</span><span class="agent-launcher-label" aria-hidden="true">${esc(W.button_label)}</span>`;

  const bubble = document.createElement("div");
  bubble.className = "agent-bubble";
  bubble.innerHTML = `<button type="button" class="agent-bubble-open">${esc(W.bubble)}</button>
    <button type="button" class="agent-bubble-close" aria-label="Dismiss">✕</button>`;

  const panel = document.createElement("section");
  panel.className = "agent-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", W.title);
  panel.hidden = true;
  panel.innerHTML = `
    <header class="agent-head">
      <div>
        <strong>${esc(W.title)}</strong>
        <span class="mono">${esc(W.subtitle)}</span>
      </div>
      <div class="agent-head-btns">
        <button type="button" class="agent-new" hidden>New chat</button>
        <button type="button" class="agent-close" aria-label="Close">✕</button>
      </div>
    </header>
    <div class="agent-log" aria-live="polite">
      <div class="agent-msg agent-bot">
        ${md(W.intro)}
        <div class="agent-chips">
          <button type="button" data-jd>Paste a job description</button>
          ${(W.chips || []).map((c) => `<button type="button" data-q="${esc(c.question)}">${esc(c.label)}</button>`).join("")}
        </div>
      </div>
    </div>
    <form class="agent-form">
      <label for="agent-input" class="visually-hidden">Your question or job description</label>
      <textarea id="agent-input" rows="1" maxlength="${MAX_CHARS}" placeholder="Ask, or paste a job description…"></textarea>
      <button type="submit" class="agent-send" aria-label="Send">↑</button>
    </form>
    <p class="agent-foot mono">Answers come only from ${esc(FIRST)}'s portfolio · AI can make mistakes</p>`;
  document.body.append(bubble, launcher, panel);

  const log = panel.querySelector(".agent-log");
  const welcome = log.innerHTML;                  // to restore on "New chat"
  const newChat = panel.querySelector(".agent-new");
  let history = [];                               // memory: [{role: "user" | "assistant", content}], sent with each question
  const form = panel.querySelector(".agent-form");
  const input = panel.querySelector("textarea");
  const send = panel.querySelector(".agent-send");

  // ---------- open / close ----------
  const open = () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("agent-open");
    hideBubble();
    input.focus();
  };
  const close = () => {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("agent-open");
    launcher.focus();
  };
  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.querySelector(".agent-close").addEventListener("click", close);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Shareable link that opens the chat straight away, e.g. https://rimakrivis.vercel.app/#see-if-we-match
  const openFromHash = () => { if ((W.open_hashes || []).map((h) => `#${h}`).includes(location.hash) && panel.hidden) open(); };
  openFromHash();
  addEventListener("hashchange", openFromHash);   // e.g. the "Try it live" button on the case study page

  // Call-to-action bubble: appears after 4s, once dismissed it stays away.
  function hideBubble() { bubble.classList.remove("show"); }
  if (!store.get("agentBubbleDismissed")) setTimeout(() => { if (panel.hidden) bubble.classList.add("show"); }, 4000);
  bubble.querySelector(".agent-bubble-open").addEventListener("click", () => { store.set("agentBubbleDismissed", "1"); open(); });
  bubble.querySelector(".agent-bubble-close").addEventListener("click", () => { store.set("agentBubbleDismissed", "1"); hideBubble(); });

  // ---------- input ----------
  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  // Chips live inside the log, so one delegated listener keeps working after "New chat" rebuilds it.
  log.addEventListener("click", (e) => {
    const chip = e.target.closest(".agent-chips button");
    if (!chip || send.disabled) return;
    if (chip.dataset.q) ask(chip.dataset.q);
    else { input.placeholder = "Paste the job description here…"; input.focus(); }
  });
  newChat.addEventListener("click", () => {
    if (send.disabled) return;                    // wait for the current answer
    history = [];
    log.innerHTML = welcome;
    newChat.hidden = true;
    input.placeholder = "Ask, or paste a job description…";
    input.focus();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = ""; grow();
    ask(text);
  });

  // ---------- safe mini-markdown: escape everything first, then allow **bold**, [links](url) and "- " lists ----------
  function md(src) {
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/|mailto:)[^)\s]*)\)/g, (_, text, url) =>
        `<a href="${url}"${url.startsWith("https://") ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`);
    const out = [];
    let list = null;
    for (const line of src.split("\n")) {
      const item = line.match(/^\s*[-*]\s+(.*)/);
      if (item) { (list ||= []).push(`<li>${inline(item[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    return out.join("");
  }

  // ---------- one agent step, in plain words ----------
  function stepLabel(tool, args) {
    if (tool === "list_skills") return "Reading the skills list";
    if (tool === "get_project") return `Opening case study: ${args.slug}`;
    if (tool === "search_portfolio") return `Searching portfolio: “${args.query}”`;
    return tool;
  }

  function addMsg(cls, html) {
    const el = document.createElement("div");
    el.className = `agent-msg ${cls}`;
    el.innerHTML = html;
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // ---------- talk to the API ----------
  async function ask(text) {
    addMsg("agent-user", `<p>${esc(text.length > 400 ? text.slice(0, 400) + "…" : text)}</p>`);
    const bot = addMsg("agent-bot", `<p class="agent-steps-title mono">Agent steps</p><ol class="agent-steps"></ol>`);
    const steps = bot.querySelector(".agent-steps");
    const addStep = (label) => {
      steps.querySelector(".active")?.classList.replace("active", "done");
      const li = document.createElement("li");
      li.className = "active";
      li.textContent = label;
      steps.append(li);
      log.scrollTop = log.scrollHeight;
    };
    const finishSteps = () => steps.querySelector(".active")?.classList.replace("active", "done");

    send.disabled = true;
    addStep("Reading your message");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-8) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The agent is unavailable right now.");
      }
      // Read the SSE stream by hand (EventSource can't POST): split on blank lines, parse "event:" + "data:".
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
          const event = (raw.match(/^event: (.*)$/m) || [])[1];
          const data = JSON.parse((raw.match(/^data: (.*)$/m) || [, "{}"])[1]);
          if (event === "step") addStep(stepLabel(data.tool, data.args || {}));
          if (event === "answer") {
            finishSteps();
            showAnswer(bot, data.text, text);
            history.push({ role: "user", content: text }, { role: "assistant", content: data.text });
            newChat.hidden = false;
          }
          if (event === "error") throw new Error(data.text);
        }
      }
    } catch (err) {
      finishSteps();
      bot.insertAdjacentHTML("beforeend", `<p class="agent-error">${esc(err.message)} You can always <a href="mailto:${EMAIL}">email ${esc(FIRST)}</a>.</p>`);
    } finally {
      send.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  function showAnswer(bot, answer, question) {
    const div = document.createElement("div");
    div.className = "agent-answer";
    div.innerHTML = md(answer);
    const subject = encodeURIComponent("Role fit: from your portfolio agent");
    const body = encodeURIComponent(`Hi ${FIRST},\n\nI checked a role with your portfolio agent:\n\n${question.slice(0, 600)}\n\n`);
    const actions = document.createElement("div");
    actions.className = "agent-actions";
    actions.innerHTML = `<button type="button" class="agent-copy">Copy summary</button>
      <a class="agent-email" href="mailto:${EMAIL}?subject=${subject}&body=${body}">Email ${esc(FIRST)} about this role</a>`;
    actions.querySelector(".agent-copy").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(answer.replace(/\*\*/g, "")); e.target.textContent = "Copied ✓"; }
      catch { e.target.textContent = "Couldn't copy"; }
    });
    bot.append(div, actions);
  }
})();
