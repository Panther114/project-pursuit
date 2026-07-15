import {
  Bookmark, BookmarkCheck, Check, ChevronDown, ChevronRight, Columns2, Compass, Database, ExternalLink,
  FileCheck2, Filter, ListChecks, RotateCcw, Search, SlidersHorizontal, Sparkles, X
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { buildActionPack, buildShortlistActionPack } from "./actions";
import { getCatalogItems, type AppRoute, type CatalogKind } from "./catalog";
import { compareCompetitions } from "./compare";
import { nextOptionIndex } from "./custom-select";
import { activeCriteria, criteriaFromSearch, criteriaToSearch, defaultCriteria, legacyPublicationStatus, matchesCriteria, type CatalogCriteria } from "./criteria";
import { opportunities } from "./data";
import { pathwayEdges } from "./data/pathway-edges";
import { orderedNextSteps } from "./pathway";
import { defaultStudentProfile, recommendCompetitions, sortCompetitionsForBrowse, type StudentProfile } from "./recommend";
import { revealDelay } from "./reveal";
import { observeReveal } from "./scroll-reveal";
import type { Opportunity, OpportunityFormat } from "./types";

const shortlistStorageKey = "project-pursuit-shortlist";
const compareStorageKey = "project-pursuit-compare";
const allSubjects = Array.from(new Set(opportunities.flatMap((item) => item.subject_tags))).sort();
const allFormats: Array<"any" | OpportunityFormat> = ["any", "online", "in_person", "hybrid", "contact_instructor", "unknown"];

function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* optional enhancement */ }
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });
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
  const [compareIds, setCompareIds] = useLocalStorageState<string[]>(compareStorageKey, []);
  const [preferEvidence, setPreferEvidence] = useState(true);
  const [recommendOpen, setRecommendOpen] = useState(kind === "competition");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [profile, setProfile] = useState<StudentProfile>({ ...defaultStudentProfile, regionPreference: "china_accessible", grade: "11", subjects: ["Mathematics"], limit: 8 });
  const catalogItems = useMemo(() => getCatalogItems(opportunities, kind), [kind]);
  const filtered = useMemo(() => {
    const matched = catalogItems.filter((item) => matchesCriteria(item, criteria));
    return kind === "competition" && preferEvidence ? sortCompetitionsForBrowse(matched, true) : matched;
  }, [catalogItems, criteria, kind, preferEvidence]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const active = useMemo(() => activeCriteria(criteria), [criteria]);
  const recommendations = useMemo(
    () => (kind === "competition" ? recommendCompetitions(opportunities, profile) : null),
    [kind, profile]
  );
  const compareItems = useMemo(
    () => compareIds.map((id) => opportunities.find((item) => item.id === id)).filter((item): item is Opportunity => Boolean(item && item.type === "competition")),
    [compareIds]
  );
  const compareTable = useMemo(() => (kind === "competition" && compareItems.length >= 2 ? compareCompetitions(compareItems) : null), [kind, compareItems]);
  const savedCompetitions = useMemo(
    () => savedIds.map((id) => opportunities.find((item) => item.id === id)).filter((item): item is Opportunity => Boolean(item && item.type === "competition")),
    [savedIds]
  );
  const shortlistPacks = useMemo(
    () => (kind === "competition" ? buildShortlistActionPack(savedCompetitions, opportunities, pathwayEdges) : []),
    [kind, savedCompetitions]
  );
  const selectedActions = useMemo(
    () => (selected && kind === "competition" ? buildActionPack(selected, opportunities, pathwayEdges) : null),
    [selected, kind]
  );
  const selectedPathway = useMemo(
    () => (selected && kind === "competition" ? orderedNextSteps(selected, opportunities, pathwayEdges) : []),
    [selected, kind]
  );

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
  function toggleCompare(id: string) {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 4) return [...current.slice(1), id];
      return [...current, id];
    });
  }
  function updateProfile<K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }
  function toggleProfileSubject(subject: string) {
    setProfile((current) => ({
      ...current,
      subjects: current.subjects.includes(subject) ? current.subjects.filter((value) => value !== subject) : [...current.subjects, subject]
    }));
  }

  const title = kind === "competition" ? "Competitions" : "Program Board";
  const description = kind === "competition"
    ? `${catalogItems.length} factual competition records with China pathways, explainable recommendations, and source traceability.`
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
            <FilterSelect label="Access" value={criteria.access} onChange={(value) => update("access", value as CatalogCriteria["access"])} options={["any", "global_open", "international_selection", "regional_open"]} />
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
          {kind === "competition" && <label className="missing-toggle"><input type="checkbox" checked={preferEvidence} onChange={(event) => setPreferEvidence(event.target.checked)} /><span><i />Prefer higher-evidence / more-complete cards first</span></label>}
        </div>
      </section>

      {kind === "competition" && <section className="utility-panel page-reveal page-reveal--2" aria-label="Competition recommendation and compare utilities">
        <div className="utility-panel__head">
          <button type="button" className={recommendOpen ? "utility-tab active" : "utility-tab"} onClick={() => setRecommendOpen(true)}><Sparkles size={14} />Recommend</button>
          <button type="button" className={!recommendOpen ? "utility-tab active" : "utility-tab"} onClick={() => setRecommendOpen(false)}><Columns2 size={14} />Compare ({compareItems.length})</button>
          <button type="button" className={actionsOpen ? "utility-tab active" : "utility-tab"} onClick={() => setActionsOpen((value) => !value)}><ListChecks size={14} />Shortlist actions ({savedCompetitions.length})</button>
        </div>

        {recommendOpen && recommendations && <div className="recommend-console">
          <div className="recommend-console__profile">
            <p className="eyebrow"><Compass size={12} /> Explainable fit profile</p>
            <div className="criteria-grid">
              <FilterSelect label="Grade" value={profile.grade} onChange={(value) => updateProfile("grade", value as StudentProfile["grade"])} options={["any", "9", "10", "11", "12"]} />
              <FilterSelect label="Region preference" value={profile.regionPreference} onChange={(value) => updateProfile("regionPreference", value as StudentProfile["regionPreference"])} options={["any", "china_accessible", "china_participation_route", "mainland_china", "greater_china", "international_only"]} />
              <FilterSelect label="Format" value={profile.format} onChange={(value) => updateProfile("format", value as StudentProfile["format"])} options={allFormats} />
              <FilterSelect label="Language" value={profile.language} onChange={(value) => updateProfile("language", value as StudentProfile["language"])} options={["any", "English", "Chinese", "Bilingual"]} />
              <FilterSelect label="Team mode" value={profile.teamMode} onChange={(value) => updateProfile("teamMode", value as StudentProfile["teamMode"])} options={["any", "individual", "team", "either"]} />
              <FilterSelect label="Commitment" value={profile.commitment} onChange={(value) => updateProfile("commitment", value as StudentProfile["commitment"])} options={["any", "low", "medium", "high"]} />
              <FilterSelect label="Budget" value={profile.budget} onChange={(value) => updateProfile("budget", value as StudentProfile["budget"])} options={["any", "free", "paid_ok", "unknown_ok"]} />
            </div>
            <div className="subject-selector"><span>Interest subjects</span><div>{["Mathematics", "Computer Science", "Physics", "Biology", "Chemistry", "Economics", "Business", "Writing", "English", "Robotics", "Scientific research", "Arts"].map((subject) => <button type="button" key={subject} aria-pressed={profile.subjects.includes(subject)} onClick={() => toggleProfileSubject(subject)}>{subject}</button>)}</div></div>
            <p className="recommend-note">Scores use transparent factors only (subject, timeline, China access, commitment, cost, format/language/team, evidence). No admissions probability or opaque prestige numbers.</p>
          </div>
          <div className="recommend-console__results">
            <div className="board-heading"><span>{recommendations.recommendations.length} recommended</span><span>{recommendations.excluded.length} hard-filtered</span></div>
            {recommendations.recommendations.map((rec, index) => <button key={rec.opportunity.id} type="button" className={selected?.id === rec.opportunity.id ? "recommend-card selected" : "recommend-card"} onClick={() => setSelectedId(rec.opportunity.id)}>
              <span className="recommend-card__rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="recommend-card__body">
                <strong>{rec.opportunity.canonical_name}</strong>
                <small>{rec.opportunity.name_zh || rec.opportunity.region_tier || rec.opportunity.category}</small>
                <span className="reason-chips">{rec.reasons.slice(0, 4).map((reason) => <em key={reason}>{reason}</em>)}</span>
              </span>
              <span className="recommend-card__score"><b>{Math.round(rec.score)}</b><small>fit</small></span>
            </button>)}
          </div>
        </div>}

        {!recommendOpen && <div className="compare-console">
          <p className="recommend-note">Select up to four competitions from the board (Compare toggle on each row or detail panel). Missing fields stay labeled missing.</p>
          {compareTable ? <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>Field</th>{compareTable.items.map((item) => <th key={item.id}>{item.canonical_name}</th>)}</tr></thead><tbody>{compareTable.rows.map((row) => <tr key={row.field}><th>{row.label}</th>{row.cells.map((cell, index) => <td key={`${row.field}-${index}`} className={cell.missing ? "is-missing" : undefined}>{cell.value}</td>)}</tr>)}</tbody></table></div> : <p className="recommend-note">Add at least two competitions to compare.</p>}
        </div>}

        {actionsOpen && <div className="actions-console">
          {shortlistPacks.length === 0 ? <p className="recommend-note">Save competitions to build a shortlist action pack (registration, pathway, deadline, prep).</p> : shortlistPacks.map((pack) => <article key={pack.opportunity.id} className="action-pack">
            <h3>{pack.opportunity.canonical_name}</h3>
            <ul>{pack.actions.map((action) => <li key={`${pack.opportunity.id}-${action.title}`}><strong>{action.title}</strong><span>{action.detail}</span>{action.href && <a href={action.href} target="_blank" rel="noreferrer">Open link <ExternalLink size={12} /></a>}</li>)}</ul>
          </article>)}
        </div>}
      </section>}

      <section className="catalog-layout page-reveal page-reveal--3" aria-label={`${title} catalog`}>
        <div className="record-board">
          <div className="board-heading"><span>{filtered.length} matching</span><span>{kind === "competition" && preferEvidence ? "higher-evidence first · " : ""}select a record for full detail <ChevronRight size={15} /></span></div>
          {filtered.length ? filtered.map((item, index) => <ScrollReveal key={item.id} delay={revealDelay(index)}><OpportunityRow item={item} index={index + 1} selected={selected?.id === item.id} comparing={compareIds.includes(item.id)} onSelect={setSelectedId} onToggleCompare={kind === "competition" ? toggleCompare : undefined} /></ScrollReveal>) : <EmptyBoard kind={kind} />}
        </div>
        <DetailPanel
          item={selected}
          saved={Boolean(selected && savedIds.includes(selected.id))}
          comparing={Boolean(selected && compareIds.includes(selected.id))}
          onToggleSaved={toggleSaved}
          onToggleCompare={kind === "competition" ? toggleCompare : undefined}
          actions={selectedActions}
          pathway={selectedPathway}
        />
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

