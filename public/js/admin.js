// admin.js - sign in, list waitlist sign-ups, delete them. Built with textContent only, so nothing a visitor typed can run as HTML.
// The login lives in an HttpOnly cookie set by the server, so this script never sees or stores the session.
(() => {
  const $ = (s) => document.querySelector(s);
  const msg = $("#admin-msg"), tbl = $("#tbl"), login = $("#login-form"), panel = $("#panel");

  const say = (t, bad) => { msg.textContent = t || ""; msg.className = `admin-msg${bad ? " bad" : ""}`; };
  // Same-origin calls only. The custom header is what the server checks to block cross-site requests.
  const api = (url, opts = {}) => fetch(url, {
    ...opts, credentials: "same-origin",
    headers: { "x-requested-with": "kivora-admin", ...(opts.body ? { "content-type": "application/json" } : {}) },
  });

  const showLogin = (note, bad) => {
    panel.hidden = true; tbl.hidden = true; login.hidden = false;
    tbl.querySelector("tbody").replaceChildren();
    say(note || "Sign in with your admin account.", bad);
  };
  const showPanel = (email) => { login.hidden = true; panel.hidden = false; $("#who").textContent = `Signed in as ${email}`; };

  async function loadList() {
    say("Loading…");
    const res = await api("/api/admin/waitlist");
    if (res.status === 401) return showLogin("Your session ended. Please sign in again.", true);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return say(data.error || "Could not load requests.", true);
    const body = tbl.querySelector("tbody"); body.replaceChildren();
    [...data.rows].reverse().forEach((r) => {
      const tr = document.createElement("tr");
      [r.id, new Date(r.created_at).toLocaleString(), r.email, r.company, r.role, r.spend_range, r.providers, r.notes].forEach((v) => {
        const td = document.createElement("td"); td.textContent = v == null || v === "" ? "–" : String(v); tr.appendChild(td);
      });
      const act = document.createElement("td"), del = document.createElement("button");
      del.type = "button"; del.className = "btn btn-ghost btn-danger btn-sm"; del.textContent = "Delete";
      del.addEventListener("click", () => removeRow(r, del));
      act.appendChild(del); tr.appendChild(act); body.appendChild(tr);
    });
    tbl.hidden = data.count === 0;
    say(data.count === 0 ? "No requests yet." : `${data.count} request${data.count === 1 ? "" : "s"}, newest first.`);
  }

  async function removeRow(r, btn) {
    if (!window.confirm(`Delete ${r.email} from the waitlist?\n\nThis cannot be undone.`)) return;
    btn.disabled = true;
    const res = await api(`/api/admin/waitlist?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    if (res.status === 401) return showLogin("Your session ended. Please sign in again.", true);
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) { btn.disabled = false; return say(data.error || "Could not delete that entry.", true); }
    await loadList();
    say(`Deleted ${r.email}.`);
  }

  login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#password").value;
    if (!email || !password) return say("Enter your email and password.", true);
    say("Signing in…");
    try {
      const res = await api("/api/admin/session", { method: "POST", body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      $("#password").value = "";
      if (res.status === 404) return say("Admin is switched off: set ADMIN_USERS and SESSION_SECRET on the server.", true);
      if (!res.ok) return say(data.error || "Could not sign in.", true);
      showPanel(data.email); await loadList();
    } catch { say("Could not reach the server. Check your connection.", true); }
  });

  $("#refresh").addEventListener("click", () => loadList().catch(() => say("Could not load requests.", true)));
  $("#logout").addEventListener("click", async () => { await api("/api/admin/session", { method: "DELETE" }).catch(() => {}); showLogin("You are signed out."); });
  $("#csv").addEventListener("click", async () => {
    const res = await api("/api/admin/waitlist?format=csv");
    if (res.status === 401) return showLogin("Your session ended. Please sign in again.", true);
    if (!res.ok) return say("Could not download the CSV.", true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = "kivora-waitlist.csv"; a.click(); URL.revokeObjectURL(url);
  });

  // On load: already signed in (valid cookie)? Go straight to the list. Otherwise show the sign-in form.
  (async () => {
    try {
      const res = await api("/api/admin/session");
      if (res.status === 404) return showLogin("Admin is switched off: set ADMIN_USERS and SESSION_SECRET on the server.", true);
      if (!res.ok) return showLogin();
      const data = await res.json(); showPanel(data.email); await loadList();
    } catch { showLogin("Could not reach the server.", true); }
  })();
})();
