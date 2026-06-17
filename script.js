const config = window.STORE_CONFIG || {};
const sections = ["featured", "allocations", "craft-beers", "tequilas", "champagnes", "deals"];
const FEATURED_AUTOPLAY_MS = 4500;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeDescription(text, isFeatured) {
  const words = String(text || "").replace(/https?:\/\/\S+|www\.\S+/g, "").trim().split(/\s+/).filter(Boolean);
  const limit = isFeatured ? 85 : 32;
  return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : words.join(" ");
}

function itemCard(item, isFeatured = false) {
  const soldOut = item.is_sold_out;
  const description = normalizeDescription(item.description, isFeatured);
  return `
    <article class="card ${soldOut ? "is-sold-out" : ""}">
      ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.image_alt_text || item.name)}" loading="lazy">` : ""}
      <div class="card-body">
        <span class="pill ${soldOut ? "sold" : ""}">${escapeHtml(soldOut ? "Sold Out" : item.availability_label || "Featured")}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
    </article>
  `;
}

function renderSection(section) {
  const target = document.querySelector(`[data-section="${section.slug}"]`);
  if (!target) return;

  const isFeatured = section.slug === "featured";
  const items = [...(section.items || [])].sort((first, second) => {
    return Number(Boolean(first.is_sold_out)) - Number(Boolean(second.is_sold_out));
  });
  target.innerHTML = items.length
    ? items.map((item) => itemCard(item, isFeatured)).join("")
    : `<div class="empty">No published ${escapeHtml(section.name.toLowerCase())} yet. Check back soon.</div>`;
}

function initFeaturedCarousel() {
  const track = document.querySelector('[data-section="featured"]');
  let autoplayId = null;

  function scrollFeatured(direction = 1) {
    const card = track?.querySelector(".card");
    if (!track || !card) return;

    const gap = 18;
    const distance = card.getBoundingClientRect().width + gap;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    const atStart = track.scrollLeft <= 8;

    if (direction > 0 && atEnd) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direction < 0 && atStart) {
      track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
      return;
    }

    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  function startAutoplay() {
    if (autoplayId || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    autoplayId = window.setInterval(() => scrollFeatured(1), FEATURED_AUTOPLAY_MS);
  }

  function stopAutoplay() {
    window.clearInterval(autoplayId);
    autoplayId = null;
  }

  document.querySelectorAll("[data-featured-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.featuredDirection === "prev" ? -1 : 1;
      stopAutoplay();
      scrollFeatured(direction);
      startAutoplay();
    });
  });

  const carousel = document.querySelector(".featured-carousel");
  carousel?.addEventListener("mouseenter", stopAutoplay);
  carousel?.addEventListener("mouseleave", startAutoplay);
  carousel?.addEventListener("focusin", stopAutoplay);
  carousel?.addEventListener("focusout", startAutoplay);
  carousel?.addEventListener("touchstart", stopAutoplay, { passive: true });
  carousel?.addEventListener("touchend", startAutoplay);
  startAutoplay();
}

async function loadStorefront() {
  sections.forEach((slug) => {
    const target = document.querySelector(`[data-section="${slug}"]`);
    if (target) target.innerHTML = `<div class="empty">Loading current store highlights...</div>`;
  });

  try {
    const response = await fetch(`${config.apiUrl}?r=${Date.now()}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    (data.sections || []).forEach(renderSection);
  } catch (error) {
    sections.forEach((slug) => {
      const target = document.querySelector(`[data-section="${slug}"]`);
      if (target) target.innerHTML = `<div class="empty">Current items could not load. Please check back soon.</div>`;
    });
    console.warn(`${config.storeName || "Store"} content failed to load`, error);
  }
}

function initAgeGate() {
  const gate = document.getElementById("age-gate");
  const button = document.getElementById("age-confirm");
  if (localStorage.getItem("ageVerified") === "true") {
    gate.classList.add("is-hidden");
  }
  button?.addEventListener("click", () => {
    localStorage.setItem("ageVerified", "true");
    gate.classList.add("is-hidden");
  });
}

initAgeGate();
initFeaturedCarousel();
loadStorefront();
