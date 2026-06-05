/* Fusco-style Google review carousel + map */
const AVATAR_COLORS = ["lime", "purple", "rust", "teal", "gold", "blue"];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function buildMeta(r) {
  const parts = [];
  if (r.badge) parts.push(r.badge);
  if (r.meal) parts.push(r.meal);
  if (parts.length) return parts.join(" · ");
  return "Google review";
}

function initReviewCarousels() {
  document.querySelectorAll("[data-review-carousel]").forEach((carousel) => {
    const track = carousel.querySelector("[data-review-track]");
    const dotsContainer = carousel.querySelector("[data-review-dots]");
    const previousButton = carousel.querySelector("[data-review-prev]");
    const nextButton = carousel.querySelector("[data-review-next]");

    if (!track || !dotsContainer) return;

    const cards = Array.from(track.querySelectorAll(".review-card"));
    if (!cards.length) return;

    let currentIndex = 0;
    let cachedCardWidth = 0;

    function visibleCount() {
      if (window.innerWidth <= 759) return 1;
      if (window.innerWidth <= 1099) return 2;
      return 3;
    }

    function getCardWidth() {
      if (!cachedCardWidth) {
        const gap = Number.parseFloat(getComputedStyle(track).gap) || 16;
        cachedCardWidth = cards[0].getBoundingClientRect().width + gap;
      }
      return cachedCardWidth;
    }

    function buildDots() {
      dotsContainer.innerHTML = "";
      const pages = Math.max(1, Math.ceil(cards.length / visibleCount()));
      for (let i = 0; i < pages; i++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "review-carousel-dot";
        dot.setAttribute("aria-label", `Go to review set ${i + 1}`);
        dot.addEventListener("click", () => {
          currentIndex = i * visibleCount();
          updateCarousel();
        });
        dotsContainer.appendChild(dot);
      }
    }

    function updateCarousel() {
      const visible = visibleCount();
      const maxIndex = Math.max(0, cards.length - visible);
      currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));
      track.style.transform = `translateX(-${currentIndex * getCardWidth()}px)`;

      const activeDot = Math.floor(currentIndex / visible);
      dotsContainer.querySelectorAll(".review-carousel-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i === activeDot);
      });

      if (previousButton) previousButton.disabled = currentIndex === 0;
      if (nextButton) nextButton.disabled = currentIndex >= maxIndex;
    }

    previousButton?.addEventListener("click", () => {
      currentIndex -= visibleCount();
      updateCarousel();
    });

    nextButton?.addEventListener("click", () => {
      currentIndex += visibleCount();
      updateCarousel();
    });

    buildDots();
    updateCarousel();

    let resizeTimer;
    window.addEventListener("resize", () => {
      cachedCardWidth = 0;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        buildDots();
        updateCarousel();
      }, 120);
    });
  });
}

(async function () {
  const carouselRoot = document.querySelector("[data-review-carousel]");
  const trackEl = carouselRoot?.querySelector("[data-review-track]");
  const scoreEl = document.getElementById("review-google-score");
  const googleStatEl = document.getElementById("google-stat");

  if (!trackEl) return;

  let data;
  try {
    const res = await fetch("data/reviews.json");
    data = await res.json();
  } catch {
    return;
  }

  const g = data.google;
  if (scoreEl && g) {
    scoreEl.innerHTML = `<span class="review-stars" aria-label="${g.rating} out of 5 stars">${"★".repeat(Math.round(g.rating))}</span><span>${g.rating} · ${g.count.toLocaleString()} reviews</span>`;
  }

  if (googleStatEl && g) {
    googleStatEl.innerHTML = `<strong>${g.rating}</strong><span>${g.count.toLocaleString()}+ Google reviews</span>`;
  }

  trackEl.innerHTML = (data.featured || [])
    .map((r, i) => {
      const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      const quote =
        r.text.length > 160 ? `${r.text.slice(0, 157).trim()}...` : r.text;
      return `
        <article class="review-card">
          <div class="review-card-top">
            <div class="review-avatar review-avatar--${color}">${initials(r.author)}</div>
            <div class="review-card-person">
              <h3>${r.author}</h3>
              <p class="review-card-meta">${buildMeta(r)}</p>
            </div>
          </div>
          <span class="review-card-stars" aria-label="${r.rating} out of 5 stars">${stars}</span>
          <p class="review-card-quote">"${quote}"</p>
          <p class="review-card-date">${r.date}</p>
        </article>`;
    })
    .join("");

  initReviewCarousels();

  trackEl.querySelectorAll(".review-card").forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), i * 60);
  });
})();
