const config = window.STORE_CONFIG || {};
const sections = ["featured", "allocations", "craft-beers", "tequilas", "champagnes", "deals"];
const FEATURED_AUTOPLAY_MS = 4500;
const STORE_TIME_ZONE = "America/Chicago";
const weeklyHours = [
  { day: "Sunday", label: "12:00 PM - 8:00 PM", open: "12:00", close: "20:00" },
  { day: "Monday", label: "8:30 AM - 10:00 PM", open: "08:30", close: "22:00" },
  { day: "Tuesday", label: "8:30 AM - 10:00 PM", open: "08:30", close: "22:00" },
  { day: "Wednesday", label: "8:30 AM - 10:00 PM", open: "08:30", close: "22:00" },
  { day: "Thursday", label: "8:30 AM - 10:00 PM", open: "08:30", close: "22:00" },
  { day: "Friday", label: "8:30 AM - 10:30 PM", open: "08:30", close: "22:30" },
  { day: "Saturday", label: "8:30 AM - 10:30 PM", open: "08:30", close: "22:30" },
];

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

function initTodayHours() {
  const strip = document.querySelector(".today-strip");
  const status = document.getElementById("today-status");
  const hours = document.getElementById("today-hours");
  if (!strip || !status || !hours) return;

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const day = nowParts.find((part) => part.type === "weekday")?.value;
  const hour = Number(nowParts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(nowParts.find((part) => part.type === "minute")?.value || 0);
  const today = weeklyHours.find((entry) => entry.day === day);
  if (!today) return;

  function toMinutes(value) {
    const [hoursValue, minutesValue] = value.split(":").map(Number);
    return hoursValue * 60 + minutesValue;
  }

  const currentMinutes = hour * 60 + minute;
  const isOpen = currentMinutes >= toMinutes(today.open) && currentMinutes < toMinutes(today.close);

  strip.classList.toggle("is-closed", !isOpen);
  status.textContent = isOpen ? "Open now" : "Closed now";
  hours.textContent = `${today.day}: ${today.label}`;
}

function initHideableHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const toggle = header?.querySelector(".nav-toggle");
  const navLinks = header?.querySelectorAll(".site-nav a") || [];
  const mobileQuery = window.matchMedia("(max-width: 860px)");
  let lastScrollY = window.scrollY;
  let ticking = false;

  function closeNav() {
    header.classList.remove("is-nav-open");
    document.body.classList.remove("has-open-nav");
    toggle?.setAttribute("aria-expanded", "false");
  }

  function setHeaderState() {
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY;
    const shouldHide = mobileQuery.matches && currentScrollY > 140 && scrollDelta > 8;
    const shouldShow = !mobileQuery.matches || scrollDelta < -6 || currentScrollY < 80;

    if (shouldHide) {
      closeNav();
      header.classList.add("is-header-hidden");
    }
    if (shouldShow) header.classList.remove("is-header-hidden");

    lastScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (ticking) return;
    window.requestAnimationFrame(setHeaderState);
    ticking = true;
  }, { passive: true });

  mobileQuery.addEventListener("change", () => {
    header.classList.remove("is-header-hidden");
    closeNav();
    lastScrollY = window.scrollY;
  });

  toggle?.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-nav-open");
    document.body.classList.toggle("has-open-nav", isOpen);
    header.classList.remove("is-header-hidden");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!header.classList.contains("is-nav-open")) return;
    if (header.contains(event.target)) return;
    closeNav();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("is-header-hidden");
      closeNav();
    });
  });
}

