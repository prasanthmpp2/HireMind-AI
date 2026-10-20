import { ArrowRight, BrainCircuit, BriefcaseBusiness, FileText, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  "Job description management",
  "Single and batch resume screening",
  "Explainable candidate matching",
  "Interview kit generation, copy and print",
];

export function LandingPage() {
  return (
    <main className="public-page">
      <header className="public-nav">
        <Link className="public-brand" to="/" aria-label="HireMind AI home">
          <span className="public-brand-mark"><BrainCircuit size={21} /></span>
          <span><strong>HireMind AI</strong><small>All-in-One Recruitment Platform</small></span>
        </Link>
        <div className="public-nav-actions">
          <Link className="public-signin-link" to="/auth">Sign in</Link>
          <Link className="button button-primary" to="/auth?portal=candidate&mode=register">Create candidate account <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-kicker"><Sparkles size={14} /> One platform. Two user experiences.</span>
          <h1>Build a stronger resume.<br /><span>Make hiring clearer.</span></h1>
          <p>HireMind brings resume building and recruiter workflows together, with job-related AI support and people in control of every hiring decision.</p>
        </div>
        <div className="public-portal-grid">
          <article className="public-portal-card">
            <div className="public-card-icon candidate-icon"><UserRound size={21} /></div>
            <p className="eyebrow">For candidates</p>
            <h2>Candidate Portal</h2>
            <p className="public-card-summary">Create, refine, and manage your resume in one workspace.</p>
            <ul><li><FileText size={15} /> Resume builder and live preview</li><li><Sparkles size={15} /> AI writing assistance</li><li><ShieldCheck size={15} /> Local autosave and account sync</li></ul>
            <Link className="button button-primary public-card-action" to="/auth?portal=candidate&mode=register">Create candidate account <ArrowRight size={15} /></Link>
            <Link className="public-secondary-link" to="/auth?portal=candidate">Already have an account? Sign in</Link>
          </article>
          <article className="public-portal-card">
            <div className="public-card-icon recruiter-icon"><BriefcaseBusiness size={21} /></div>
            <p className="eyebrow">For hiring teams</p>
            <h2>Recruiter Workspace</h2>
            <p className="public-card-summary">Organize roles, review candidate evidence, and prepare interviews.</p>
            <ul>{features.map((feature) => <li key={feature}><ShieldCheck size={15} /> {feature}</li>)}</ul>
            <Link className="button button-secondary public-card-action" to="/auth?portal=recruiter">Recruiter sign in <ArrowRight size={15} /></Link>
            <span className="public-secondary-link public-provision-note">Recruiter accounts are provisioned by an administrator.</span>
          </article>
        </div>
      </section>

      <section className="public-shared-layer">
        <div className="shared-icon"><BrainCircuit size={21} /></div>
        <div><p className="eyebrow">Shared AI and data layer</p><h2>One secure platform for the full hiring workflow</h2><p>Resume parsing · Job matching · Interview generation · Candidate records · Protected account data</p></div>
      </section>
      <footer className="public-footer"><span>HireMind AI</span><span>AI supports review. Recruiters make the final decision.</span></footer>
    </main>
  );
}
