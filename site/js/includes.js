/* Load partials before other scripts */
document.addEventListener("DOMContentLoaded", async () => {
  const nodes = document.querySelectorAll("[data-include]");
  await Promise.all(
    [...nodes].map(async (el) => {
      try {
        const res = await fetch(el.dataset.include);
        if (res.ok) el.innerHTML = await res.text();
      } catch (e) {
        console.warn("Include failed:", el.dataset.include, e);
      }
    })
  );
  document.dispatchEvent(new Event("partials-loaded"));
});
