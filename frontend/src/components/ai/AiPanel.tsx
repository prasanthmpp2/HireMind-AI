import { useMemo, useState } from "react";
import { Copy, QrCode, Sparkles } from "lucide-react";
import { useAiActions } from "../../hooks/useAi";
import { buildShareResumeLink, computeJobMatch } from "../../lib/resumeEnhancements";
import { ResumeData } from "../../types/resume";
import { useResumeStore } from "../../store/resumeStore";

type AiPanelProps = {
  resume: ResumeData;
  onApplyResume: (next: ResumeData) => void;
};

const AiPanel = ({ resume, onApplyResume }: AiPanelProps) => {
  const ai = useResumeStore((state) => state.ai);
  const score = ai.strengthScore ?? 0;

  const {
    tailorResume,
    boostAchievements,
    generateCoverLetter,
    importFromLinkedIn,
    translateResume
  } = useAiActions();

  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [achievementInput, setAchievementInput] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [linkedinInput, setLinkedinInput] = useState("");
  const [language, setLanguage] = useState("Spanish");

  const jobMatch = useMemo(() => computeJobMatch(resume, jobDescription), [resume, jobDescription]);
  const fallbackNotice = ai.lastOutput?.startsWith("Applied local") ? ai.lastOutput : "";

  const handleTailor = async (role: "Software Engineer" | "Data Analyst") => {
    const next = await tailorResume(resume, role);
    if (next) onApplyResume(next);
  };

  const handleBoostAchievements = async () => {
    const lines = achievementInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const boosted = await boostAchievements(lines);
    if (!boosted?.length) return;
    setAchievementInput(boosted.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`).join("\n"));
  };

  const handleCoverLetter = async () => {
    if (!jobDescription.trim()) return;
    const output = await generateCoverLetter(resume, jobDescription);
    if (output) setCoverLetter(output.trim());
  };

  const handleCreateShareLink = () => {
    const link = buildShareResumeLink(resume);
    setShareLink(link);
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch (_error) {
      // Ignore clipboard errors.
    }
  };

  const handleLinkedInImport = async () => {
    if (!linkedinInput.trim()) return;
    const linkFromInput = linkedinInput.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0];
    const merged: ResumeData = {
      ...resume,
      personal: {
        ...resume.personal,
        linkedin: linkFromInput
          ? linkFromInput.startsWith("http")
            ? linkFromInput
            : `https://${linkFromInput}`
          : resume.personal.linkedin
      }
    };
    const enriched = await importFromLinkedIn(merged, linkedinInput);
    if (enriched) onApplyResume(enriched);
  };

  const handleTranslate = async () => {
    if (!language.trim()) return;
    const translated = await translateResume(resume, language.trim());
    if (translated) onApplyResume(translated);
  };

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            AI Toolkit
          </p>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">ATS Score</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/40 px-2 py-1 text-[11px] text-teal-600 dark:text-teal-300">
          <Sparkles className="h-3.5 w-3.5" />
          {score}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
        AI requests are sent through the HireMind backend. Provider keys are never stored in this browser.
      </p>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Job Description Match Score
        </p>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="mt-2 h-24 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder="Paste the job post here"
        />
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Match: {jobMatch.score}%</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Missing: {jobMatch.missingSkills.length ? jobMatch.missingSkills.join(", ") : "None detected"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Edit tip: {jobMatch.suggestedEdits[0]}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={() => {
            void handleTailor("Software Engineer");
          }}
          disabled={ai.loading}
        >
          One-Click Role Tailoring: Software Engineer
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={() => {
            void handleTailor("Data Analyst");
          }}
          disabled={ai.loading}
        >
          One-Click Role Tailoring: Data Analyst
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Achievement Booster</p>
        <textarea
          value={achievementInput}
          onChange={(event) => setAchievementInput(event.target.value)}
          className="mt-2 h-24 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder="Paste weak bullets, one per line"
        />
        <button
          type="button"
          className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={() => {
            void handleBoostAchievements();
          }}
          disabled={ai.loading}
        >
          Boost Bullets
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Cover Letter Generator</p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={() => {
            void handleCoverLetter();
          }}
          disabled={ai.loading || !jobDescription.trim()}
        >
          Generate Cover Letter
        </button>
        {coverLetter ? (
          <textarea
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
            className="mt-2 h-32 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Shareable Resume Link + QR Code
        </p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={handleCreateShareLink}
        >
          Create Link
        </button>
        {shareLink ? (
          <div className="mt-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="break-all rounded-md bg-slate-50 px-2 py-2 text-[11px] text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                {shareLink}
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700"
                onClick={() => {
                  void copyShareLink();
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </button>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  shareLink
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700"
              >
                <QrCode className="mr-1 h-3.5 w-3.5" />
                QR
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">LinkedIn Import</p>
        <textarea
          value={linkedinInput}
          onChange={(event) => setLinkedinInput(event.target.value)}
          className="mt-2 h-20 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder="Paste LinkedIn profile URL or exported profile text"
        />
        <button
          type="button"
          className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
          onClick={() => {
            void handleLinkedInImport();
          }}
          disabled={ai.loading}
        >
          Import LinkedIn Data
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Multi-language Resume</p>
        <div className="mt-2 flex gap-2">
          <input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            placeholder="Language (e.g., Spanish, French, German)"
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
            onClick={() => {
              void handleTranslate();
            }}
            disabled={ai.loading}
          >
            Translate
          </button>
        </div>
      </div>

      {ai.loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Running: {ai.action || "AI task"}...</p>
      ) : null}
      {ai.error ? <p className="text-xs text-rose-600 dark:text-rose-400">{ai.error}</p> : null}
      {!ai.error && fallbackNotice ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{fallbackNotice}</p>
      ) : null}
    </div>
  );
};

export default AiPanel;
