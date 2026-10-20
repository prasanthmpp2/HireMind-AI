import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Brain,
  Briefcase,
  ChevronDown,
  FilePlus2,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Scale,
  Settings2,
  X
} from "lucide-react";
import { api } from "../api/client";
import type { AuthUser } from "../api/types";
import { saveCandidateOwner } from "../features/candidate/resumeSync";

type Portal = "candidate" | "recruiter";
const candidateLinks = [
  { to: "/candidate", label: "Overview", icon: Gauge, end: true },
  { to: "/candidate/resume-builder", label: "Resume builder", icon: FilePlus2 },
  { to: "/candidate/resumes", label: "Saved resumes", icon: FileText },
  { to: "/candidate/profile", label: "Profile & settings", icon: Settings2 }
];
const recruiterLinks = [
  { to: "/recruiter", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/recruiter/jobs", label: "Job Openings", icon: Briefcase },
  { to: "/recruiter/screening", label: "Resume Screening", icon: FileText },
  { to: "/recruiter/matches", label: "JD Matching", icon: Scale },
  { to: "/recruiter/interviews", label: "Interview Studio", icon: MessageSquare }
];

export function WorkspaceLayout({ portal }: { portal: Portal }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isRecruiter = portal === "recruiter";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    api.session().then((sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      if (sessionUser.role === "candidate" && sessionUser.candidate_id) saveCandidateOwner({ candidateId: sessionUser.candidate_id });
      const hasRecruiterAccess = sessionUser.role === "recruiter" || sessionUser.role === "admin";
      if (isRecruiter && !hasRecruiterAccess) navigate("/candidate", { replace: true });
      if (!isRecruiter && sessionUser.role !== "candidate") navigate("/recruiter", { replace: true });
    }).catch(() => navigate("/auth", { replace: true })).finally(() => { if (active) setCheckingAuth(false); });
    return () => { active = false; };
  }, [isRecruiter, navigate]);

  const signOut = async () => { try { await api.logout(); } finally { navigate("/auth", { replace: true }); } };
  const links = isRecruiter ? recruiterLinks : candidateLinks;
  const current = [...candidateLinks, ...recruiterLinks].find((item) => item.to === location.pathname);
  const title = current?.label ?? (location.pathname.includes("/candidates/") ? "Candidate profile" : "Workspace");

  if (checkingAuth || !user || (isRecruiter && user.role === "candidate") || (!isRecruiter && user.role !== "candidate")) return <main className="auth-page" aria-busy="true"><p>Checking your secure session…</p></main>;

  return (
    <div className={`workspace ${isRecruiter ? "recruiter-workspace" : ""}`}>
      <header className="mobile-header">
        <button className="icon-button mobile-menu-button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <NavLink className="brand brand-compact" to={isRecruiter ? "/recruiter" : "/candidate"}>
          {isRecruiter ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Brain size={20} className="recruiter-brand-brain" />
              <strong style={{ color: "#fff" }}>HireMind</strong>
              <span className="recruiter-brand-badge">AI</span>
            </div>
          ) : (
            <>
              <span className="brand-mark">H</span><span>HireMind</span>
            </>
          )}
        </NavLink>
        <span className="mobile-header-title">{title}</span>
      </header>

      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${isRecruiter ? "recruiter-sidebar" : ""}`} aria-label={`${portal} navigation`}>
        {isRecruiter ? (
          <NavLink className="recruiter-brand-header" to="/recruiter" onClick={() => setMobileOpen(false)}>
            <Brain size={24} className="recruiter-brand-brain" />
            <span className="recruiter-brand-title">HireMind</span>
            <span className="recruiter-brand-badge">AI</span>
          </NavLink>
        ) : (
          <NavLink className="brand" to="/candidate" onClick={() => setMobileOpen(false)}>
            <span className="brand-mark">H</span>
            <span><strong>HireMind</strong><small>Recruitment platform</small></span>
          </NavLink>
        )}

        {!isRecruiter && (
          <div className="portal-switcher">
            <span className="portal-avatar">C</span>
            <span className="portal-switcher-copy"><strong>Candidate portal</strong><small>{user.email}</small></span>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        )}
        {!isRecruiter && <p className="nav-caption">My workspace</p>}

        <nav className={`side-nav ${isRecruiter ? "recruiter-side-nav" : ""}`}>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} end={end} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" style={{ background: "#10b981" }} />
            {isRecruiter ? "ChromaDB & Groq AI Connected" : "API connection is tested when pages load"}
          </div>
          <div className="user-chip">
            <span className="user-avatar">{isRecruiter ? "HR" : "ME"}</span>
            <span><strong>{isRecruiter ? "Recruiter" : "Candidate"}</strong><small>{user.email}</small></span>
            <button className="text-link" type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        {!isRecruiter && (
          <header className="topbar">
            <div><span className="breadcrumbs">HireMind AI <span>/</span> Candidate Portal</span><strong className="topbar-title">{title}</strong></div>
            <div className="topbar-actions">
              <span className="development-pill">{user.role}</span>
            </div>
          </header>
        )}
        <main id="main-content" className={`page-content ${isRecruiter ? "recruiter-page-content" : ""}`} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
