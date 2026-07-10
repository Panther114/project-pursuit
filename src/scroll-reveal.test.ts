/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeReveal } from "./scroll-reveal";

describe("observeReveal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("reveals immediately when the element is already in view", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 120,
      left: 0,
      right: 200,
      width: 200,
      height: 80,
      x: 0,
      y: 40,
      toJSON: () => ({})
    } as DOMRect);

    const onVisible = vi.fn();
    const stop = observeReveal(el, onVisible);

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(onVisible).toHaveBeenCalledTimes(1);
    stop();
  });

  it("eventually reveals via safety timeout when never intersecting", async () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 4000,
      bottom: 4100,
      left: 0,
      right: 200,
      width: 200,
      height: 100,
      x: 0,
      y: 4000,
      toJSON: () => ({})
    } as DOMRect);

    class FakeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const onVisible = vi.fn();
    const stop = observeReveal(el, onVisible);
    expect(onVisible).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1800);
    expect(onVisible).toHaveBeenCalledTimes(1);
    stop();
    vi.useRealTimers();
  });
});
