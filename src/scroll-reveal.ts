type RevealCallback = () => void;

const callbacks = new WeakMap<Element, RevealCallback>();
let observer: IntersectionObserver | null = null;

function isRoughlyInView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  if (viewportHeight <= 0 || viewportWidth <= 0) return true;
  // Generous hit-test so Edge/Windows reduced-motion / zoom / fractional DPR still fire.
  const verticalSlack = Math.max(48, viewportHeight * 0.12);
  const horizontalSlack = Math.max(24, viewportWidth * 0.04);
  return (
    rect.bottom >= -verticalSlack
    && rect.top <= viewportHeight + verticalSlack
    && rect.right >= -horizontalSlack
    && rect.left <= viewportWidth + horizontalSlack
  );
}

function getObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return null;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Some Edge builds are flaky with isIntersecting; also accept positive intersection ratio.
          if (!entry.isIntersecting && entry.intersectionRatio <= 0) continue;
          const onVisible = callbacks.get(entry.target);
          if (!onVisible) continue;
          onVisible();
          observer?.unobserve(entry.target);
          callbacks.delete(entry.target);
        }
      },
      // Pixel margins only (percentage rootMargin has been unreliable across Edge versions).
      // Positive bottom margin triggers a little before items fully enter the viewport.
      { threshold: [0, 0.01, 0.08, 0.2], rootMargin: "80px 0px 120px 0px" }
    );
  }
  return observer;
}

/** Observe an element once; fires as soon as it is (or becomes) on-screen. Always eventually reveals. */
export function observeReveal(element: Element, onVisible: RevealCallback): () => void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onVisible();
  };

  // Already in view (or nearly) — reveal on next frame so layout is settled.
  if (isRoughlyInView(element)) {
    const frame = window.requestAnimationFrame(() => finish());
    return () => {
      done = true;
      window.cancelAnimationFrame(frame);
    };
  }

  const activeObserver = getObserver();
  if (!activeObserver) {
    finish();
    return () => undefined;
  }

  callbacks.set(element, finish);
  activeObserver.observe(element);

  // Safety net: never leave content stuck at opacity: 0 if the observer never fires.
  const safety = window.setTimeout(() => {
    activeObserver.unobserve(element);
    callbacks.delete(element);
    finish();
  }, 1800);

  // Re-check on scroll/resize for engines that miss the first intersection callback.
  const recheck = () => {
    if (done) return;
    if (!isRoughlyInView(element)) return;
    activeObserver.unobserve(element);
    callbacks.delete(element);
    finish();
  };
  window.addEventListener("scroll", recheck, { passive: true, capture: true });
  window.addEventListener("resize", recheck, { passive: true });

  return () => {
    done = true;
    window.clearTimeout(safety);
    window.removeEventListener("scroll", recheck, true);
    window.removeEventListener("resize", recheck);
    activeObserver.unobserve(element);
    callbacks.delete(element);
  };
}
