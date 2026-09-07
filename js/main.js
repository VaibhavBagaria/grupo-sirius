(function () {
  "use strict";

  // Footer year
  document.getElementById("year").textContent = new Date().getFullYear();

  // Mobile navigation
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("nav__links--open");
      toggle.setAttribute("aria-expanded", open);
    });

    links.querySelectorAll("a, [data-donate-open]").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("nav__links--open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Image error handling — show placeholders when assets aren't uploaded yet
  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.setAttribute("data-error", "true");
    });
    if (!img.complete || img.naturalWidth === 0) {
      if (img.complete) img.setAttribute("data-error", "true");
    }
  });

  // Gallery slider
  const slider = document.querySelector(".slider");
  if (!slider) return;

  const slides = [...slider.querySelectorAll(".slide")];
  const prevBtn = slider.querySelector(".slider__btn--prev");
  const nextBtn = slider.querySelector(".slider__btn--next");
  const dotsContainer = slider.querySelector(".slider__dots");
  let current = 0;
  let autoplayTimer;

  function markOrientation(slide) {
    const photo = slide.querySelector(".slide__photo");
    if (!photo) return;
    const apply = () => {
      if (!photo.naturalWidth) return;
      slide.classList.toggle("slide--portrait", photo.naturalHeight > photo.naturalWidth);
    };
    if (photo.complete) apply();
    else photo.addEventListener("load", apply, { once: true });
  }

  slides.forEach(markOrientation);

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "slider__dot" + (i === 0 ? " slider__dot--active" : "");
    dot.setAttribute("aria-label", `Go to photo ${i + 1}`);
    dot.setAttribute("role", "tab");
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  const dots = [...dotsContainer.querySelectorAll(".slider__dot")];

  function goTo(index) {
    slides[current].classList.remove("slide--active");
    dots[current].classList.remove("slider__dot--active");
    current = (index + slides.length) % slides.length;
    slides[current].classList.add("slide--active");
    dots[current].classList.add("slider__dot--active");
    resetAutoplay();
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  function resetAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(next, 5000);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  resetAutoplay();

  // Pause autoplay when user hovers slider
  slider.addEventListener("mouseenter", () => clearInterval(autoplayTimer));
  slider.addEventListener("mouseleave", resetAutoplay);

  // Keyboard navigation
  slider.setAttribute("tabindex", "0");
  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });
})();
