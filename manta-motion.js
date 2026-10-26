/*!
 * Manta motion
 * Smooth scroll (Lenis) and scroll reveals (GSAP) for mantamarine.ai.
 *
 * Loads after Webflow's built-in GSAP (Site settings) and Lenis (pinned, jsDelivr).
 * Plan: docs/2026-10-26-motion-plan.md in the Manta project folder.
 *
 * Opt out on any element with data-motion="off".
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Shown once the script has run, so the head code's fallback timer isn't needed.
  function markReady() {
    root.classList.add("manta-motion-ready");
  }

  // ─────────────────────────────────────────────
  // Lenis smooth scroll
  // ─────────────────────────────────────────────
  var lenis = null;

  function navOffset() {
    // The Lumos nav is fixed; measure it live so the banner (if shown) counts too.
    var nav = document.querySelector(".nav_component");
    return nav ? nav.getBoundingClientRect().height : 0;
  }

  function startLenis() {
    if (reduceMotion || typeof window.Lenis === "undefined") return;

    lenis = new window.Lenis({
      lerp: 0.1,
      smoothWheel: true,
      autoRaf: false,
    });

    // GSAP's ticker drives Lenis so ScrollTrigger and Lenis share one frame.
    if (window.gsap) {
      if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  // ─────────────────────────────────────────────
  // Anchor links (#about, #team, skip link…)
  // Scroll below the fixed nav, then move focus to the target for keyboard users.
  // ─────────────────────────────────────────────
  function focusTarget(target) {
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function scrollToTarget(target, immediate) {
    var offset = -navOffset();
    if (lenis) {
      lenis.scrollTo(target, {
        offset: offset,
        immediate: !!immediate,
        force: true,
        onComplete: function () {
          focusTarget(target);
        },
      });
    } else {
      var top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: top, behavior: "auto" });
      focusTarget(target);
    }
  }

  function findTarget(hash) {
    if (!hash || hash === "#") return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (e) {
      return null;
    }
  }

  function bindAnchors() {
    // Webflow's own anchor scroll ignores the fixed nav and would run after ours.
    // Switch off just that handler once Webflow is ready (the navbar's close-on-tap stays).
    window.Webflow = window.Webflow || [];
    window.Webflow.push(function () {
      if (window.jQuery) window.jQuery(document).off("click.wf-scroll");
    });

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest("a[href*='#']");
      if (!link) return;
      var url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname || url.origin !== window.location.origin) return;
      var target = findTarget(url.hash);
      if (!target) return;

      event.preventDefault();
      if (window.location.hash !== url.hash) history.pushState(null, "", url.hash);

      // A tap inside the open mobile menu: let Webflow close it first, then scroll.
      var menuOpen = document.querySelector(".nav_component .w-nav-button.w--open");
      if (menuOpen) {
        setTimeout(function () {
          scrollToTarget(target);
        }, 50);
      } else {
        scrollToTarget(target);
      }
    });

    // A page opened with a hash (/#team) lands below the nav once layout settles.
    var initial = findTarget(window.location.hash);
    if (initial) {
      window.addEventListener("load", function () {
        scrollToTarget(initial, true);
      });
    }
  }

  // ─────────────────────────────────────────────
  // Mobile menu: pause Lenis while it's open.
  // Lumos already sets overflow: hidden on the body.
  // ─────────────────────────────────────────────
  function bindMenu() {
    if (!lenis) return;
    var button = document.querySelector(".nav_component .w-nav-button");
    if (!button) return;
    var sync = function () {
      if (button.classList.contains("w--open")) lenis.stop();
      else lenis.start();
    };
    new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ["class"] });
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  function init() {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    startLenis();
    bindAnchors();
    bindMenu();
    markReady();

    // Recalculate trigger positions once fonts and images have settled.
    window.addEventListener("load", function () {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });

    window.mantaMotion = { lenis: lenis, reduceMotion: reduceMotion };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
