import {
  AlertTriangle,
  Archive,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  FileSearch,
  Filter,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generatedAt, opportunities } from "./data";
import { evaluateFit, formatConfidence } from "./recommendations";
import type { Confidence, Opportunity, OpportunityFormat, Preferences } from "./types";

const allSubjects = Array.from(new Set(opportunities.flatMap((item) => item.subject_tags))).sort();
const allFormats: Array<"any" | OpportunityFormat> = ["any", "online", "in_person", "hybrid", "contact_instructor", "unknown"];
const confidenceOrder: Array<"any" | Confidence> = [
  "any",
  "verified",
  "partially_verified",
  "historical_information_only",
  "unverified",
  "needs_review"
];

const defaultPreferences: Preferences = {
  grade: "10",
  subjects: ["Mathematics"],
  format: "any",
  horizon: "any",
  goal: "any"
};

function useLocalStorageList(key: string) {
  const [value, setValue] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

export function App() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("any");
  const [format, setFormat] = useState<"any" | OpportunityFormat>("any");
  const [confidence, setConfidence] = useState<"any" | Confidence>("any");
  const [type, setType] = useState<"all" | Opportunity["type"]>("all");
  const [selectedId, setSelectedId] = useState(opportunities[0]?.id ?? "");
  const [savedIds, setSavedIds] = useLocalStorageList("project-pursuit-shortlist");
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities
      .filter((item) => (type === "all" ? true : item.type === type))
      .filter((item) => (subject === "any" ? true : item.subject_tags.includes(subject)))
      .filter((item) => (format === "any" ? true : item.format === format || item.format === "hybrid"))
      .filter((item) => (confidence === "any" ? true : item.confidence === confidence))
      .filter((item) => {
        if (!q) return true;
        return [
          item.canonical_name,
          item.name_zh,
          item.category,
          item.region,
          item.deadline_text,
          item.website_url,
          item.description
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, subject, format, confidence, type]);

  const selected = opportunities.find((item) => item.id === selectedId) ?? filtered[0] ?? opportunities[0];
  const selectedFit = selected ? evaluateFit(selected, preferences) : null;
  const saved = opportunities.filter((item) => savedIds.includes(item.id));
  const needsReview = opportunities.filter(
    (item) =>
      item.confidence === "needs_review" ||
      item.confidence === "historical_information_only" ||
      !item.deadline_text ||
      !item.website_url
  );

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  function toggleSaved(id: string) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <GraduationCap size={22} />
          </div>
          <div>
            <strong>Project Pursuit</strong>
            <span>SHSID source console</span>
          </div>
        </div>
        <nav className="nav-list">
          <a className="nav-item active" href="#catalog">
            <LayoutDashboard size={18} /> Catalog
          </a>
          <a className="nav-item" href="#recommendations">
            <Sparkles size={18} /> Fit profile
          </a>
          <a className="nav-item" href="#shortlist">
            <Bookmark size={18} /> Shortlist
          </a>
          <a className="nav-item" href="#review">
            <ListChecks size={18} /> Review queue
          </a>
        </nav>
        <div className="source-box">
          <Database size={18} />
          <div>
            <strong>{opportunities.length} records</strong>
            <span>Offline SHSID sources only</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Competition intelligence</h1>
            <p>Search verified school-source opportunities, inspect uncertainty, and build a shortlist.</p>
          </div>
          <div className="topbar-actions">
            <span className="sync-label">Generated {generatedAt ? new Date(generatedAt).toLocaleDateString() : "locally"}</span>
            <a className="button secondary" href="#review">
              <FileSearch size={16} /> Review {needsReview.length}
            </a>
          </div>
        </header>

        <section className="control-panel" aria-label="Catalog filters">
          <label className="search-box">
            <Search size={18} />
            <span className="sr-only">Search competitions</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, subject, region, source..." />
          </label>
          <div className="filter-grid">
            <Select label="Type" value={type} onChange={(value) => setType(value as typeof type)} options={["all", "competition", "summer_program"]} />
            <Select label="Subject" value={subject} onChange={setSubject} options={["any", ...allSubjects]} />
            <Select label="Format" value={format} onChange={(value) => setFormat(value as typeof format)} options={allFormats} />
            <Select label="Confidence" value={confidence} onChange={(value) => setConfidence(value as typeof confidence)} options={confidenceOrder} />
          </div>
        </section>

        <section className="content-grid">
          <div className="catalog-card" id="catalog">
            <div className="section-heading">
              <div>
                <h2>Catalog</h2>
                <p>{filtered.length} matching records from offline sources</p>
              </div>
              <FilterSummary query={query} subject={subject} format={format} confidence={confidence} />
            </div>
            {filtered.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Opportunity</th>
                      <th>Subject</th>
                      <th>Deadline</th>
                      <th>Confidence</th>
                      <th>Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const fit = evaluateFit(item, preferences);
                      const isSelected = selected?.id === item.id;
                      return (
                        <tr key={item.id} className={isSelected ? "selected-row" : ""}>
                          <td>
                            <button className="row-title" onClick={() => setSelectedId(item.id)} aria-current={isSelected ? "true" : undefined}>
                              <span>{item.canonical_name}</span>
                              {item.name_zh && <small>{item.name_zh}</small>}
                            </button>
                          </td>
                          <td>
                            <div className="tag-list">
                              {item.subject_tags.slice(0, 2).map((tag) => (
                                <span className="tag" key={tag}>{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td><DeadlineChip value={item.deadline_text} /></td>
                          <td><ConfidenceBadge confidence={item.confidence} /></td>
                          <td><FitMeter score={fit.score} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          {selected && selectedFit && (
            <aside className="detail-panel" aria-label="Selected opportunity details">
              <div className="detail-top">
                <div>
                  <h2>{selected.canonical_name}</h2>
                  {selected.name_zh && <p>{selected.name_zh}</p>}
                </div>
                <button className="button primary" onClick={() => toggleSaved(selected.id)}>
                  {savedIds.includes(selected.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  {savedIds.includes(selected.id) ? "Saved" : "Save"}
                </button>
              </div>

              <div className="fit-card" id="recommendations">
                <div className="fit-score">
                  <span>{selectedFit.score}</span>
                  <div>
                    <strong>{selectedFit.label}</strong>
                    <small>Transparent rule-based recommendation</small>
                  </div>
                </div>
                <ul>
                  {selectedFit.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                  {selectedFit.cautions.slice(0, 3).map((caution) => <li className="caution" key={caution}>{caution}</li>)}
                </ul>
              </div>

              <PreferenceForm preferences={preferences} onChange={setPreferences} />

              <dl className="fact-list">
                <Fact label="Type" value={selected.type.replace("_", " ")} />
                <Fact label="Format" value={selected.format.replace("_", " ")} />
                <Fact label="Date" value={selected.date_text || "Not specified"} />
                <Fact label="Deadline" value={selected.deadline_text || "Needs review"} />
                <Fact label="Region" value={selected.region || "Not specified"} />
                <Fact label="Preparation" value={selected.preparation || "Not specified"} />
              </dl>

              <div className="source-panel">
                <h3>Source trace</h3>
                {selected.sources.slice(0, 4).map((source) => (
                  <div className="source-item" key={`${source.source_file}-${source.page_or_sheet}`}>
                    <div>
                      <strong>{source.source_file}</strong>
                      <span>{source.page_or_sheet} · {source.row_or_text_ref}</span>
                    </div>
                    <p>{source.raw_excerpt}</p>
                  </div>
                ))}
                {selected.website_url && (
                  <a className="source-link" href={selected.website_url} target="_blank" rel="noreferrer">
                    Open listed source <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </aside>
          )}
        </section>

        <section className="lower-grid">
          <Shortlist saved={saved} onRemove={toggleSaved} />
          <ReviewQueue items={needsReview.slice(0, 8)} />
        </section>
      </main>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{pretty(option)}</option>
        ))}
      </select>
    </label>
  );
}

function FilterSummary({ query, subject, format, confidence }: { query: string; subject: string; format: string; confidence: string }) {
  return (
    <div className="filter-summary">
      <SlidersHorizontal size={16} />
      <span>{[query && `"${query}"`, subject !== "any" && subject, format !== "any" && pretty(format), confidence !== "any" && pretty(confidence)].filter(Boolean).join(" · ") || "All records"}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const icon = confidence === "partially_verified" || confidence === "verified" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />;
  return <span className={`confidence ${confidence}`}>{icon}{formatConfidence(confidence)}</span>;
}

function DeadlineChip({ value }: { value?: string }) {
  return <span className={`deadline ${value ? "" : "missing"}`}><Clock3 size={14} />{value || "Needs review"}</span>;
}

function FitMeter({ score }: { score: number }) {
  return (
    <div className="fit-meter" aria-label={`Fit score ${score}`}>
      <span style={{ width: `${score}%` }} />
      <strong>{score}</strong>
    </div>
  );
}

function PreferenceForm({ preferences, onChange }: { preferences: Preferences; onChange: (prefs: Preferences) => void }) {
  function toggleSubject(subject: string) {
    const subjects = preferences.subjects.includes(subject)
      ? preferences.subjects.filter((item) => item !== subject)
      : [...preferences.subjects, subject];
    onChange({ ...preferences, subjects });
  }

  return (
    <section className="preference-box" aria-label="Student preference form">
      <div className="mini-heading">
        <Sparkles size={16} />
        <h3>Fit profile</h3>
      </div>
      <div className="inline-fields">
        <Select label="Grade" value={preferences.grade} onChange={(grade) => onChange({ ...preferences, grade })} options={["9", "10", "11", "12"]} />
        <Select label="Goal" value={preferences.goal} onChange={(goal) => onChange({ ...preferences, goal: goal as Preferences["goal"] })} options={["any", "research", "olympiad", "writing", "business", "summer"]} />
      </div>
      <div className="subject-picker">
        {allSubjects.slice(0, 10).map((item) => (
          <button key={item} className={preferences.subjects.includes(item) ? "chip active" : "chip"} onClick={() => toggleSubject(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function Shortlist({ saved, onRemove }: { saved: Opportunity[]; onRemove: (id: string) => void }) {
  return (
    <section className="summary-panel" id="shortlist">
      <div className="section-heading">
        <div>
          <h2>Shortlist compare</h2>
          <p>{saved.length} saved opportunities</p>
        </div>
        <Archive size={19} />
      </div>
      {saved.length === 0 ? (
        <p className="panel-empty">Save competitions from the catalog to compare format, deadlines, confidence, and source coverage.</p>
      ) : (
        <div className="compare-list">
          {saved.slice(0, 5).map((item) => (
            <div className="compare-item" key={item.id}>
              <div>
                <strong>{item.canonical_name}</strong>
                <span>{item.subject_tags.join(", ")} · {item.deadline_text || "No deadline"}</span>
              </div>
              <button className="icon-button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.canonical_name}`}>
                <X size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewQueue({ items }: { items: Opportunity[] }) {
  return (
    <section className="summary-panel" id="review">
      <div className="section-heading">
        <div>
          <h2>Review queue</h2>
          <p>Records with missing critical fields or low confidence</p>
        </div>
        <AlertTriangle size={19} />
      </div>
      <div className="review-list">
        {items.map((item) => (
          <div className="review-item" key={item.id}>
            <div>
              <strong>{item.canonical_name}</strong>
              <span>{!item.deadline_text ? "Missing deadline" : !item.website_url ? "Missing website" : formatConfidence(item.confidence)}</span>
            </div>
            <ChevronRight size={17} />
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Search size={26} />
      <h3>No matching opportunities</h3>
      <p>Relax one filter or search by a broader subject. The prototype only includes offline SHSID source records.</p>
    </div>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
