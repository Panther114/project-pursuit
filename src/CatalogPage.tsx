import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Filter,
  Search,
  Sparkles
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { getCatalogItems, getReviewReason, type AppRoute, type CatalogKind } from "./catalog";
import { nextOptionIndex } from "./custom-select";
import { opportunities } from "./data";
import { evaluateFit, formatConfidence } from "./recommendations";
import { revealDelay } from "./reveal";
import { observeReveal } from "./scroll-reveal";
import type { Confidence, Opportunity, OpportunityFormat, Preferences } from "./types";

const shortlistStorageKey = "project-pursuit-shortlist";
const allSubjects = Array.from(new Set(opportunities.flatMap((item) => item.subject_tags))).sort();
const allFormats: Array<"any" | OpportunityFormat> = ["any", "online", "in_person", "hybrid", "contact_instructor", "unknown"];
const confidenceOptions: Array<"any" | Confidence> = ["any", "verified", "partially_verified", "historical_information_only", "unverified", "needs_review"];
const defaultPreferences: Preferences = { grade: "10", subjects: ["Mathematics"], format: "any", horizon: "any", goal: "any" };

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

type CatalogPageProps = {
  route: AppRoute;
  header: ReactNode;
};

export function CatalogPage({ route, header }: CatalogPageProps) {
  const kind: CatalogKind = route === "competitions" ? "competition" : "program";
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("any");
  const [format, setFormat] = useState<"any" | OpportunityFormat>("any");
  const [confidence, setConfidence] = useState<"any" | Confidence>("any");
  const [selectedId, setSelectedId] = useState("");
  const [savedIds, setSavedIds] = useLocalStorageState<string[]>(shortlistStorageKey, []);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const catalogItems = useMemo(() => getCatalogItems(opportunities, kind), [kind]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalogItems.filter((item) => {
      const matchesQuery = !needle || [item.canonical_name, item.name_zh, item.description, item.category, item.region, item.deadline_text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
      return matchesQuery
        && (subject === "any" || item.subject_tags.includes(subject))
        && (format === "any" || item.format === format || item.format === "hybrid")
        && (confidence === "any" || item.confidence === confidence);
    });
  }, [catalogItems, confidence, format, query, subject]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const reviewItems = useMemo(() => getCatalogItems(opportunities, "competition").filter((item) => getReviewReason(item)), []);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  function toggleSaved(id: string) {
    setSavedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const title = kind === "competition" ? "Competitions" : "Program Board";
  const description = kind === "competition"
    ? "Fourteen SHSID-listed competitions, arranged for comparison rather than endless scrolling."
    : "Thirty-nine course-style programs, organized with the same source-first detail system.";

  return (
    <div className="app-shell">
      {header}
      <main className="catalog-page">
        <section className="catalog-intro page-reveal page-reveal--1">
          <p className="eyebrow">Project Pursuit / {kind === "competition" ? "01" : "02"}</p>
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className="catalog-count">{catalogItems.length} records</span>
        </section>

        <section className="catalog-controls page-reveal page-reveal--2" aria-label={`${title} filters`}>
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search {title}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind === "competition" ? "competitions" : "programs"}`} />
          </label>
          <FilterSelect label="Subject" value={subject} onChange={setSubject} options={["any", ...allSubjects]} />
          <FilterSelect label="Format" value={format} onChange={(value) => setFormat(value as typeof format)} options={allFormats} />
          <FilterSelect label="Source status" value={confidence} onChange={(value) => setConfidence(value as typeof confidence)} options={confidenceOptions} />
        </section>

        <section className="catalog-layout page-reveal page-reveal--3" aria-label={`${title} catalog`}>
          <div className="record-board">
            <div className="board-heading">
              <span>{filtered.length} matching</span>
              <span>select a record for full detail <ChevronRight size={15} /></span>
            </div>
            {filtered.length ? filtered.map((item, index) => (
              <ScrollReveal key={item.id} delay={revealDelay(index)}>
                <OpportunityRow item={item} index={index + 1} selected={selected?.id === item.id} onSelect={setSelectedId} />
              </ScrollReveal>
            )) : <EmptyBoard kind={kind} />}
          </div>
          <DetailPanel item={selected} preferences={preferences} onPreferencesChange={setPreferences} saved={Boolean(selected && savedIds.includes(selected.id))} onToggleSaved={toggleSaved} />
        </section>

        {kind === "competition" && <ScrollReveal><ReviewQueue items={reviewItems} /></ScrollReveal>}
      </main>
      <SiteFooter savedCount={savedIds.length} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.indexOf(value)));
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const menuId = `filter-menu-${label.replaceAll(" ", "-").toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option);
    setActiveIndex(index);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? "next" : "previous";
      setActiveIndex((index) => nextOptionIndex(open ? index : selectedIndex, options.length, direction));
      setOpen(true);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      setOpen(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else { setActiveIndex(selectedIndex); setOpen(true); }
    }
  }

  return <div className={open ? "filter-select open" : "filter-select"} ref={containerRef}>
    <span>{label}</span>
    <button className="filter-select__trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} onClick={() => { setActiveIndex(selectedIndex); setOpen((current) => !current); }} onKeyDown={handleKeyDown}>
      <span>{pretty(value)}</span><ChevronDown size={15} />
    </button>
    {open && <div className="filter-select__menu" id={menuId} role="listbox" aria-label={label}>
      {options.map((option, index) => <button className={index === selectedIndex ? "filter-select__option selected" : index === activeIndex ? "filter-select__option active" : "filter-select__option"} type="button" role="option" aria-selected={index === selectedIndex} key={option} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>{pretty(option)}{index === selectedIndex && <Check size={14} />}</button>)}
    </div>}
  </div>;
}

const OpportunityRow = memo(function OpportunityRow({ item, index, selected, onSelect }: { item: Opportunity; index: number; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button className={selected ? "record-row selected" : "record-row"} type="button" onClick={() => onSelect(item.id)} aria-pressed={selected}>
      <span className="record-row__index">{String(index).padStart(2, "0")}</span>
      <span className="record-row__main"><strong>{item.canonical_name}</strong><small>{item.name_zh || item.description || item.category || "Source-backed opportunity"}</small></span>
      <span className="record-row__meta"><span>{item.subject_tags.slice(0, 2).join(" · ")}</span><span>{item.type === "competition" ? item.deadline_text || "Deadline pending" : item.duration_text || item.date_text || item.region || "Schedule pending"}</span></span>
      <span className={`confidence-dot ${item.confidence}`} aria-label={formatConfidence(item.confidence)} />
      <ChevronRight className="record-row__arrow" size={18} />
    </button>
  );
});

function ScrollReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || visible) return undefined;
    return observeReveal(element, () => setVisible(true));
  }, [visible]);

  return (
    <div
      className={visible ? "scroll-reveal is-visible" : "scroll-reveal"}
      ref={elementRef}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      data-reveal={visible ? "visible" : "pending"}
    >
      {children}
    </div>
  );
}

