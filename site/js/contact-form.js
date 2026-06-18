/* Contact form — Formspree when configured, mailto fallback for demo */
(function () {
  function setStatus(el, message, type) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.remove("is-success", "is-error");
    if (type) el.classList.add(type === "success" ? "is-success" : "is-error");
  }

  function buildMailto(form, businessEmail) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const topic = String(data.get("topic") || "General question").trim();
    const message = String(data.get("message") || "").trim();
    const subject = encodeURIComponent(`Whistle Stop website — ${topic}`);
    const body = encodeURIComponent(
      [`Name: ${name}`, `Email: ${email}`, phone ? `Phone: ${phone}` : null, `Topic: ${topic}`, "", message]
        .filter(Boolean)
        .join("\n")
    );
    return `mailto:${businessEmail}?subject=${subject}&body=${body}`;
  }

  async function init() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    let endpoint = "";
    let businessEmail = "admin@whistlestopgrill.com";

    try {
      const site = await window.WSConfig.get("site");
      endpoint = String(site.forms?.contact?.endpoint || "").trim();
      businessEmail = site.business?.email || businessEmail;
    } catch {
      /* use defaults */
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector("[data-form-status]");
      const submitBtn = form.querySelector('[type="submit"]');

      if (form.querySelector('[name="_gotcha"]')?.value) return;

      if (!form.reportValidity()) return;

      if (!endpoint) {
        window.location.href = buildMailto(form, businessEmail);
        setStatus(status, "Opening your email app…", "success");
        return;
      }

      submitBtn.disabled = true;
      setStatus(status, "Sending…", null);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        const payload = await res.json().catch(() => ({}));

        if (res.ok) {
          form.reset();
          setStatus(status, "Thanks — your message was sent. We'll reply soon.", "success");
        } else {
          throw new Error(payload.error || "Could not send message.");
        }
      } catch (err) {
        setStatus(status, err.message || "Something went wrong. Please call (727) 726-1956.", "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
