import { useState } from "react";
import type { FormEvent } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { useToast } from "../../app/ToastContext";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Card, PageHeading } from "../../components/platform/Ui";
import { PROFILE_KEY } from "./savedResumeStorage";

type Profile = { name: string; email: string; location: string; headline: string };
const readProfile = (): Profile => {
  try { return { name: "", email: "", location: "", headline: "", ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") }; }
  catch { return { name: "", email: "", location: "", headline: "" }; }
};

export function ProfileSettingsPage() {
  const [profile, setProfile] = useState(readProfile);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const update = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  const save = (event: FormEvent) => {
    event.preventDefault();
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); showToast("Profile saved in this browser."); }
    catch { showToast("Could not save profile. Check this browser’s storage settings."); }
  };

  return <>
    <PageHeading eyebrow="Candidate portal" title="Profile & settings" description="Manage your candidate profile and account data." />
    <div className="settings-layout">
      <Card>
        <div className="card-heading"><div><h2>Local profile notes</h2><p>These optional presentation details are stored in this browser. Your account email and structured resumes are server-managed.</p></div><ShieldCheck size={18} color="#087e79" /></div>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field"><label htmlFor="profile-name">Full name</label><input id="profile-name" value={profile.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" /></div>
            <div className="field"><label htmlFor="profile-email">Email</label><input id="profile-email" type="email" value={profile.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" /></div>
            <div className="field"><label htmlFor="profile-location">Location</label><input id="profile-location" value={profile.location} onChange={(event) => update("location", event.target.value)} autoComplete="address-level2" /></div>
            <div className="field"><label htmlFor="profile-headline">Professional headline</label><input id="profile-headline" value={profile.headline} onChange={(event) => update("headline", event.target.value)} maxLength={120} /></div>
          </div>
          <div className="form-actions"><button className="button button-primary" type="submit"><Save size={15} /> Save profile</button></div>
        </form>
      </Card>
      <div className="privacy-card"><ShieldCheck size={19} /><strong>Delete candidate account</strong><p>This permanently deletes your server profile, uploaded resume records, structured resume drafts, and associated reports.</p><button className="button button-danger" type="button" onClick={() => { if (window.confirm("Permanently delete your HireMind account and server data?")) void api.deleteAccount().then(() => navigate("/auth", { replace: true })).catch((error) => showToast(error instanceof Error ? error.message : "Account deletion failed.")); }}>Delete account and server data</button></div>
    </div>
  </>;
}
