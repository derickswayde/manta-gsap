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
      // Safari jumps to the hash itself after load, so correct on the next frames too.
      // Native scroll here (not Lenis), because Lenis's stored position is stale until it sees Safari's jump.
      var land = function () {
        var top = initial.getBoundingClientRect().top + window.scrollY - navOffset();
        window.scrollTo(0, Math.max(0, Math.round(top)));
      };
      window.addEventListener("load", function () {
        land();
        requestAnimationFrame(function () {
          setTimeout(land, 120);
        });
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
  // Shared helpers
  // ─────────────────────────────────────────────
  var small = window.matchMedia("(max-width: 767px)").matches;

  function on(el) {
    return el && el.getAttribute("data-motion") !== "off";
  }

  // Keep the element's own corner radius while it's clipped.
  function roundOf(el) {
    var r = getComputedStyle(el).borderTopLeftRadius;
    return r && r !== "0px" ? " round " + r : "";
  }

  function fontsReady() {
    return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  }

  // Wait for an image to be ready to paint, but never longer than `max` ms.
  function imageReady(img, max) {
    if (!img) return Promise.resolve();
    var ready = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    return Promise.race([ready, new Promise(function (r) { setTimeout(r, max); })]);
  }

  // Lines rise from behind a mask. The split is undone afterwards so text reflows on resize.
  function lineReveal(el, opts) {
    var split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "manta-line" });
    gsap.set(el, { autoAlpha: 1 });
    return gsap.from(split.lines, {
      yPercent: 130,
      duration: opts.duration,
      ease: "power3.out",
      stagger: 0.12,
      delay: opts.delay || 0,
      onComplete: function () { split.revert(); },
    });
  }

  // ─────────────────────────────────────────────
  // Nav (on load): slides down from above and fades in, with the hero wipe.
  // Measured from popupshopshop.com (also Lumos): -100%, 1s, a soft quart ease-out.
  // ─────────────────────────────────────────────
  function navIn() {
    var nav = document.querySelector(".nav_component");
    if (!on(nav)) return null;
    gsap.set(nav, { yPercent: -100, autoAlpha: 0 });
    return gsap.to(nav, {
      yPercent: 0,
      autoAlpha: 1,
      duration: small ? 0.8 : 1,
      ease: "power4.out",
      paused: true,
      clearProps: "transform,opacity,visibility",
    });
  }

  // ─────────────────────────────────────────────
  // Hero (on load): image wipe, then heading lines, then body
  // ─────────────────────────────────────────────
  function hero(nav) {
    var card = document.querySelector(".hero_card");
    if (!on(card)) {
      if (nav) nav.play();
      return;
    }
    var img = card.querySelector(".u-background-slot .u-image");
    var title = card.querySelector(".hero_title");
    var body = card.querySelector(".hero_content > .u-text");
    var round = roundOf(card);

    // Starting states, set before the reveal guard lifts.
    gsap.set(card, { clipPath: "inset(0 100% 0 0" + round + ")" });
    if (img) gsap.set(img, { scale: 1.1 });
    if (on(title)) gsap.set(title, { autoAlpha: 0 });
    if (on(body)) gsap.set(body, { autoAlpha: 0, y: small ? 20 : 50 });

    var wipe = small ? 0.8 : 1.2;
    imageReady(img, 800).then(function () {
      var tl = gsap.timeline();
      if (nav) tl.add(nav.play(), 0);
      tl.to(card, { clipPath: "inset(0 0% 0 0" + round + ")", duration: wipe, ease: "power2.inOut", clearProps: "clipPath" }, 0);
      if (img) tl.to(img, { scale: 1, duration: wipe + 0.4, ease: "power2.out", clearProps: "transform" }, 0);

      // The heading is split into lines, so it waits for the web fonts; the wipe doesn't.
      fontsReady().then(function () {
        var at = Math.max(0.5, tl.time());
        if (on(title)) tl.add(lineReveal(title, { duration: small ? 0.55 : 0.8 }), at);
        if (on(body)) tl.to(body, { autoAlpha: 1, y: 0, duration: small ? 0.5 : 1, ease: "circ.out", clearProps: "transform" }, at + 0.3);
      });
    });
  }

  // ─────────────────────────────────────────────
  // Eyebrows (on scroll): the wake line.
  // The top border draws left to right; at 75% the divider draws down;
  // then the number and label rise from a mask.
  // A border can't be drawn, so a matching line stands in for it and is removed after.
  // ─────────────────────────────────────────────
  function eyebrows() {
    if (!window.ScrollTrigger) return;
    var lineDur = small ? 0.8 : 1.2;
    var divDur = small ? 0.4 : 0.5;
    var textDur = small ? 0.5 : 0.6;

    document.querySelectorAll(".eyebrow_wrap").forEach(function (wrap) {
      if (!on(wrap)) return;
      var divider = wrap.querySelector(".eyebrow_divider");
      var texts = [wrap.querySelector(".eyebrow_number"), wrap.querySelector(".eyebrow_label")].filter(on);
      var cs = getComputedStyle(wrap);
      var width = parseFloat(cs.borderTopWidth) || 0;

      // The stand-in line, sitting exactly over the border.
      var line = null;
      if (width) {
        line = document.createElement("div");
        line.setAttribute("aria-hidden", "true");
        line.style.cssText = "position:absolute;left:0;right:0;pointer-events:none;top:-" + width + "px;height:" + width + "px;background:" + cs.borderTopColor + ";";
        if (cs.position === "static") gsap.set(wrap, { position: "relative" });
        wrap.appendChild(line);
        gsap.set(wrap, { borderTopColor: "transparent" });
        gsap.set(line, { scaleX: 0, transformOrigin: "left center" });
      }
      if (divider) gsap.set(divider, { scaleY: 0, transformOrigin: "center top" });
      if (texts.length) gsap.set(texts, { autoAlpha: 0 });

      var finish = function () {
        if (line) line.remove();
        gsap.set(wrap, { clearProps: "borderTopColor,position" });
      };

      // Text is split into masked lines, so the timeline is built once the web fonts are in.
      fontsReady().then(function () {
        var tl = gsap.timeline({ paused: true, onComplete: finish });
        if (line) tl.to(line, { scaleX: 1, duration: lineDur, ease: "power2.inOut" }, 0);
        var divAt = line ? lineDur * 0.75 : 0;
        if (divider) tl.to(divider, { scaleY: 1, duration: divDur, ease: "power2.out", clearProps: "transform,transformOrigin" }, divAt);
        var textAt = divAt + divDur * 0.7;
        texts.forEach(function (el, i) {
          tl.add(lineReveal(el, { duration: textDur }), textAt + i * 0.1);
        });
        ScrollTrigger.create({
          trigger: wrap,
          start: small ? "top 110%" : "top 105%",
          once: true,
          onEnter: function () { tl.play(); },
        });
      });
    });
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  function init() {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    startLenis();
    bindAnchors();
    bindMenu();
    var canAnimate = !reduceMotion && window.gsap && window.SplitText;
    if (canAnimate) {
      gsap.registerPlugin(SplitText);
      try { hero(navIn()); } catch (e) {
        // Never leave the nav or hero hidden if something goes wrong.
        gsap.set(".nav_component, .hero_card, .hero_card *", { clearProps: "all" });
        console.error("[manta-motion] hero", e);
      }
      try { eyebrows(); } catch (e) {
        gsap.set(".eyebrow_wrap, .eyebrow_wrap *", { clearProps: "all" });
        console.error("[manta-motion] eyebrows", e);
      }
    }
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
