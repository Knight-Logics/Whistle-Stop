/* Whistle Stop staff admin — tools that only exist on the Cloudflare version:
   website messages, publish history (undo), and staff logins. */
(function () {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function when(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function notify(message) {
    if (typeof window.WSAdminToast === "function") window.WSAdminToast(message);
    else console.info(message);
  }

  const api = (path, opts) => window.WSConfig.cloudApi(path, opts);

  async function renderMessages(panel) {
    panel.innerHTML = `
      <p class="admin-note">Messages sent from the website's contact form arrive here instantly. Reply by email or phone, then clear them.</p>
      <div class="admin-card" id="ws-messages"><p class="admin-note">Loading messages…</p></div>`;
    const box = panel.querySelector("#ws-messages");
    try {
      const { leads } = await api("leads");
      if (!leads.length) {
        box.innerHTML = `<h3>No messages yet</h3><p class="admin-note" style="margin:0">Try it: open the <a href="contact.html" target="_blank" rel="noopener">contact page</a>, send a test message, then come back here.</p>`;
        return;
      }
      box.innerHTML = `<h3>${leads.length} message${leads.length === 1 ? "" : "s"}</h3>
        <div class="ws-message-list">${leads
          .map(
            (l) => `
          <article class="ws-message" data-id="${esc(l.id)}">
            <header>
              <strong>${esc(l.name)}</strong>
              <span>${esc(l.topic || (l.kind === "private-event" ? "Private event" : "General question"))} · ${esc(when(l.receivedAt))}</span>
            </header>
            <p>${esc(l.message).replace(/\n/g, "<br>")}</p>
            <footer>
              ${l.email ? `<a class="btn btn-outline admin-btn-sm" href="mailto:${esc(l.email)}?subject=${encodeURIComponent("Re: your message to Whistle Stop")}">Email ${esc(l.email)}</a>` : ""}
              ${l.phone ? `<a class="btn btn-outline admin-btn-sm" href="tel:${esc(l.phone.replace(/[^0-9+]/g, ""))}">Call ${esc(l.phone)}</a>` : ""}
              <button type="button" class="btn btn-outline admin-btn-sm" data-clear>Clear</button>
            </footer>
          </article>`
          )
          .join("")}</div>`;
      box.querySelectorAll("[data-clear]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const card = btn.closest(".ws-message");
          btn.disabled = true;
          try {
            await api(`leads/${encodeURIComponent(card.dataset.id)}`, { method: "DELETE" });
            card.remove();
            notify("Message cleared.");
          } catch (err) {
            btn.disabled = false;
            notify(err.message);
          }
        })
      );
    } catch (err) {
      box.innerHTML = `<p class="admin-note">${esc(err.message)}</p>`;
    }
  }

  async function renderHistory(panel) {
    const isOwner = window.WSConfig.getSessionRole?.() === "owner";
    panel.innerHTML = `
      <p class="admin-note">Every Publish is saved here. ${
        isOwner ? "Restore puts an earlier version back on the live site in seconds." : "Ask the owner to restore an earlier version."
      }</p>
      <div class="admin-card" id="ws-history"><p class="admin-note">Loading…</p></div>`;
    const box = panel.querySelector("#ws-history");
    try {
      const { versions, current } = await api("history");
      if (!versions.length) {
        box.innerHTML = `<h3>Nothing published yet</h3><p class="admin-note" style="margin:0">The site is showing the original launch content. Your first Publish will appear here.</p>`;
        return;
      }
      box.innerHTML = `<h3>Published versions</h3>
        <table class="admin-mock-table">
          <thead><tr><th>When</th><th>By</th><th>From</th><th></th></tr></thead>
          <tbody>${versions
            .map(
              (v) => `<tr>
                <td>${esc(when(v.publishedAt))}${current?.versionId === v.versionId ? ' <span class="admin-mock-pill">Live</span>' : ""}</td>
                <td>${esc(v.publishedBy)}</td>
                <td>${esc(v.note || "")}</td>
                <td style="text-align:right">${
                  isOwner && current?.versionId !== v.versionId
                    ? `<button type="button" class="btn btn-outline admin-btn-sm" data-restore="${esc(v.versionId)}">Restore</button>`
                    : ""
                }</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>`;
      box.querySelectorAll("[data-restore]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Restoring…";
          try {
            await api("restore", { method: "POST", body: { versionId: btn.dataset.restore } });
            await window.WSConfig.finalizeLocalAfterPublish?.();
            notify("Earlier version is live again.");
            renderHistory(panel);
          } catch (err) {
            btn.disabled = false;
            btn.textContent = "Restore";
            notify(err.message);
          }
        })
      );
    } catch (err) {
      box.innerHTML = `<p class="admin-note">${esc(err.message)}</p>`;
    }
  }

  async function renderStaffLogins(panel) {
    const me = window.WSConfig.getSessionUser?.() || {};
    const isOwner = me.role === "owner";
    panel.innerHTML = `
      <p class="admin-note">Each person gets their own login. Owners manage logins and can restore versions; editors can publish; staff can draft and use the schedule.</p>
      <div class="admin-card" id="ws-users">${isOwner ? '<p class="admin-note">Loading…</p>' : ""}</div>
      ${
        isOwner
          ? `<div class="admin-card">
        <h3>Add or update a login</h3>
        <form id="ws-user-form" class="admin-form-grid">
          <div class="admin-field"><label for="ws-u-name">Username</label><input id="ws-u-name" name="username" required autocomplete="off" placeholder="e.g. raven" /></div>
          <div class="admin-field"><label for="ws-u-display">Name shown</label><input id="ws-u-display" name="displayName" placeholder="Raven" /></div>
          <div class="admin-field"><label for="ws-u-role">Role</label><select id="ws-u-role" name="role"><option value="editor">Editor</option><option value="staff">Staff</option><option value="owner">Owner</option></select></div>
          <div class="admin-field"><label for="ws-u-pass">Password (10+ characters)</label><input id="ws-u-pass" name="password" type="password" autocomplete="new-password" placeholder="Leave blank to keep the current one" /></div>
          <div><button type="submit" class="btn btn-primary admin-btn-sm">Save login</button></div>
        </form>
      </div>`
          : ""
      }
      <div class="admin-card">
        <h3>Change my password</h3>
        <form id="ws-pass-form" class="admin-form-grid">
          <div class="admin-field"><label for="ws-p-cur">Current password</label><input id="ws-p-cur" name="current" type="password" autocomplete="current-password" required /></div>
          <div class="admin-field"><label for="ws-p-new">New password (10+ characters)</label><input id="ws-p-new" name="next" type="password" autocomplete="new-password" required /></div>
          <div><button type="submit" class="btn btn-outline admin-btn-sm">Change password</button></div>
        </form>
      </div>`;

    panel.querySelector("#ws-pass-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await window.WSConfig.changePassword(f.current.value, f.next.value);
        f.reset();
        notify("Password changed.");
      } catch (err) {
        notify(err.message);
      }
    });

    if (!isOwner) return;
    const box = panel.querySelector("#ws-users");
    async function load() {
      try {
        const { users } = await api("users");
        box.innerHTML = `<h3>Logins</h3>
          <table class="admin-mock-table"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>${users
            .map(
              (u) => `<tr><td>${esc(u.username)}</td><td>${esc(u.displayName)}</td><td>${esc(u.role)}</td>
              <td style="text-align:right">${
                u.username === me.username
                  ? '<span class="admin-mock-pill">You</span>'
                  : `<button type="button" class="btn btn-outline admin-btn-sm" data-remove="${esc(u.username)}">Remove</button>`
              }</td></tr>`
            )
            .join("")}</tbody></table>`;
        box.querySelectorAll("[data-remove]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
              await api(`users/${encodeURIComponent(btn.dataset.remove)}`, { method: "DELETE" });
              notify("Login removed.");
              load();
            } catch (err) {
              btn.disabled = false;
              notify(err.message);
            }
          })
        );
      } catch (err) {
        box.innerHTML = `<p class="admin-note">${esc(err.message)}</p>`;
      }
    }
    load();
    panel.querySelector("#ws-user-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api("users", {
          method: "POST",
          body: { username: f.username.value, displayName: f.displayName.value, role: f.role.value, password: f.password.value },
        });
        f.reset();
        notify("Login saved.");
        load();
      } catch (err) {
        notify(err.message);
      }
    });
  }

  window.WSAdminCloud = { renderMessages, renderHistory, renderStaffLogins };
})();