const OpportunityRow = memo(function OpportunityRow({ item, index, selected, comparing, onSelect, onToggleCompare }: { item: Opportunity; index: number; selected: boolean; comparing?: boolean; onSelect: (id: string) => void; onToggleCompare?: (id: string) => void }) {
  return <div className={selected ? "record-row selected" : "record-row"}>
    <button className="record-row__select" type="button" onClick={() => onSelect(item.id)} aria-pressed={selected}>
      <span className="record-row__index">{String(index).padStart(2, "0")}</span>
      <span className="record-row__main"><strong>{item.canonical_name}</strong><small>{item.name_zh || item.description || item.category || "Source-backed opportunity"}</small></span>
      <span className="record-row__meta"><span>{item.subject_tags.slice(0, 2).join(" · ")}</span><span>{item.deadline_text || item.date_text || item.region_tier || item.region || "Schedule not published"}</span></span>
      <span className={`confidence-dot ${item.confidence}`} aria-label={pretty(item.publication_status ?? legacyPublicationStatus(item))} /><ChevronRight className="record-row__arrow" size={18} />
    </button>
    {onToggleCompare && <button className={comparing ? "compare-chip active" : "compare-chip"} type="button" onClick={() => onToggleCompare(item.id)} aria-pressed={Boolean(comparing)}>{comparing ? "In compare" : "Compare"}</button>}
  </div>;
});

