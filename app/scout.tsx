"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Database,
  Filter,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  Radio,
  LogOut,
} from "lucide-react";
import { useDialogFocus } from "./use-dialog-focus";
import {
  defaultProfile,
  classifications,
  type Evaluation,
  type Profile,
} from "@/lib/domain";
type Job = {
  id: string;
  title: string;
  url: string;
  description: string;
  company: { name: string };
  location: string | null;
  workplace: string | null;
  employment: string | null;
  compensation: string | null;
  deadline: string | null;
  closed: boolean;
  saved: boolean;
  notes: string;
  evaluation: Evaluation;
  sources: {
    url: string;
    verifiedAt: string;
    source: { provider: string; company: string };
  }[];
  overrides: { classification: string; reason: string }[];
};
type Source = {
  id: string;
  provider: string;
  company: string;
  board: string;
  enabled: boolean;
  lastChecked: string | null;
  lastError: string | null;
};
type Run = {
  id: string;
  status: string;
  startedAt: string;
  results: {
    company: string;
    provider: string;
    count: number;
    error?: string;
  }[];
};
type Data = { profile: Profile; jobs: Job[]; sources: Source[]; runs: Run[] };
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Discover jobs", icon: Compass },
  { name: "Saved opportunities", icon: Bookmark },
  { name: "Sources", icon: Database },
  { name: "Profile & preferences", icon: Settings2 },
];
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function status(j: Job) {
  return j.overrides[0]?.classification || j.evaluation.classification;
}
export default function Scout() {
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState("Overview"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [auth, setAuth] = useState(false),
    [query, setQuery] = useState(""),
    [eligibility, setEligibility] = useState("Recommended"),
    [remote, setRemote] = useState(false),
    [internships, setInternships] = useState(true),
    [visibleCount, setVisibleCount] = useState(40),
    [selected, setSelected] = useState<Job | null>(null),
    [modal, setModal] = useState<"import" | "source" | null>(null),
    [manual, setManual] = useState(false),
    [profile, setProfile] = useState<Profile>(defaultProfile);
  useDialogFocus(!!modal || !!selected, () => {
    setModal(null);
    setSelected(null);
  });
  async function load() {
    const res = await fetch("/api/scout");
    const body = await res.json();
    if (res.status === 401) {
      setAuth(true);
      return;
    }
    if (!res.ok) throw new Error(body.error);
    setAuth(false);
    setData(body);
    setProfile(body.profile);
    setSelected((prev) =>
      prev ? body.jobs.find((j: Job) => j.id === prev.id) || null : null,
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(action: string, input: unknown) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, data: input }),
        }),
        body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await load();
      setNotice(
        action === "discover"
          ? `Discovery finished. ${body.results.reduce((n: number, r: { count: number }) => n + r.count, 0)} relevant postings checked. ${body.results.filter((r: { error?: string }) => r.error).length} source errors.`
          : "Changes saved.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy("");
    }
  }
  const jobs = data?.jobs || [],
    sources = data?.sources || [],
    recommended = jobs.filter(
      (j) =>
        !j.closed &&
        !["Ineligible", "Manual Review Required"].includes(status(j)) &&
        /\bintern(?:ship)?\b/i.test(`${j.title} ${j.employment || ""}`),
    ),
    saved = jobs.filter((j) => j.saved);
  const filtered = (page === "Saved opportunities" ? saved : jobs)
    .filter(
      (j) =>
        `${j.title} ${j.company.name} ${j.description}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!remote || j.workplace?.toLowerCase() === "remote") &&
        (page === "Saved opportunities" ||
          !internships ||
          /\bintern(?:ship)?\b/i.test(`${j.title} ${j.employment || ""}`)) &&
        (eligibility === "All statuses" ||
          (eligibility === "Recommended"
            ? !j.closed &&
              !["Ineligible", "Manual Review Required"].includes(status(j))
            : status(j) === eligibility)),
    )
    .sort((a, b) => b.evaluation.score - a.evaluation.score);
  const recent = data?.runs[0];
  useEffect(
    () => setVisibleCount(40),
    [query, eligibility, remote, internships, page],
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  function JobCard({ job: j }: { job: Job }) {
    return (
      <article className="job-card">
        <div className="company-mark">
          {j.company.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="job-main">
          <div className="eyebrow">
            {j.company.name}
            <span className="source-label">
              {j.sources[0]?.source.provider || "import"}
            </span>
          </div>
          <button className="job-title" onClick={() => setSelected(j)}>
            {j.title}
          </button>
          <div className="job-meta">
            <span>{j.location || "Location unknown"}</span>
            <span>{j.workplace || "Workplace unknown"}</span>
            <span>{j.employment || "Schedule unknown"}</span>
          </div>
          <div className="job-tags">
            <span
              className={`badge ${status(j) === "Ineligible" ? "red" : status(j) === "Verified Eligible" ? "green" : ""}`}
            >
              {status(j)}
            </span>
            {j.closed && <span className="badge red">Closed</span>}
            {j.evaluation.matchedSkills.slice(0, 3).map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="job-right">
          <div className="score">
            {j.evaluation.score}
            <span>/100 fit</span>
          </div>
          <button
            className={`icon-button ${j.saved ? "is-saved" : ""}`}
            disabled={!!busy}
            onClick={() => act("save", { id: j.id, saved: !j.saved })}
            aria-label={j.saved ? "Unsave opportunity" : "Save opportunity"}
          >
            <Bookmark size={18} fill={j.saved ? "currentColor" : "none"} />
          </button>
        </div>
      </article>
    );
  }
  if (auth)
    return (
      <main className="login">
        <div className="brand">
          <Compass />
          scout<span>✳</span>
        </div>
        <h1>Your career workspace.</h1>
        <p>Sign in to your private Scout instance.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const password = new FormData(e.currentTarget).get("password");
            const res = await fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
            const b = await res.json();
            if (res.ok) load();
            else setError(b.error);
          }}
        >
          <Field label="Workspace password">
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <button className="primary">
            Sign in <ArrowRight size={16} />
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Scout home">
          <Compass size={29} />
          scout<span>✳</span>
        </a>
        <div className="workspace">
          <span className="avatar">{profile.name?.[0] || "S"}</span>
          <div>
            <strong>
              {profile.name
                ? `${profile.name.split(" ")[0]}'s workspace`
                : "Personal workspace"}
            </strong>
            <small>YOUR NEXT CHAPTER</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setEligibility(
                  name === "Saved opportunities"
                    ? "All statuses"
                    : "Recommended",
                );
              }}
            >
              <Icon size={18} />
              {name}
              {name === "Saved opportunities" && (
                <span className="nav-count">{saved.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <ShieldCheck size={19} />
            <strong>Quality over quantity.</strong>
            <p>Every recommendation starts with your eligibility.</p>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setPage("Profile & preferences");
            }}
          >
            <CircleHelp size={16} /> Make Scout yours
          </button>
          <div className="local-status">
            <span /> Personal discovery workspace
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={13} /> <strong>{page}</strong>
          </span>
          <div>
            <span className="phase-chip">DISCOVERY · V0.1</span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await fetch("/api/session", { method: "DELETE" });
                setAuth(true);
              }}
            >
              <LogOut size={16} />
            </button>
            <span className="avatar small">{profile.name?.[0] || "S"}</span>
          </div>
        </header>
        <div className="page-content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="kicker">
                <span /> YOUR CAREER, IN MOTION
              </div>
              <h1>
                {page === "Overview"
                  ? `A little closer to what's next.`
                  : page === "Discover jobs"
                    ? "Find your next opportunity."
                    : page === "Saved opportunities"
                      ? "Good opportunities. Kept close."
                      : page === "Sources"
                        ? "Go straight to the source."
                        : "Built around you."}
              </h1>
              <p>
                {page === "Overview"
                  ? "Discover thoughtfully. Know your fit. Make your next move."
                  : page === "Sources"
                    ? "Connect public employer boards. Scout handles the sorting."
                    : page === "Profile & preferences"
                      ? "Your confirmed facts keep every recommendation grounded."
                      : "Real openings, clear evidence, and room for your next chapter."}
              </p>
            </div>
            {!["Profile & preferences", "Sources"].includes(page) && (
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => setModal("import")}
                >
                  <Plus size={16} />
                  Import job
                </button>
                <button
                  className="primary"
                  disabled={!!busy || !sources.some((s) => s.enabled)}
                  onClick={() => act("discover", {})}
                >
                  {busy === "discover" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Radio size={16} />
                  )}{" "}
                  {busy === "discover" ? "Discovering…" : "Run discovery"}
                </button>
              </div>
            )}
          </section>
          {!data && !error && (
            <div className="empty">
              <LoaderCircle className="spin" />
              <h3>Opening your workspace…</h3>
            </div>
          )}
          {page === "Overview" && data && (
            <>
              <section className="hero">
                <div>
                  <div className="hero-label">
                    <Sparkles size={15} /> A MORE INTENTIONAL SEARCH
                  </div>
                  <h2>
                    The right opportunity.
                    <br />
                    Not just another opening.
                  </h2>
                  <p>
                    Scout brings real roles into one place, checks the
                    <br className="desktop" /> requirements, and helps you see
                    where you fit.
                  </p>
                  <button
                    className="hero-link"
                    onClick={() => setPage("Discover jobs")}
                  >
                    Explore your opportunities <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="orbit" aria-hidden="true">
                  <div className="orbit-ring r1" />
                  <div className="orbit-ring r2" />
                  <div className="orbit-ring r3" />
                  <div className="orbit-center">
                    <Compass size={52} />
                  </div>
                  <span className="orbit-label label-one">
                    <Check size={14} /> Your skills
                  </span>
                  <span className="orbit-label label-two">
                    <BriefcaseBusiness size={14} /> Your next role
                  </span>
                  <span className="orbit-dot" />
                </div>
              </section>
              <section className="stats">
                {[
                  {
                    label: "Opportunities discovered",
                    n: jobs.length,
                    note: "Across your connected sources",
                    icon: Compass,
                  },
                  {
                    label: "Worth a closer look",
                    n: recommended.length,
                    note: "No confirmed eligibility conflict",
                    icon: ShieldCheck,
                  },
                  {
                    label: "Saved for later",
                    n: saved.length,
                    note: "Your personal shortlist",
                    icon: Bookmark,
                  },
                  {
                    label: "Connected sources",
                    n: sources.filter((s) => s.enabled).length,
                    note: "Public employer job boards",
                    icon: Database,
                  },
                ].map(({ label, n, note, icon: Icon }) => (
                  <div className="stat" key={label}>
                    <div>
                      {label}
                      <Icon size={17} />
                    </div>
                    <strong>{n.toString().padStart(2, "0")}</strong>
                    <small>{note}</small>
                  </div>
                ))}
              </section>
              <div className="overview-grid">
                <section>
                  <div className="section-heading">
                    <h2>
                      Your next moves{" "}
                      <span className="count">
                        {!profile.university ? 1 : 0}
                      </span>
                    </h2>
                    <span>START HERE</span>
                  </div>
                  <div className="next-moves">
                    {!profile.university && (
                      <button onClick={() => setPage("Profile & preferences")}>
                        <span className="step-number">01</span>
                        <div>
                          <strong>Tell Scout what you're looking for</strong>
                          <p>
                            Confirm your education, experience, and
                            availability.
                          </p>
                        </div>
                        <ArrowRight size={18} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        sources.some((s) => s.enabled)
                          ? setPage("Discover jobs")
                          : setPage("Sources")
                      }
                    >
                      <span className="step-number">
                        {!profile.university ? "02" : "01"}
                      </span>
                      <div>
                        <strong>
                          {sources.some((s) => s.enabled)
                            ? "Review your discovery queue"
                            : "Connect your first job board"}
                        </strong>
                        <p>
                          {sources.some((s) => s.enabled)
                            ? `${recommended.length} opportunities have no confirmed conflict. Review their unknowns.`
                            : "Add Greenhouse, Lever, or Ashby employer boards."}
                        </p>
                      </div>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <div className="section-heading spaced">
                    <h2>On your radar</h2>
                    <button
                      className="text-button"
                      onClick={() => setPage("Discover jobs")}
                    >
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  {recommended.length ? (
                    recommended
                      .sort((a, b) => b.evaluation.score - a.evaluation.score)
                      .slice(0, 3)
                      .map((j) => <JobCard job={j} key={j.id} />)
                  ) : (
                    <div className="empty">
                      <Compass size={30} />
                      <h3>Your next chapter starts here.</h3>
                      <p>
                        Connect a source and run discovery to find real
                        openings.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setPage("Sources")}
                      >
                        Set up sources <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <aside className="activity-panel">
                  <div className="section-heading">
                    <h2>Discovery activity</h2>
                    <span className="live-dot" />
                  </div>
                  {recent ? (
                    <>
                      <div className="activity-item">
                        <span className="activity-dot" />
                        <div>
                          <strong>Discovery {recent.status}</strong>
                          <p>{new Date(recent.startedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {recent.results.map((r, i) => (
                        <div className="activity-item" key={i}>
                          <span
                            className={`activity-dot ${r.error ? "failed" : ""}`}
                          />
                          <div>
                            <strong>{r.company}</strong>
                            <p>
                              {r.error ||
                                `${r.count} relevant postings checked`}
                            </p>
                            <small>{r.provider}</small>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="activity-empty">
                      <Radio size={22} />
                      <p>No runs yet.</p>
                      <small>Your discovery history will appear here.</small>
                    </div>
                  )}
                  <div className="note">
                    <ShieldCheck size={20} />
                    <h3>A match is a starting point.</h3>
                    <p>
                      Unknown requirements stay visible. Always review the
                      original posting before applying.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {["Discover jobs", "Saved opportunities"].includes(page) && (
            <>
              <div className="filter-bar">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search opportunities"
                    placeholder="Search roles, companies, or skills…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Eligibility filter"
                  value={eligibility}
                  onChange={(e) => setEligibility(e.target.value)}
                >
                  {["Recommended", "All statuses", ...classifications].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                  />{" "}
                  Remote
                </label>
                {page !== "Saved opportunities" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={internships}
                      onChange={(e) => setInternships(e.target.checked)}
                    />{" "}
                    Internships
                  </label>
                )}
                <Filter size={17} />
              </div>
              <div className="results-label">
                <span>{filtered.length} opportunities</span>
                <span>Sorted by fit score</span>
              </div>
              {filtered.slice(0, visibleCount).map((j) => (
                <JobCard job={j} key={j.id} />
              ))}
              {filtered.length > visibleCount && (
                <button
                  className="secondary"
                  onClick={() => setVisibleCount((n) => n + 40)}
                >
                  Show more opportunities
                </button>
              )}
              {!filtered.length && (
                <div className="empty">
                  <Search size={32} />
                  <h3>No opportunities in this view.</h3>
                  <p>
                    Try another filter, import a posting, or run discovery from
                    your sources.
                  </p>
                </div>
              )}
            </>
          )}
          {page === "Sources" && (
            <>
              <div className="section-heading">
                <h2>Employer job boards</h2>
                <button className="primary" onClick={() => setModal("source")}>
                  <Plus size={16} /> Add source
                </button>
              </div>
              <div className="source-grid">
                {sources
                  .filter((s) => s.provider !== "manual")
                  .map((s) => (
                    <article className="source-card" key={s.id}>
                      <div className="source-top">
                        <div className="company-mark">
                          {s.company.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`badge ${s.enabled ? "green" : ""}`}>
                          {s.enabled ? "Enabled" : "Paused"}
                        </span>
                      </div>
                      <h3>{s.company}</h3>
                      <p>
                        {s.provider} / {s.board}
                      </p>
                      <small>
                        {s.lastChecked
                          ? `Checked ${new Date(s.lastChecked).toLocaleString()}`
                          : "Not checked yet"}
                      </small>
                      {s.lastError && <p className="error">{s.lastError}</p>}
                      <button
                        className="secondary"
                        disabled={!!busy}
                        onClick={() =>
                          act("toggleSource", { id: s.id, enabled: !s.enabled })
                        }
                      >
                        {s.enabled ? "Pause source" : "Enable source"}
                      </button>
                    </article>
                  ))}
              </div>
              {!sources.filter((s) => s.provider !== "manual").length && (
                <div className="empty">
                  <Database size={32} />
                  <h3>Choose the companies you want to follow.</h3>
                  <p>
                    Add an employer's public board identifier from its careers
                    URL.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setModal("source")}
                  >
                    <Plus size={16} /> Connect a board
                  </button>
                </div>
              )}
              <div className="info-panel">
                <h3>Three sources. One thoughtful shortlist.</h3>
                <p>
                  Greenhouse, Lever, and Ashby expose public employer boards. A
                  board identifier comes from the employer's careers URL—for
                  example, jobs.lever.co/<strong>company-name</strong>. These
                  are employer-specific feeds, not a search across every
                  company.
                </p>
                <button
                  className="secondary"
                  disabled={!!busy || !sources.some((s) => s.enabled)}
                  onClick={() => act("discover", {})}
                >
                  <RefreshCw
                    className={busy === "discover" ? "spin" : ""}
                    size={16}
                  />{" "}
                  {busy === "discover" ? "Discovering…" : "Run discovery"}
                </button>
              </div>
              <div className="section-heading spaced">
                <h2>Recent runs</h2>
              </div>
              {data?.runs.map((r) => (
                <div className="run-row" key={r.id}>
                  <span>{new Date(r.startedAt).toLocaleString()}</span>
                  <span className="badge">{r.status}</span>
                  <span>
                    {r.results.reduce((n, x) => n + x.count, 0)} checked
                  </span>
                </div>
              ))}
            </>
          )}
          {page === "Profile & preferences" && (
            <form
              className="profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                act("profile", profile);
              }}
            >
              <div className="info-panel">
                <ShieldCheck size={20} />
                <div>
                  <strong>Your facts are the source of truth.</strong>
                  <p>
                    Enter only confirmed information. Leave unknown
                    authorization and experience fields blank. Saving
                    reevaluates your opportunities.
                  </p>
                </div>
              </div>
              <section className="form-section">
                <h2>A little about you</h2>
                <div className="form-grid">
                  <Field label="Name">
                    <input
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="University">
                    <input
                      value={profile.university}
                      onChange={(e) =>
                        setProfile({ ...profile, university: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Expected graduation year">
                    <input
                      type="number"
                      min="2020"
                      max="2045"
                      value={profile.graduationYear ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          graduationYear: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </Field>
                  <Field label="Currently enrolled">
                    <select
                      value={
                        profile.enrolled === null
                          ? "unknown"
                          : String(profile.enrolled)
                      }
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          enrolled:
                            e.target.value === "unknown"
                              ? null
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="unknown">Not confirmed</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <Field label="Completed a university degree">
                    <select
                      value={
                        profile.completedDegree === null
                          ? "unknown"
                          : String(profile.completedDegree)
                      }
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          completedDegree:
                            e.target.value === "unknown"
                              ? null
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="unknown">Not confirmed</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <Field label="Years of professional employment">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      placeholder="Unknown — exclude student projects"
                      value={profile.professionalYears ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          professionalYears: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      value={profile.location}
                      onChange={(e) =>
                        setProfile({ ...profile, location: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Technical skills (comma separated)">
                  <input
                    value={profile.skills.join(", ")}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        skills: e.target.value
                          .split(",")
                          .map((s) => s.trimStart()),
                      })
                    }
                    onBlur={() =>
                      setProfile({
                        ...profile,
                        skills: profile.skills
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Verified work experience">
                  <textarea
                    rows={4}
                    value={profile.experience}
                    onChange={(e) =>
                      setProfile({ ...profile, experience: e.target.value })
                    }
                  />
                </Field>
                <Field label="Projects (kept separate from professional experience)">
                  <textarea
                    rows={4}
                    value={profile.projects}
                    onChange={(e) =>
                      setProfile({ ...profile, projects: e.target.value })
                    }
                  />
                </Field>
              </section>
              <section className="form-section">
                <h2>What works for you</h2>
                <Field label="Target roles (comma separated)">
                  <input
                    value={profile.roles.join(", ")}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        roles: e.target.value
                          .split(",")
                          .map((s) => s.trimStart()),
                      })
                    }
                    onBlur={() =>
                      setProfile({
                        ...profile,
                        roles: profile.roles
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Internship period">
                    <select
                      value={profile.period}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          period: e.target.value as Profile["period"],
                        })
                      }
                    >
                      <option value="semester">Academic semester</option>
                      <option value="summer">Summer</option>
                    </select>
                  </Field>
                  <Field label="Maximum hours per week">
                    <input
                      type="number"
                      min="1"
                      max="80"
                      value={profile.maxHours}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          maxHours: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Work authorization in target country">
                    <select
                      value={
                        profile.authorized === null
                          ? "unknown"
                          : String(profile.authorized)
                      }
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          authorized:
                            e.target.value === "unknown"
                              ? null
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="unknown">Not supplied</option>
                      <option value="true">Authorized</option>
                      <option value="false">Not authorized</option>
                    </select>
                  </Field>
                  <Field label="Citizenship (optional)">
                    <input
                      value={profile.citizenship}
                      onChange={(e) =>
                        setProfile({ ...profile, citizenship: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={profile.remoteOnly}
                    onChange={(e) =>
                      setProfile({ ...profile, remoteOnly: e.target.checked })
                    }
                  />{" "}
                  Require remote work
                </label>
              </section>
              <section className="form-section">
                <h2>Fit score weights</h2>
                <p>
                  Weights must add up to 100. Unknown signals never receive full
                  credit.
                </p>
                <div className="weights">
                  {Object.entries(profile.weights).map(([key, value]) => (
                    <Field key={key} label={key}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            weights: {
                              ...profile.weights,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </section>
              <button disabled={!!busy} className="primary">
                {busy === "profile" ? "Saving…" : "Save profile & reevaluate"}{" "}
                <Check size={16} />
              </button>
            </form>
          )}
          <footer>
            <span>
              scout <span className="muted">/</span> Find work that moves you
              forward.
            </span>
            <span>Evidence first. Always.</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "source" ? "Add source" : "Import job"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>
                {modal === "source"
                  ? "Connect an employer board"
                  : "Bring an opportunity to Scout"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            <p className="muted">
              {modal === "source"
                ? "Use the employer board identifier from its public careers URL."
                : "Import a Greenhouse, Lever, or Ashby posting, or paste a job description."}
            </p>
            {modal === "import" && (
              <div className="tabs">
                <button
                  className={!manual ? "active" : ""}
                  onClick={() => setManual(false)}
                >
                  ATS URL
                </button>
                <button
                  className={manual ? "active" : ""}
                  onClick={() => setManual(true)}
                >
                  Manual text
                </button>
              </div>
            )}
            <form
              onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                if (
                  await act(
                    modal === "source"
                      ? "source"
                      : manual
                        ? "manual"
                        : "import",
                    values,
                  )
                )
                  setModal(null);
              }}
            >
              {modal === "source" ? (
                <>
                  <Field label="Provider">
                    <select name="provider">
                      <option value="greenhouse">Greenhouse</option>
                      <option value="lever">Lever</option>
                      <option value="ashby">Ashby</option>
                    </select>
                  </Field>
                  <Field label="Company name">
                    <input name="company" required placeholder="Company name" />
                  </Field>
                  <Field label="Board identifier">
                    <input
                      name="board"
                      required
                      pattern="[a-zA-Z0-9_-]+"
                      placeholder="company-name"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Original job URL">
                    <input
                      type="url"
                      name="url"
                      required
                      placeholder="https://jobs.ashbyhq.com/company/job-id"
                    />
                  </Field>
                  {manual && (
                    <>
                      <Field label="Company">
                        <input name="company" required />
                      </Field>
                      <Field label="Role title">
                        <input name="title" required minLength={3} />
                      </Field>
                      <Field label="Full posting description">
                        <textarea
                          name="description"
                          rows={7}
                          required
                          minLength={50}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button disabled={!!busy} className="primary">
                {busy
                  ? "Working…"
                  : modal === "source"
                    ? "Connect source"
                    : "Import & evaluate"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <section
            className="detail"
            role="dialog"
            aria-modal="true"
            aria-label="Opportunity details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <span className="eyebrow">{selected.company.name}</span>
              <button
                aria-label="Close details"
                className="icon-button"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>
            <h2>{selected.title}</h2>
            <div className="job-tags">
              <span className="badge">{status(selected)}</span>
              <span className="tag">{selected.evaluation.score}/100 fit</span>
              {selected.closed && <span className="badge red">Closed</span>}
            </div>
            <p>
              {selected.location || "Location unknown"} ·{" "}
              {selected.compensation || "Compensation unknown"}
            </p>
            <a
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={selected.url}
            >
              View original posting <ArrowUpRight size={16} />
            </a>
            <section className="detail-section">
              <h3>Why this classification?</h3>
              {selected.evaluation.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
              {selected.overrides[0] && (
                <p className="note">
                  User override: {selected.overrides[0].reason}. Engine result:{" "}
                  {selected.evaluation.classification}.
                </p>
              )}
              {selected.evaluation.evidence.map((e, i) => (
                <blockquote key={i}>
                  <strong>{e.rule}</strong>
                  <br />
                  {e.quote}
                </blockquote>
              ))}
              <h3>Still needs verification</h3>
              <ul>
                {selected.evaluation.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
              <h3>Fit score breakdown</h3>
              {Object.entries(selected.evaluation.components).map(([k, v]) => (
                <div className="score-row" key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </section>
            <section className="detail-section">
              <h3>Original description</h3>
              <p className="description">
                {selected.description ||
                  "Description unavailable from this source."}
              </p>
              {selected.sources.map((s, i) => (
                <p className="muted" key={i}>
                  Source:{" "}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.source.provider}
                  </a>{" "}
                  · Checked {new Date(s.verifiedAt).toLocaleString()}
                </p>
              ))}
            </section>
            <form
              className="detail-section"
              onSubmit={(e) => {
                e.preventDefault();
                act("notes", {
                  id: selected.id,
                  notes: new FormData(e.currentTarget).get("notes"),
                });
              }}
            >
              <Field label="Your notes">
                <textarea
                  key={`${selected.id}-${selected.notes}`}
                  name="notes"
                  rows={3}
                  defaultValue={selected.notes}
                />
              </Field>
              <button className="secondary" disabled={!!busy}>
                Save notes
              </button>
            </form>
            <form
              className="detail-section"
              onSubmit={(e) => {
                e.preventDefault();
                act("override", {
                  id: selected.id,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <h3>Record a reviewed classification</h3>
              <p className="muted">
                Only mark verified after reviewing every applicable requirement.
                Your explanation is saved with the original evaluation.
              </p>
              <Field label="Classification">
                <select name="classification">
                  {classifications.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Supporting evidence and explanation">
                <textarea name="reason" minLength={10} required rows={3} />
              </Field>
              <button className="secondary" disabled={!!busy}>
                Save reviewed classification
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
