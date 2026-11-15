// main.js - mobile menu, footer year, bar stagger, and the waitlist form.
(() => {
  const $ = (s) => document.querySelector(s);

  // Mobile menu
  const btn = $("#menu-btn"), nav = $("#nav");
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
  });

  $("#year").textContent = new Date().getFullYear();
  document.querySelectorAll(".bars i").forEach((el, i) => el.style.setProperty("--n", i));

  // Waitlist form
  const form = $("#waitlist-form"), msg = $("#form-msg"), email = $("#email");
  const show = (text, kind) => { msg.textContent = text; msg.className = `form-msg ${kind || ""}`; };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const payload = () => { const fd = new FormData(form); const o = Object.fromEntries(fd); o.providers = fd.getAll("providers"); return o; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    email.removeAttribute("aria-invalid");
    if (!EMAIL_RE.test(email.value.trim())) {
      email.setAttribute("aria-invalid", "true");
      email.focus();
      return show("Enter a valid work email address.", "err");
    }
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    show("Sending…");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      show(data.status === "exists" ? "You’re already on the list. We’ll be in touch." : "Thanks. You’re on the list, and we’ll be in touch.", "ok");
      form.reset();
    } catch (err) {
      show(err.message, "err");
    } finally {
      submit.disabled = false;
    }
  });

  // ---- v1.1 additions ----
  document.documentElement.classList.add("js");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll reveal (content stays visible if IntersectionObserver is unavailable)
  const targets = document.querySelectorAll(".row, .grid > div, .three > *, .use-grid > *, .truth > div, .tri > div, .badges li, .plan, .person, .status-box");
  if ("IntersectionObserver" in window && !calm) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 });
    targets.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", `${(i % 3) * 80}ms`); io.observe(el); });
  }

  // Cursor spotlight on cards and panels
  document.querySelectorAll(".grid > div, .panel").forEach((el) => el.classList.add("spot"));
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".spot");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  // Count-up on the preview numbers
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count), prefix = el.dataset.prefix || "";
    if (calm || !Number.isFinite(end)) return;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1200);
      el.textContent = prefix + Math.round(end * (1 - Math.pow(1 - t, 3))).toLocaleString("en-US");
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Interactive demo: approve an action in the Autopilot preview, then reset
  const demo = document.querySelector("[data-demo-approve]");
  if (demo) {
    const holder = demo.parentElement;
    demo.addEventListener("click", () => {
      const done = document.createElement("span");
      done.className = "chip";
      done.textContent = "Executed · can roll back";
      demo.replaceWith(done);
      setTimeout(() => holder.lastElementChild.replaceWith(demo), 5000);
    });
  }
})();
