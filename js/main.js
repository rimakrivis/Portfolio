// Shared behaviour for every page: header/footer, theme, cursor, hover backgrounds, reveals, contact form.
(function () {
  const root = document.body.dataset.root || "";   // "" for top-level pages, "../" for /work pages
  const page = document.body.dataset.page || "";

  // ---------- header + footer ----------
  const links = [
    ["index.html", "Home", "home"],
    ["ai-engineering.html", "AI Engineering", "ai"],
    ["music.html", "Music & Marketing", "music"],
    ["about.html", "About", "about"],
    ["contact.html", "Contact", "contact"],
  ];
  const nav = links.map(([href, label, key], i) =>
    `<a href="${root}${href}"${key === page ? ' aria-current="page"' : ""}><sup>0${i + 1}</sup>${label}</a>`).join("");

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `<div class="wrap">
      <a class="brand" href="${root}index.html">Rima Krivickienė<span>.</span></a>
      <div style="display:flex;align-items:center;gap:18px">
        <nav class="nav" id="nav" aria-label="Main">${nav}</nav>
        <button class="theme-toggle" type="button" aria-label="Switch light/dark theme">◐</button>
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav">☰</button>
      </div>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap mono">
      <span>© ${new Date().getFullYear()} Rima Krivickienė · Amsterdam</span>
      <span style="display:flex;gap:20px;flex-wrap:wrap">
        <a href="mailto:rima.poderyte@gmail.com">Email</a>
        <a href="https://www.linkedin.com/in/rima-krivickiene-aiengineer" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://github.com/rimakrivis" target="_blank" rel="noopener">GitHub</a>
        <a href="${root}assets/cv.pdf" download>CV (PDF)</a>
      </span>
    </div>`;
  document.body.append(footer);

  // ---------- mobile menu ----------
  const menuBtn = header.querySelector(".menu-toggle");
  const navEl = header.querySelector(".nav");
  menuBtn.addEventListener("click", () => {
    const open = navEl.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.textContent = open ? "✕" : "☰";
  });

  // ---------- theme ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const saved = store.get("theme");
  if (saved) document.documentElement.dataset.theme = saved;
  header.querySelector(".theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
  });

  // ---------- scroll reveal ----------
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  document.querySelectorAll(".reveal").forEach((el) => io ? io.observe(el) : el.classList.add("in"));

  // ---------- blurred background on project hover ----------
  const hoverItems = document.querySelectorAll("[data-bg]");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (hoverItems.length && fine) {
    const layer = document.createElement("div");
    layer.className = "hover-bg";
    document.body.append(layer);
    const imgs = {};
    hoverItems.forEach((el) => {
      const src = el.dataset.bg;
      if (!imgs[src]) {
        const img = new Image(); img.src = src; img.alt = ""; layer.append(img); imgs[src] = img;
      }
      el.addEventListener("mouseenter", () => {
        Object.values(imgs).forEach((i) => i.classList.remove("on"));
        imgs[src].classList.add("on"); layer.classList.add("on"); document.body.classList.add("bg-active");
      });
      el.addEventListener("mouseleave", () => {
        imgs[src].classList.remove("on"); layer.classList.remove("on"); document.body.classList.remove("bg-active");
      });
    });
  }

  // ---------- custom cursor ----------
  if (fine && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const c = document.createElement("div");
    c.className = "cursor";
    document.body.append(c);
    let x = 0, y = 0, cx = 0, cy = 0;
    addEventListener("mousemove", (e) => {
      x = e.clientX; y = e.clientY; c.classList.add("on");
      c.classList.toggle("big", !!e.target.closest("a, button, label, [data-bg]"));
    });
    document.addEventListener("mouseleave", () => c.classList.remove("on"));
    addEventListener("mousedown", () => c.classList.add("press"));
    addEventListener("mouseup", () => c.classList.remove("press"));
    (function loop() {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      c.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
  }

  // ---------- presentation slider ----------
  document.querySelectorAll(".deck[data-src]").forEach((deck) => {
    const n = +deck.dataset.count, base = deck.dataset.src, title = deck.dataset.title || "Slide";
    const track = document.createElement("div");
    track.className = "deck-track"; track.tabIndex = 0;
    track.setAttribute("aria-label", `${title} presentation, ${n} slides`);
    for (let i = 1; i <= n; i++) {
      const img = new Image();
      img.src = `${base}${String(i).padStart(2, "0")}.jpg`;
      img.alt = `${title}, slide ${i} of ${n}`;
      img.width = 1600; img.height = 900;
      if (i > 1) img.loading = "lazy";
      track.append(img);
    }
    const progress = document.createElement("div"); progress.className = "deck-progress";
    const bar = document.createElement("div"); bar.className = "deck-bar";
    bar.innerHTML = `<span class="deck-count"><b>01</b> / ${String(n).padStart(2, "0")}</span>
      <span class="deck-btns">
        <button type="button" data-dir="-1" aria-label="Previous slide">←</button>
        <button type="button" data-dir="1" aria-label="Next slide">→</button>
        <button type="button" data-full aria-label="Fullscreen">⤢</button>
      </span>`;
    deck.append(track, progress, bar);

    const count = bar.querySelector("b"), [prev, next] = bar.querySelectorAll("[data-dir]");
    const current = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * track.clientWidth });
    const update = () => {
      const i = current();
      count.textContent = String(i + 1).padStart(2, "0");
      progress.style.width = `${((i + 1) / n) * 100}%`;
      prev.disabled = i === 0; next.disabled = i === n - 1;
    };
    bar.querySelectorAll("[data-dir]").forEach((b) => b.addEventListener("click", () => go(current() + +b.dataset.dir)));
    let keep = 0;
    bar.querySelector("[data-full]").addEventListener("click", () => {
      keep = current();
      if (document.fullscreenElement) document.exitFullscreen();
      else if (deck.requestFullscreen) deck.requestFullscreen();
    });
    deck.addEventListener("fullscreenchange", () => requestAnimationFrame(() => {
      track.style.scrollBehavior = "auto"; go(keep); track.style.scrollBehavior = "";
    }));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
    });
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    update();
  });

  // ---------- contact form (Web3Forms, falls back to email) ----------
  const form = document.querySelector("#contact-form");
  if (form) {
    const status = form.querySelector(".form-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (data.get("botcheck")) return;             // honeypot filled → bot
      const key = data.get("access_key");
      if (!key || key.startsWith("YOUR_")) {        // no key configured yet → open email app instead
        const body = `${data.get("message")}\n\n— ${data.get("name")} (${data.get("email")})`;
        location.href = `mailto:rima.poderyte@gmail.com?subject=${encodeURIComponent("Portfolio: " + (data.get("topic") || "Hello"))}&body=${encodeURIComponent(body)}`;
        return;
      }
      data.set("subject", "Portfolio message: " + (data.get("topic") || "General"));
      status.className = "form-status"; status.textContent = "Sending…";
      const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const res = await fetch("https://api.web3forms.com/submit", { method: "POST", body: data });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        form.reset();
        status.className = "form-status ok";
        status.textContent = "Thank you — your message is on its way. I'll reply within a couple of days.";
      } catch (err) {
        status.className = "form-status err";
        status.textContent = "Something went wrong. Please email me directly at rima.poderyte@gmail.com.";
      } finally { btn.disabled = false; }
    });
  }
})();
