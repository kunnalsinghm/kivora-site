// admin.js - lists waitlist sign-ups. Built with textContent only, so nothing a visitor typed can run as HTML.
(() => {
  const $ = (s) => document.querySelector(s);
  const msg = $("#admin-msg"), tbl = $("#tbl"), csvBtn = $("#csv");
  const headers = () => ({ "x-admin-token": $("#token").value.trim() });
  const say = (t, bad) => { msg.textContent = t; msg.className = `admin-msg${bad ? " bad" : ""}`; };

  $("#admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    say("Loading…");
    try {
      const res = await fetch("/api/admin/waitlist", { headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) throw new Error("Admin is switched off: set ADMIN_TOKEN on the server.");
      if (res.status === 401) throw new Error("That token isn’t right.");
      if (!res.ok) throw new Error(data.error || "Could not load requests.");
      const body = tbl.querySelector("tbody"); body.replaceChildren();
      [...data.rows].reverse().forEach((r) => {
        const tr = document.createElement("tr");
        [r.id, new Date(r.created_at).toLocaleString(), r.email, r.company, r.role, r.spend_range, r.providers, r.notes].forEach((v) => {
          const td = document.createElement("td"); td.textContent = v == null || v === "" ? "–" : String(v); tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      tbl.hidden = data.count === 0; csvBtn.disabled = false;
      say(data.count === 0 ? "No requests yet." : `${data.count} request${data.count === 1 ? "" : "s"}, newest first.`);
    } catch (err) { tbl.hidden = true; csvBtn.disabled = true; say(err.message, true); }
  });

  csvBtn.addEventListener("click", async () => {
    const res = await fetch("/api/admin/waitlist?format=csv", { headers: headers() });
    if (!res.ok) return say("Could not download the CSV.", true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = "kivora-waitlist.csv"; a.click(); URL.revokeObjectURL(url);
  });
})();
