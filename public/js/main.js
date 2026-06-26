/* O PARIS KEBAB — interactions de la page d'accueil */
(function () {
  "use strict";

  /* --- Menu mobile : afficher/masquer les liens --- */
  var burger = document.querySelector(".nav__burger");
  var links  = document.querySelector(".nav__links");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.style.display === "flex";
      links.style.display = open ? "" : "flex";
      links.style.position = "absolute";
      links.style.top = "64px";
      links.style.left = "0";
      links.style.right = "0";
      links.style.flexDirection = "column";
      links.style.background = "#1a191c";
      links.style.padding = "16px 20px";
      links.style.gap = "14px";
      burger.setAttribute("aria-expanded", String(!open));
    });
    // Referme après un clic sur un lien (mobile)
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && window.innerWidth <= 640) {
        links.style.display = "";
      }
    });
  }

  /* --- Surligne le jour courant dans les horaires --- */
  // getDay : 0 = dimanche … 1 = lundi (fermé)
  var jour = new Date().getDay();
  var ligne = document.querySelector('.hours li[data-day="' + jour + '"]');
  if (ligne && !ligne.classList.contains("closed")) {
    ligne.classList.add("today");
  }

  /* --- Révélation au défilement (respecte prefers-reduced-motion) ---
     Le contenu est TOUJOURS visible par défaut (CSS). On n'ajoute l'effet
     d'entrée que si JS + IntersectionObserver sont disponibles. */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    var cibles = document.querySelectorAll("[data-reveal]");
    cibles.forEach(function (el) { el.classList.add("reveal--init"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("reveal--in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
    cibles.forEach(function (el) { io.observe(el); });
  }
})();
