# Manta motion

Smooth scroll (Lenis) and scroll reveals (GSAP) for the Manta Webflow site (mantamarine.ai, Webflow site `manta-dev`). A slim sibling of `moco-gsap`: same wipes and text reveals, no scramble.

The plan and every decision behind it: `docs/2026-10-26-motion-plan.md` in the Manta project folder.

## Loading

| What | From |
|---|---|
| GSAP, ScrollTrigger, SplitText | Webflow's built-in GSAP (Site settings). Never from a CDN. |
| Lenis 1.3.27 | jsDelivr, pinned |
| `manta-motion.js` | jsDelivr from this repo, **pinned to a commit hash**, never `@main` |

- `webflow-head.html` goes in Site settings head code: the Lenis CSS and the reveal guard.
- `webflow-body.html` goes in footer code.
- `manta-motion.min.js` is minified by jsDelivr from `manta-motion.js`. There's no build step, so the source is always what's live.

## Releasing a change

1. Edit `manta-motion.js`, commit, push.
2. Put the new commit hash in the footer code's script URL (Site settings, or the connector).
3. Publish to staging, test, then production with Derick's OK.

## Behaviour

- **Lenis** smooths the scroll, driven by GSAP's ticker so ScrollTrigger stays in sync. It doesn't start under `prefers-reduced-motion`.
- **Anchor links** (`#about`, `#analysis`, `#advantage`, `#team`, the skip link) scroll to below the fixed nav and move keyboard focus to the target. A page opened with a hash lands correctly.
- **Mobile menu:** Lenis pauses while it's open.
- **Opt out:** `data-motion="off"` on any element.
- `window.mantaMotion.lenis` exposes the instance for debugging.