function initTextAlertSignup() {
  const webFormId = "6a4293643c8bcb1693fe9aa5";
  const formFields = [{ name: "phone", label: "Phone", type: "phone" }];
  const fieldErrorClassName = "st-signupform-validation-error";
  const forms = document.querySelectorAll(`#st-join-web-form-${webFormId}`);
  const duplicatePhoneException = "DuplicateContactPhoneException";
  const duplicateEmailException = "DuplicateContactEmailException";
  const customFieldsValidationException = "CustomFieldsValidationException";

  function getSubmitButton(form) {
    return form.querySelector("#subscribeNow");
  }

  function getServerError(form) {
    return form.querySelector(".st-signupform-server-error-message");
  }

  function getTermsError(form) {
    return form.querySelector(".st-signupform-terms-agreed-error");
  }

  function setServerErrorMessage(form, message) {
    const error = getServerError(form);
    if (!error) return;
    error.innerText = message;
    error.classList.toggle("st-hidden", !message);
  }

  function hideTermsAgreedError(form) {
    getTermsError(form)?.classList.add("st-hidden");
  }

  function showTermsAgreedError(form) {
    getSubmitButton(form).disabled = false;
    getTermsError(form)?.classList.remove("st-hidden");
  }

  function clearFormErrors(form) {
    form.querySelectorAll(`.${fieldErrorClassName}`).forEach((field) => {
      field.classList.remove(fieldErrorClassName);
      const fieldError = form.querySelector(`#js-error-${field.name}`);
      if (fieldError) fieldError.innerText = "";
    });

    setServerErrorMessage(form, "");
    hideTermsAgreedError(form);
  }

  function collectFormData(form) {
    const formData = new FormData(form);
    const data = {
      webFormId,
      fieldValues: {},
      listIds: [],
    };

    formData.forEach((value, name) => {
      if (name === "list") {
        data.listIds.push(value);
      } else if (name === "phone") {
        data.fieldValues[name] = value.replace(/\D/g, "");
      } else if (!["terms-agreed", "webFormId"].includes(name)) {
        data.fieldValues[name] = value;
      }
    });

    return data;
  }

  function convertServerErrorMessage(fieldName, errorMessage) {
    const field = formFields.find((formField) => formField.name === fieldName);
    if (!field) return errorMessage || "Validation error.";
    if (errorMessage === "Required field value is empty") return `${field.label} is required`;
    if (field.type === "phone") return `${field.label} is required in (XXX) XXX-XXXX format`;
    return errorMessage;
  }

  function parseServerValidationError(response) {
    try {
      const error = JSON.parse(response);

      if (error.code === duplicatePhoneException) {
        return [{ fieldName: "phone", errorMessage: "Phone number already exists." }];
      }
      if (error.code === duplicateEmailException) {
        return [{ fieldName: "email", errorMessage: "Email already exists." }];
      }
      if (error.code === customFieldsValidationException) {
        return Object.entries(error.reasons).map(([key, value]) => ({
          fieldName: key,
          errorMessage: convertServerErrorMessage(key, value),
        }));
      }

      return [{
        fieldName: error.invalidValueName || "",
        errorMessage: convertServerErrorMessage(error.invalidValueName, error.reason),
      }];
    } catch (error) {
      return [{ fieldName: "", errorMessage: "Validation error." }];
    }
  }

  function handleLoadForm(request, form) {
    const submitButton = getSubmitButton(form);

    if (request.status === 200) {
      const formData = new FormData(form);
      const confirmationText = form.querySelector(".step2-confirmationText");
      confirmationText.innerText = confirmationText.innerText.replace("%%phone%%", formData.get("phone"));
      form.querySelector(".step1-form").style.display = "none";
      confirmationText.style.display = "block";
      form.reset();
      return;
    }

    submitButton.disabled = false;

    if (request.status === 418) {
      const validations = parseServerValidationError(request.responseText);
      if (!validations.length) {
        setServerErrorMessage(form, "Internal Error. Please, try later.");
        return;
      }

      validations.forEach((validation) => {
        if (!validation.fieldName) {
          setServerErrorMessage(form, validation.errorMessage);
          return;
        }

        form.querySelectorAll(`input[name="${validation.fieldName}"], textarea[name="${validation.fieldName}"]`).forEach((field) => {
          field.classList.add(fieldErrorClassName);
        });
        const fieldError = form.querySelector(`#js-error-${validation.fieldName}`);
        if (fieldError) fieldError.innerText = validation.errorMessage;
      });
      return;
    }

    setServerErrorMessage(form, "Internal Error. Please, try later.");
  }

  function sendForm(form) {
    const request = new XMLHttpRequest();
    request.open(form.method, `${form.action}?r=${Date.now()}`);
    request.onload = () => handleLoadForm(request, form);
    request.onerror = () => {
      getSubmitButton(form).disabled = false;
      setServerErrorMessage(form, "Internal Error. Please, try later.");
    };
    request.ontimeout = request.onerror;
    request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    request.send(JSON.stringify(collectFormData(form)));
  }

  function formatPhone(value) {
    const numbers = value.replace(/\D/g, "");
    const firstPart = numbers.substring(0, 3);
    const secondPart = numbers.substring(3, 6);
    const thirdPart = numbers.substring(6, 10);
    let result = "";

    if (firstPart) result += `(${firstPart}`;
    if (secondPart) result += `) ${secondPart}`;
    if (thirdPart) result += `-${thirdPart}`;

    return result;
  }

  forms.forEach((form, index) => {
    if (form.hasAttribute("data-form-initialized")) return;
    form.setAttribute("data-form-initialized", "true");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitButton = getSubmitButton(form);
      submitButton.disabled = true;
      clearFormErrors(form);

      if (!form.querySelector('input[name="terms-agreed"]').checked) {
        showTermsAgreedError(form);
        return;
      }

      sendForm(form);
    });

    form.querySelectorAll('input[data-type="phone"]').forEach((field) => {
      field.addEventListener("input", (event) => {
        event.currentTarget.value = formatPhone(event.currentTarget.value);
      });
    });

    const agreedField = form.querySelector(`#terms-agreed-checkbox-${webFormId}`);
    const agreedLabel = form.querySelector(".st-terms-and-conditions-text");
    if (agreedField && agreedLabel) {
      agreedField.id += `-${index}`;
      agreedLabel.setAttribute("for", agreedField.id);
    }
  });
}

initAgeGate();
initFeaturedCarousel();
initTodayHours();
initHideableHeader();
initTextAlertSignup();
loadStorefront();
