import {
  ArrowDownRight,
  ArrowUpRight,
  Menu,
  Moon,
  Sun
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { pathForRoute, routeFromPathname, type AppRoute } from "./catalog";
import { HeroOrbitsCanvas } from "./hero-orbits-canvas";
import catalogMetadata from "./data/catalog-metadata.generated.json";

const CatalogPage = lazy(() => import("./CatalogPage").then((module) => ({ default: module.CatalogPage })));
const DreamsPage = lazy(() => import("./DreamsPage").then((module) => ({ default: module.DreamsPage })));

const themeStorageKey = "project-pursuit-theme";
/** Small generated summary keeps the full catalog out of the home-route bundle. */
const counts = catalogMetadata;

type Theme = "light" | "dark";

function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => (typeof initialValue === "function" ? (initialValue as () => T)() : initialValue));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is an enhancement only.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === '"light"' || stored === '"dark"') return JSON.parse(stored) as Theme;
  } catch {
    // Use the operating-system preference below.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPathname(window.location.pathname));
  const [theme, setTheme] = useLocalStorageState<Theme>(themeStorageKey, getInitialTheme);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPathname(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const syncMotionBudget = () => {
      document.documentElement.dataset.motion = document.hidden ? "paused" : "running";
    };
    syncMotionBudget();
    document.addEventListener("visibilitychange", syncMotionBudget);
    return () => document.removeEventListener("visibilitychange", syncMotionBudget);
  }, []);

  function navigate(nextRoute: AppRoute) {
    const nextPath = pathForRoute(nextRoute);
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTheme() {
    document.documentElement.dataset.themeTransition = "true";
    setTheme((current) => (current === "dark" ? "light" : "dark"));
    window.setTimeout(() => delete document.documentElement.dataset.themeTransition, 480);
  }

  const header = (
    <SiteHeader route={route} navigate={navigate} theme={theme} onToggleTheme={toggleTheme} overlay={route === "home"} />
  );

  if (route === "home") {
    return <LandingPage header={header} navigate={navigate} />;
  }

  if (route === "dreams") {
    return (
      <Suspense fallback={<CatalogRouteFallback header={header} />}>
        <DreamsPage header={header} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<CatalogRouteFallback header={header} />}>
      <CatalogPage route={route} header={header} />
    </Suspense>
  );
}

function LandingPage({ header, navigate }: { header: ReactNode; navigate: (route: AppRoute) => void }) {
  const landerRef = useRef<HTMLElement>(null);
  const marsVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = marsVideoRef.current;
    if (!video) return;
    const applyRate = () => {
      video.playbackRate = 1.5;
      video.defaultPlaybackRate = 1.5;
    };
    applyRate();
    video.addEventListener("loadedmetadata", applyRate);
    video.addEventListener("play", applyRate);
    return () => {
      video.removeEventListener("loadedmetadata", applyRate);
      video.removeEventListener("play", applyRate);
    };
  }, []);

  return (
    <div className="lander-shell">
      {header}
      <main className="lander" ref={landerRef} aria-label="Project Pursuit introduction">
        <div className="lander__video" aria-hidden="true">
          <video
            ref={marsVideoRef}
            className="lander__video-el"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-space-poster.jpg"
          >
            <source src="/hero-space.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="orbit-stage" aria-hidden="true">
          <HeroOrbitsCanvas motionRoot={landerRef} />
        </div>
        <div className="lander__veil" aria-hidden="true" />
        <div className="lander__stack">
          <section className="lander__content">
            <p className="eyebrow landing-reveal landing-reveal--1">Built for SHSID Students · 2026</p>
            <h1 className="landing-reveal landing-reveal--2">Find your dream worth pursuing.</h1>
            <p className="lander__lede landing-reveal landing-reveal--3">
              A source-backed menu for high-school students comparing academic competitions and selective programs.
              Explore competitions and programs, compare factual details, and follow every record back to its sources.
            </p>
            <div className="lander__actions landing-reveal landing-reveal--4">
              <button className="action action--light" type="button" onClick={() => navigate("competitions")}>
                Explore Competitions <ArrowDownRight size={18} />
              </button>
              <button className="text-action" type="button" onClick={() => navigate("programs")}>
                Explore Programs <ArrowUpRight size={16} />
              </button>
            </div>
          </section>
          <div className="lander__footer landing-reveal landing-reveal--5">
            <p>This website is an independent project and is not affiliated with, endorsed by, or officially connected to Shanghai High School International Division (SHSID). All information provided on this site is for informational and reference purposes only. While we strive for accuracy, we do not guarantee that all content is current or error-free. For official policies, announcements, or academic records, please refer to the official SHSID website or contact the school directly. Use of this site is at your own risk.</p>
            <dl>
              <div><dt>{counts.competitions}</dt><dd>Competitions</dd></div>
              <div><dt>{counts.programs}</dt><dd>Programs</dd></div>
              <div><dt>{counts.official_web_records}</dt><dd>Official web snapshots</dd></div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}

function CatalogRouteFallback({ header }: { header: ReactNode }) {
  return (
    <div className="app-shell">
      {header}
      <main className="catalog-page catalog-page--loading" aria-busy="true" aria-label="Loading catalog">
        <div className="catalog-loading-bar" />
      </main>
    </div>
  );
}

type SharedPageProps = { route: AppRoute; navigate: (route: AppRoute) => void; theme: Theme; onToggleTheme: () => void };

function SiteHeader({ route, navigate, theme, onToggleTheme, overlay = false }: SharedPageProps & { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  function go(next: AppRoute) { setOpen(false); navigate(next); }
  return (
    <header className={`site-header page-nav-enter ${overlay ? "site-header--overlay" : ""}`}>
      <button className="brand" type="button" onClick={() => go("home")} aria-label="Project Pursuit home">
        <OrbitMark />
        <span>Project Pursuit</span>
      </button>
      <button className="menu-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation"><Menu size={20} /></button>
      <nav className={open ? "site-nav site-nav--open" : "site-nav"} aria-label="Primary navigation">
        <button className={route === "home" ? "nav-link active" : "nav-link"} type="button" onClick={() => go("home")}>Home</button>
        <button className={route === "competitions" ? "nav-link active" : "nav-link"} type="button" onClick={() => go("competitions")}>Competitions</button>
        <button className={route === "programs" ? "nav-link active" : "nav-link"} type="button" onClick={() => go("programs")}>Programs</button>
        <button className={route === "dreams" ? "nav-link active" : "nav-link"} type="button" onClick={() => go("dreams")}>My Dreams</button>
        <button className="theme-button" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          <span className="theme-button__icon">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</span>
          <span className="theme-button__label">{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </nav>
    </header>
  );
}

function OrbitMark() {
  return <span className="orbit-mark" aria-hidden="true"><i /><i /><b /></span>;
}
