import {
  Bookmark, BookmarkCheck, Check, ChevronDown, ChevronRight, Database, ExternalLink,
  FileCheck2, Filter, RotateCcw, Search, SlidersHorizontal, X
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { getCatalogItems, type AppRoute, type CatalogKind } from "./catalog";
import { nextOptionIndex } from "./custom-select";
import { activeCriteria, criteriaFromSearch, criteriaToSearch, defaultCriteria, legacyPublicationStatus, matchesCriteria, type CatalogCriteria } from "./criteria";
import { opportunities } from "./data";
import { revealDelay } from "./reveal";
import { observeReveal } from "./scroll-reveal";
import type { Opportunity, OpportunityFormat } from "./types";

const shortlistStorageKey = "project-pursuit-shortlist";
const allSubjects = Array.from(new Set(opportunities.flatMap((item) => item.subject_tags))).sort();
const allFormats: Array<"any" | OpportunityFormat> = ["any", "online", "in_person", "hybrid", "contact_instructor", "unknown"];

function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => (typeof initialValue === "function" ? (initialValue as () => T)() : initialValue));
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional enhancement */ } }, [key, value]);
  return [value, setValue] as const;
}

type CatalogPageProps = { route: AppRoute; header: ReactNode };

export function CatalogPage({ route, header }: CatalogPageProps) {
  const kind: CatalogKind = route === "competitions" ? "competition" : "program";
  const [criteria, setCriteria] = useState<CatalogCriteria>(() => criteriaFromSearch(window.location.search));
  const [criteriaOpen, setCriteriaOpen] = useState(() => activeCriteria(criteria).length > 0);
  const [selectedId, setSelectedId] = useState("");
  const [savedIds, setSavedIds] = useLocalStorageState<string[]>(shortlistStorageKey, []);
  const catalogItems = useMemo(() => getCatalogItems(opportunities, kind), [kind]);
  const filtered = useMemo(() => catalogItems.filter((item) => matchesCriteria(item, criteria)), [catalogItems, criteria]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const active = useMemo(() => activeCriteria(criteria), [criteria]);

  useEffect(() => {
    const search = criteriaToSearch(criteria);
    const next = `${window.location.pathname}${search}`;
    if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState({}, "", next);
  }, [criteria]);
  useEffect(() => {
    const sync = () => setCriteria(criteriaFromSearch(window.location.search));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);

  function update<K extends keyof CatalogCriteria>(key: K, value: CatalogCriteria[K]) { setCriteria((current) => ({ ...current, [key]: value })); }
  function removeCriterion(key: string) {
    if (key.startsWith("subject:")) update("subjects", criteria.subjects.filter((value) => value !== key.slice(8)));
    else if (key === "query") update("query", "");
    else if (key === "includeMissing") update("includeMissing", true);
    else setCriteria((current) => ({ ...current, [key]: "any" }));
  }
  function toggleSubject(subject: string) {
    update("subjects", criteria.subjects.includes(subject) ? criteria.subjects.filter((value) => value !== subject) : [...criteria.subjects, subject]);
  }
  function toggleSaved(id: string) { setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }

  const title = kind === "competition" ? "Competitions" : "Program Board";
  const description = kind === "competition"
    ? `${catalogItems.length} factual competition records with source traceability.`
    : `${catalogItems.length} factual summer and research program records.`;

  return <div className="app-shell">
    {header}
    <main className="catalog-page">
      <section className="catalog-intro page-reveal page-reveal--1">
        <p className="eyebrow">Project Pursuit / {kind === "competition" ? "01" : "02"}</p>
        <div><h1>{title}</h1><p>{description}</p></div>
        <span className="catalog-count">{catalogItems.length} records</span>
      </section>

      <section className={criteriaOpen ? "criteria-console open page-reveal page-reveal--2" : "criteria-console page-reveal page-reveal--2"} aria-label={`${title} factual search criteria`}>
        <div className="criteria-console__rail">
          <label className="search-field">
            <Search size={17} /><span className="sr-only">Search {title}</span>
            <input value={criteria.query} onChange={(event) => update("query", event.target.value)} placeholder={`Search ${kind === "competition" ? "competitions" : "programs"}`} />
          </label>
          <div className="criteria-console__signal"><i /><span>{filtered.length}</span><small>matching</small></div>
          <button className="criteria-toggle" type="button" aria-expanded={criteriaOpen} onClick={() => setCriteriaOpen((value) => !value)}>
            <SlidersHorizontal size={15} /><span>Criteria</span>{active.length > 0 && <b>{active.length}</b>}<ChevronDown size={14} />
          </button>
        </div>

        {active.length > 0 && <div className="criteria-active" aria-label="Active criteria">
          {active.map((item) => <button type="button" key={item.key} onClick={() => removeCriterion(item.key)}>{item.label}<X size={12} /></button>)}
          <button className="criteria-reset" type="button" onClick={() => setCriteria({ ...defaultCriteria, subjects: [] })}><RotateCcw size={12} />Reset</button>
        </div>}

        <div className="criteria-console__matrix" aria-hidden={!criteriaOpen}>
          <div className="criteria-console__matrix-head"><span><Database size={13} />Factual criteria</span><small>Missing values are {criteria.includeMissing ? "included" : "excluded"}</small></div>
          <div className="criteria-grid">
            {kind === "program" && <FilterSelect label="Subtype" value={criteria.subtype} onChange={(value) => update("subtype", value as CatalogCriteria["subtype"])} options={["any", "summer_program", "research_program", "other"]} />}
            <FilterSelect label="Grade" value={criteria.grade} onChange={(value) => update("grade", value as CatalogCriteria["grade"])} options={["any", "9", "10", "11", "12"]} />
            <FilterSelect label="Region" value={criteria.region} onChange={(value) => update("region", value as CatalogCriteria["region"])} options={["any", "shanghai_local", "mainland_china", "greater_china", "china_participation_route", "international_only"]} />
            <FilterSelect label="Format" value={criteria.format} onChange={(value) => update("format", value as CatalogCriteria["format"])} options={allFormats} />
            <FilterSelect label="Language" value={criteria.language} onChange={(value) => update("language", value as CatalogCriteria["language"])} options={["any", "English", "Chinese", "Bilingual"]} />
            <FilterSelect label="Team mode" value={criteria.teamMode} onChange={(value) => update("teamMode", value as CatalogCriteria["teamMode"])} options={["any", "individual", "team", "either"]} />
            <FilterSelect label="Cycle" value={criteria.cycleStatus} onChange={(value) => update("cycleStatus", value as CatalogCriteria["cycleStatus"])} options={["any", "open", "upcoming", "rolling", "closed", "unknown"]} />
            <FilterSelect label="Cost" value={criteria.cost} onChange={(value) => update("cost", value as CatalogCriteria["cost"])} options={["any", "free", "paid", "not_published"]} />
            <FilterSelect label="Commitment" value={criteria.commitment} onChange={(value) => update("commitment", value as CatalogCriteria["commitment"])} options={["any", "low", "medium", "high"]} />
            <FilterSelect label="Source status" value={criteria.sourceStatus} onChange={(value) => update("sourceStatus", value as CatalogCriteria["sourceStatus"])} options={["any", "official_verified", "corroborated", "partially_verified", "historical", "unverified"]} />
          </div>
          <div className="subject-selector"><span>Subjects</span><div>{allSubjects.map((subject) => <button type="button" key={subject} aria-pressed={criteria.subjects.includes(subject)} onClick={() => toggleSubject(subject)}>{subject}</button>)}</div></div>
          <label className="missing-toggle"><input type="checkbox" checked={criteria.includeMissing} onChange={(event) => update("includeMissing", event.target.checked)} /><span><i />Include records with missing values</span></label>
        </div>
      </section>

      <section className="catalog-layout page-reveal page-reveal--3" aria-label={`${title} catalog`}>
        <div className="record-board">
          <div className="board-heading"><span>{filtered.length} matching</span><span>select a record for full detail <ChevronRight size={15} /></span></div>
          {filtered.length ? filtered.map((item, index) => <ScrollReveal key={item.id} delay={revealDelay(index)}><OpportunityRow item={item} index={index + 1} selected={selected?.id === item.id} onSelect={setSelectedId} /></ScrollReveal>) : <EmptyBoard kind={kind} />}
        </div>
        <DetailPanel item={selected} saved={Boolean(selected && savedIds.includes(selected.id))} onToggleSaved={toggleSaved} />
      </section>
    </main>
    <SiteFooter savedCount={savedIds.length} />
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.indexOf(value)));
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const menuId = `filter-menu-${label.replaceAll(" ", "-").toLowerCase()}`;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function choose(index: number) { const option = options[index]; if (option) { onChange(option); setActiveIndex(index); setOpen(false); } }
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => nextOptionIndex(open ? index : selectedIndex, options.length, event.key === "ArrowDown" ? "next" : "previous")); setOpen(true); return; }
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); setActiveIndex(event.key === "Home" ? 0 : options.length - 1); setOpen(true); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(activeIndex); else { setActiveIndex(selectedIndex); setOpen(true); } }
  }
  return <div className={open ? "filter-select open" : "filter-select"} ref={containerRef}>
    <span>{label}</span><button className="filter-select__trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} onClick={() => { setActiveIndex(selectedIndex); setOpen((value) => !value); }} onKeyDown={handleKeyDown}><span>{pretty(value)}</span><ChevronDown size={15} /></button>
    {open && <div className="filter-select__menu" id={menuId} role="listbox" aria-label={label}>{options.map((option, index) => <button className={index === selectedIndex ? "filter-select__option selected" : index === activeIndex ? "filter-select__option active" : "filter-select__option"} type="button" role="option" aria-selected={index === selectedIndex} key={option} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>{pretty(option)}{index === selectedIndex && <Check size={14} />}</button>)}</div>}
  </div>;
}