function DetailPanel({ item, preferences, onPreferencesChange, saved, onToggleSaved }: { item: Opportunity | null; preferences: Preferences; onPreferencesChange: (value: Preferences) => void; saved: boolean; onToggleSaved: (id: string) => void }) {
  if (!item) return <aside className="detail-panel detail-panel--empty"><Sparkles size={22} /><h2>Nothing selected</h2><p>Choose a record to open the complete source-backed view.</p></aside>;
  const fit = evaluateFit(item, preferences);
  return (
    <aside className="detail-panel" aria-live="polite">
      <div className="detail-panel__top">
        <p className="eyebrow">Selected record</p>
        <button className={saved ? "save-button saved" : "save-button"} type="button" onClick={() => onToggleSaved(item.id)}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved" : "Save"}</button>
        <h2>{item.canonical_name}</h2>
        {item.name_zh && <p className="detail-panel__alternate">{item.name_zh}</p>}
        <div className="detail-tags"><span>{item.type === "competition" ? "Competition" : "Program"}</span><span>{pretty(item.format)}</span><span>{item.region || "Region pending"}</span></div>
      </div>
      <div className="detail-panel__body">
        <section className="detail-section detail-section--fit">
          <div><strong>{fit.score}</strong><span>{fit.label}</span></div>
          <p>{fit.reasons[0] || fit.cautions[0] || "Set a profile to see a transparent fit rationale."}</p>
        </section>
        <ProfileControls preferences={preferences} onChange={onPreferencesChange} />
        <dl className="fact-grid">
          <Fact label="Deadline" value={item.deadline_text || "Needs review"} />
          <Fact label="Date" value={item.date_text || "Not specified"} />
          <Fact label="Eligibility" value={item.eligibility_text || "Not specified"} />
          <Fact label="Preparation" value={item.preparation || "Not specified"} />
          <Fact label="Source status" value={formatConfidence(item.confidence)} />
          <Fact label="Last reviewed" value={item.last_verified_at || "Not reviewed"} />
        </dl>
        {item.description && <section className="detail-section"><h3>Overview</h3><p>{item.description}</p></section>}
        <section className="detail-section source-trace"><h3>Source trace</h3>
          {item.verification_note && <p className="verification-note"><FileCheck2 size={15} />{item.verification_note}</p>}
          {item.sources.slice(0, 3).map((source) => <div className="source-line" key={`${source.source_file}-${source.page_or_sheet}`}><strong>{source.source_file}</strong><span>{source.page_or_sheet} · {source.row_or_text_ref}</span></div>)}
          {item.website_url && <a href={item.website_url} target="_blank" rel="noreferrer">Open organizer site <ExternalLink size={15} /></a>}
        </section>
      </div>
    </aside>
  );
}

