import { Bookmark, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { opportunities } from "./data";
import type { Opportunity } from "./types";

const shortlistStorageKey = "project-pursuit-shortlist";
const profileStorageKey = "project-pursuit-dreams-profile";

type DreamsProfile = {
  displayName: string;
  grade: string;
  focus: string;
  ambition: string;
  notes: string;
};

const defaultProfile: DreamsProfile = {
  displayName: "",
  grade: "10",
  focus: "",
  ambition: "",
  notes: ""
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function DreamsPage({ header }: { header: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>(() => readJson<string[]>(shortlistStorageKey, []));
  const [profile, setProfile] = useState<DreamsProfile>(() => ({ ...defaultProfile, ...readJson<Partial<DreamsProfile>>(profileStorageKey, {}) }));

  useEffect(() => {
    const sync = () => setSavedIds(readJson<string[]>(shortlistStorageKey, []));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    } catch {
      // Decorative profile only.
    }
  }, [profile]);

  const bookmarked = useMemo(() => {
    const byId = new Map(opportunities.map((item) => [item.id, item]));
    return savedIds
      .map((id) => byId.get(id))
      .filter((item): item is Opportunity => Boolean(item));
  }, [savedIds]);

  const competitions = bookmarked.filter((item) => item.type === "competition");
  const programs = bookmarked.filter((item) => item.type !== "competition");

  function updateProfile<K extends keyof DreamsProfile>(key: K, value: DreamsProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="app-shell">
      {header}
      <main className="dreams-page">
        <section className="dreams-intro page-reveal page-reveal--1">
          <p className="eyebrow">Project Pursuit / 03</p>
          <h1>My Dreams</h1>
          <p>
            A private shelf for competitions you save, plus a personal profile you can shape at your own pace.
            Profile fields are decorative for now — they do not change catalog rankings or filters.
          </p>
        </section>

        <div className="dreams-grid page-reveal page-reveal--2">
          <section className="dreams-panel" aria-label="Bookmarked opportunities">
            <div className="dreams-panel__head">
              <h2>Bookmarked</h2>
              <span>{bookmarked.length} saved</span>
            </div>
            <div className="dreams-panel__body">
              {bookmarked.length === 0 ? (
                <div className="dreams-empty">
                  <strong>Nothing saved yet</strong>
                  Open Competitions or Programs and tap Save on a record. Bookmarks appear here automatically.
                </div>
              ) : (
                <>
                  {competitions.length > 0 && competitions.map((item) => <DreamItem key={item.id} item={item} kind="Competition" />)}
                  {programs.length > 0 && programs.map((item) => <DreamItem key={item.id} item={item} kind="Program" />)}
                </>
              )}
            </div>
          </section>

          <section className="dreams-panel" aria-label="Personal profile">
            <div className="dreams-panel__head">
              <h2>Personal profile</h2>
              <span>Decorative</span>
            </div>
            <form className="dreams-profile" onSubmit={(event) => event.preventDefault()}>
              <span className="dreams-profile__badge"><Sparkles size={12} /> Stored on this device only</span>
              <label>
                <span>Display name</span>
                <input value={profile.displayName} onChange={(event) => updateProfile("displayName", event.target.value)} placeholder="What should we call you?" autoComplete="nickname" />
              </label>
              <div className="dreams-profile__row">
                <label>
                  <span>Grade</span>
                  <select value={profile.grade} onChange={(event) => updateProfile("grade", event.target.value)}>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </label>
                <label>
                  <span>Focus</span>
                  <input value={profile.focus} onChange={(event) => updateProfile("focus", event.target.value)} placeholder="Math, writing, research…" />
                </label>
              </div>
              <label>
                <span>Ambition line</span>
                <input value={profile.ambition} onChange={(event) => updateProfile("ambition", event.target.value)} placeholder="One sentence about what you are chasing" />
              </label>
              <label>
                <span>Notes to self</span>
                <textarea value={profile.notes} onChange={(event) => updateProfile("notes", event.target.value)} placeholder="Deadlines to watch, coaches to ask, ideas for later…" />
              </label>
              <p className="dreams-profile__note">
                This profile is purely visual for now. It will not filter programs, alter fit scores, or leave this browser.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

function DreamItem({ item, kind }: { item: Opportunity; kind: "Competition" | "Program" }) {
  return (
    <div className="dream-item">
      <div>
        <strong><Bookmark size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />{item.canonical_name}</strong>
        <small>{item.name_zh || item.description || item.category || "Saved opportunity"}</small>
      </div>
      <span className="dream-item__meta">{kind}</span>
    </div>
  );
}