const OpportunityRow = memo(function OpportunityRow({ item, index, selected, onSelect }: { item: Opportunity; index: number; selected: boolean; onSelect: (id: string) => void }) {
  return <button className={selected ? "record-row selected" : "record-row"} type="button" onClick={() => onSelect(item.id)} aria-pressed={selected}>
    <span className="record-row__index">{String(index).padStart(2, "0")}</span>
    <span className="record-row__main"><strong>{item.canonical_name}</strong><small>{item.name_zh || item.description || item.category || "Source-backed opportunity"}</small></span>
    <span className="record-row__meta"><span>{item.subject_tags.slice(0, 2).join(" · ")}</span><span>{item.deadline_text || item.date_text || item.region || "Schedule not published"}</span></span>
    <span className={`confidence-dot ${item.confidence}`} aria-label={pretty(item.publication_status ?? legacyPublicationStatus(item))} /><ChevronRight className="record-row__arrow" size={18} />
  </button>;
});

function DetailPanel({ item, saved, onToggleSaved }: { item: Opportunity | null; saved: boolean; onToggleSaved: (id: string) => void }) {
  if (!item) return <aside className="detail-panel detail-panel--empty"><Database size={22} /><h2>Nothing selected</h2><p>Choose a record to open its factual source dossier.</p></aside>;
  return <aside className="detail-panel" aria-live="polite">
    <div className="detail-panel__top"><p className="eyebrow">Selected record</p><button className={saved ? "save-button saved" : "save-button"} type="button" onClick={() => onToggleSaved(item.id)}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved" : "Save"}</button><h2>{item.canonical_name}</h2>{item.name_zh && <p className="detail-panel__alternate">{item.name_zh}</p>}<div className="detail-tags"><span>{pretty(item.type)}</span><span>{pretty(item.format)}</span><span>{item.region || "Region not published"}</span></div></div>
    <div className="detail-panel__body">
      <dl className="fact-grid">
        <Fact label="Organizer" value={item.organizer || "Not published"} /><Fact label="Deadline" value={item.deadline_text || "Not published"} /><Fact label="Date" value={item.date_text || "Not published"} /><Fact label="Eligibility" value={item.eligibility_text || "Not published"} />
        <Fact label="Location" value={[item.city, item.country].filter(Boolean).join(", ") || item.region || "Not published"} /><Fact label="Language" value={item.languages?.join(", ") || "Not published"} /><Fact label="Team mode" value={item.team_mode ? pretty(item.team_mode) : "Not published"} /><Fact label="Cost" value={item.cost_text || "Not published"} />
        <Fact label="Commitment" value={item.time_commitment ? pretty(item.time_commitment) : "Not published"} /><Fact label="Source status" value={pretty(item.publication_status ?? legacyPublicationStatus(item))} /><Fact label="Last checked" value={item.last_verified_at || "Not checked online"} />
      </dl>
      {item.description && <section className="detail-section"><h3>Overview</h3><p>{item.description}</p></section>}
      <section className="detail-section source-trace"><h3>Source trace</h3>{item.verification_note && <p className="verification-note"><FileCheck2 size={15} />{item.verification_note}</p>}{item.sources.map((source) => <div className="source-line" key={`${source.source_file}-${source.page_or_sheet}-${source.row_or_text_ref}`}><strong>{source.source_id || source.source_file}</strong><span>{source.page_or_sheet} · {source.row_or_text_ref}{source.retrieved_at ? ` · ${source.retrieved_at.slice(0, 10)}` : ""}</span></div>)}{item.website_url && <a href={item.website_url} target="_blank" rel="noreferrer">Open source site <ExternalLink size={15} /></a>}</section>
    </div>
  </aside>;
}

function ScrollReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const elementRef = useRef<HTMLDivElement>(null); const [visible, setVisible] = useState(false);
  useEffect(() => { const element = elementRef.current; if (!element || visible) return undefined; return observeReveal(element, () => setVisible(true)); }, [visible]);
  return <div className={visible ? "scroll-reveal is-visible" : "scroll-reveal"} ref={elementRef} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties} data-reveal={visible ? "visible" : "pending"}>{children}</div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <><dt>{label}</dt><dd>{value}</dd></>; }
function EmptyBoard({ kind }: { kind: CatalogKind }) { return <div className="empty-board"><Filter size={22} /><h2>No matching {kind === "competition" ? "competitions" : "programs"}</h2><p>Remove a criterion or include records with missing data.</p></div>; }
function SiteFooter({ savedCount }: { savedCount: number }) { return <footer className="site-footer"><div><OrbitMark /><strong>Project Pursuit</strong></div><p>{opportunities.length} source-backed records · {savedCount} saved</p><p>Factual opportunity data, with sources attached.</p></footer>; }
function OrbitMark() { return <span className="orbit-mark" aria-hidden="true"><i /><i /><b /></span>; }
function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
