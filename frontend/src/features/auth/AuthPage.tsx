import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, BrainCircuit, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setCsrfToken } from "../../api/client";
import { Card } from "../../components/platform/Ui";
import type { ResumeData } from "../../types/resume";

const emptyPersonal: ResumeData["personal"] = { name: "", email: "", phone: "", address: "", linkedin: "", github: "", photo: "", summary: "" };

export function AuthPage() {
  const [params, setParams] = useSearchParams();
  const requestedPortal = params.get("portal") === "recruiter" || params.get("portal") === "candidate" ? params.get("portal") as "candidate" | "recruiter" : "any";
  const canRegister = requestedPortal !== "recruiter";
  const [register, setRegister] = useState(canRegister && params.get("mode") === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const changeMode = (nextRegister: boolean) => {
    setRegister(nextRegister);
    setError("");
    setParams(nextRegister ? { portal: "candidate", mode: "register" } : (requestedPortal === "recruiter" ? { portal: "recruiter" } : requestedPortal === "candidate" ? { portal: "candidate" } : {}));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = register
        ? await api.registerCandidate(email, password, { ...emptyPersonal, name: name.trim(), email: email.trim() })
        : await api.login(email.trim(), password);
      const userPortal = user.role === "candidate" ? "candidate" : "recruiter";
      if (requestedPortal !== "any" && userPortal !== requestedPortal) {
        await api.logout();
        setCsrfToken("");
        setError(userPortal === "candidate"
          ? "This account is a candidate account. Choose Candidate Portal to sign in."
          : "This account belongs to the recruiter workspace. Choose Recruiter sign in.");
        return;
      }
      navigate(userPortal === "candidate" ? "/candidate" : "/recruiter", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link className="auth-brand" to="/" aria-label="Back to HireMind home"><span className="public-brand-mark"><BrainCircuit size={21} /></span><span><strong>HireMind AI</strong><small>One platform. Two user experiences.</small></span></Link>
        <div className="auth-intro-copy">
          <span className="public-kicker"><ShieldCheck size={14} /> Secure workspace access</span>
          <h1>{requestedPortal === "recruiter" ? "Welcome to your recruiter workspace." : requestedPortal === "candidate" ? "Make your next move with confidence." : "Welcome back to HireMind AI."}</h1>
          <p>{requestedPortal === "recruiter" ? "Manage job openings, screen resumes, compare job-related evidence, and prepare structured interviews." : requestedPortal === "candidate" ? "Build a polished resume, keep your versions organized, and use AI writing support when you need it." : "Sign in and HireMind will take you to the candidate portal or recruiter workspace assigned to your account."}</p>
        </div>
        <div className="auth-trust-note"><LockKeyhole size={17} /><span><strong>Private by design</strong><small>Server-managed sessions. Your password and AI provider keys are never stored in browser storage.</small></span></div>
      </section>

      <section className="auth-form-side">
        <Link className="auth-back-link" to="/"><ArrowLeft size={15} /> Back to HireMind</Link>
        <Card className="auth-card">
          <p className="eyebrow">{requestedPortal === "recruiter" ? "Recruiter workspace" : requestedPortal === "candidate" ? "Candidate portal" : "Secure account access"}</p>
          <h2 className="auth-title">{register ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-description">{register ? "Set up a candidate account to build and save resumes." : "Sign in to continue to your HireMind workspace."}</p>

          {error && <p className="feedback-card feedback-error auth-error" role="alert">{error}</p>}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {register && <div className="field"><label htmlFor="auth-name">Full name</label><input id="auth-name" autoComplete="name" required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></div>}
            <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="username" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
            <div className="field"><label htmlFor="auth-password">Password</label><div className="auth-password-wrap"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} /><button className="auth-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{register && <small className="field-help">Use at least 12 characters. Recruiter accounts are created by an administrator.</small>}</div>
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : register ? "Create a candidate account" : "Sign in"}</button>
          </form>
          {canRegister && <div className="auth-mode-row"><span>{register ? "Already have an account?" : "New to HireMind?"}</span><button className="text-link" type="button" onClick={() => changeMode(!register)}>{register ? "Sign in" : "Create a candidate account"}</button></div>}
          {!canRegister && <p className="auth-admin-note">Need recruiter access? Ask your HireMind administrator to provision your account.</p>}
        </Card>
        <p className="auth-session-caption"><ShieldCheck size={13} /> Protected by an HttpOnly server session and CSRF verification.</p>
      </section>
    </main>
  );
}