function DetailPanel({ item, saved, comparing, onToggleSaved, onToggleCompare, actions, pathway }: {
  item: Opportunity | null;
  saved: boolean;
  comparing?: boolean;
  onToggleSaved: (id: string) => void;
  onToggleCompare?: (id: string) => void;
  actions?: ReturnType<typeof buildActionPack> | null;
  pathway?: ReturnType<typeof orderedNextSteps>;
}) {
  if (!item) return <aside className="detail-panel detail-panel--empty"><Database size={22} /><h2>Nothing selected</h2><p>Choose a record to open its factual source dossier.</p></aside>;
  return <aside className="detail-panel" aria-live="polite">
    <div className="detail-panel__top">
      <p className="eyebrow">Selected record</p>
      <div className="detail-panel__actions">
        {onToggleCompare && <button className={comparing ? "save-button saved" : "save-button"} type="button" onClick={() => onToggleCompare(item.id)}><Columns2 size={16} />{comparing ? "Comparing" : "Compare"}</button>}
        <button className={saved ? "save-button saved" : "save-button"} type="button" onClick={() => onToggleSaved(item.id)}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved" : "Save"}</button>
      </div>
      <h2>{item.canonical_name}</h2>
      {item.name_zh && <p className="detail-panel__alternate">{item.name_zh}</p>}
      <div className="detail-tags">
        <span>{pretty(item.type)}</span>
        <span>{pretty(item.format)}</span>
        <span>{item.region_tier ? pretty(item.region_tier) : item.region || "Region not published"}</span>
        {item.route_type && <span>{pretty(item.route_type)}</span>}
      </div>
    </div>
    <div className="detail-panel__body">
      <dl className="fact-grid">
        <Fact label="Organizer" value={item.organizer || "Not published"} />
        <Fact label="Deadline" value={item.deadline_text || item.deadline_date || "Not published"} />
        <Fact label="Date" value={item.date_text || "Not published"} />
        <Fact label="Eligibility" value={item.eligibility_text || ((item.eligible_grades ?? []).length ? `Grades ${(item.eligible_grades ?? []).join(", ")}` : "Not published")} />
        <Fact label="Location" value={[item.city, item.country].filter(Boolean).join(", ") || item.region || "Not published"} />
        <Fact label="Language" value={item.languages?.join(", ") || "Not published"} />
        <Fact label="Team mode" value={item.team_mode ? pretty(item.team_mode) : "Not published"} />
        <Fact label="Cost" value={item.cost_text || (item.cost_amount != null ? String(item.cost_amount) : "Not published")} />
        <Fact label="Pathway" value={item.entry_pathway || "Not published"} />
        <Fact label="Commitment" value={item.time_commitment ? pretty(item.time_commitment) : "Not published"} />
        <Fact label="Source status" value={pretty(item.publication_status ?? legacyPublicationStatus(item))} />
        <Fact label="Last checked" value={item.last_verified_at || "Not checked online"} />
      </dl>
      {item.description && <section className="detail-section"><h3>Overview</h3><p>{item.description}</p></section>}
      {pathway && pathway.length > 0 && <section className="detail-section"><h3>Pathway next steps</h3><ul className="pathway-list">{pathway.map((step) => <li key={step.opportunity.id}><strong>{step.opportunity.canonical_name}</strong><span>{step.relation}{step.note ? ` — ${step.note}` : ""}</span></li>)}</ul></section>}
      {actions && actions.actions.length > 0 && <section className="detail-section"><h3>Next actions</h3><ul className="pathway-list">{actions.actions.slice(0, 6).map((action) => <li key={action.title}><strong>{action.title}</strong><span>{action.detail}</span></li>)}</ul></section>}
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