function ProfileControls({ preferences, onChange }: { preferences: Preferences; onChange: (value: Preferences) => void }) {
  function toggleSubject(subject: string) {
    const subjects = preferences.subjects.includes(subject) ? preferences.subjects.filter((value) => value !== subject) : [...preferences.subjects, subject];
    onChange({ ...preferences, subjects });
  }
  return <section className="profile-controls"><div className="profile-controls__heading"><Sparkles size={15} /><h3>Fit profile</h3></div><div className="profile-fields"><FilterSelect label="Grade" value={preferences.grade} onChange={(grade) => onChange({ ...preferences, grade })} options={["9", "10", "11", "12"]} /><FilterSelect label="Goal" value={preferences.goal} onChange={(goal) => onChange({ ...preferences, goal: goal as Preferences["goal"] })} options={["any", "research", "olympiad", "writing", "business", "summer"]} /></div><div className="subject-chips">{allSubjects.slice(0, 8).map((subject) => <button className={preferences.subjects.includes(subject) ? "subject-chip active" : "subject-chip"} type="button" onClick={() => toggleSubject(subject)} key={subject}>{subject}</button>)}</div></section>;
}

function Fact({ label, value }: { label: string; value: string }) { return <><dt>{label}</dt><dd>{value}</dd></>; }

function ReviewQueue({ items }: { items: Opportunity[] }) {
  return <section className="review-queue"><div className="review-queue__intro"><p className="eyebrow">Data stewardship</p><h2>Review queue</h2><p>Every competition has an organizer URL reviewed. These {items.length} records still need their current-cycle schedule confirmed because the school material provides historical or relative timing.</p></div><div className="review-list">{items.map((item) => <a href={item.website_url} target="_blank" rel="noreferrer" className="review-item" key={item.id}><span><strong>{item.canonical_name}</strong><small>{getReviewReason(item)}</small></span><span><Check size={15} /> {item.last_verified_at}</span><ExternalLink size={16} /></a>)}</div></section>;
}

function EmptyBoard({ kind }: { kind: CatalogKind }) { return <div className="empty-board"><Filter size={22} /><h2>No matching {kind === "competition" ? "competitions" : "programs"}</h2><p>Remove a filter or use a broader search term.</p></div>; }

function SiteFooter({ savedCount }: { savedCount: number }) {
  return (
    <footer className="site-footer">
      <div><OrbitMark /><strong>Project Pursuit</strong></div>
      <p>53 source-backed records · {savedCount} saved</p>
      <p>Built for considered choices, not admissions promises.</p>
    </footer>
  );
}

function OrbitMark() {
  return <span className="orbit-mark" aria-hidden="true"><i /><i /><b /></span>;
}

function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
