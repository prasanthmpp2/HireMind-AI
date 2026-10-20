import { Suspense, useCallback, useEffect, useMemo, useState, lazy } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileDown,
  Moon,
  Shuffle,
  SunMedium
} from "lucide-react";
import { resumeSchema } from "./lib/schema";
import { computeCompletion, computeHeuristicScore, defaultResume } from "./lib/resume";
import { exportResumePdf } from "./lib/pdf";
import { sampleResume } from "./data/sampleResume";
import { useAiActions } from "./hooks/useAi";
import { useResumePersistence } from "./hooks/useResumePersistence";
import { useTheme } from "./hooks/useTheme";
import { useResumeStore } from "./store/resumeStore";
import { ResumeData, ResumeFontId, ResumeFontSizeId, TemplateId } from "./types/resume";
import { CertificationsSection } from "./components/form/CertificationsSection";
import { EducationSection } from "./components/form/EducationSection";
import { ExperienceSection } from "./components/form/ExperienceSection";
import { ImportSection } from "./components/form/ImportSection";
import { PersonalSection } from "./components/form/PersonalSection";
import { ProjectsSection } from "./components/form/ProjectsSection";
import { SkillsSection } from "./components/form/SkillsSection";
import { SectionOrder } from "./components/SectionOrder";
import type { ResumeDesign } from "./api/types";

const ResumePreview = lazy(() => import("./components/preview/ResumePreview"));
const AiPanel = lazy(() => import("./components/ai/AiPanel"));

type TemplateItem = { id: TemplateId; label: string };
type FontItem = { id: ResumeFontId; label: string };
type FontSizeItem = { id: ResumeFontSizeId; label: string };

const templateCatalog: Array<{ category: string; items: TemplateItem[] }> = [
  {
    category: "Professional",
    items: [
      { id: "classic", label: "Classic" },
      { id: "executive", label: "Executive" },
      { id: "clean", label: "Clean" },
      { id: "graphite", label: "Graphite" },
      { id: "ink", label: "Ink" },
      { id: "horizon", label: "Horizon" }
    ]
  },
  {
    category: "Modern",
    items: [
      { id: "modern", label: "Modern" },
      { id: "slate", label: "Slate" },
      { id: "cobalt", label: "Cobalt" },
      { id: "skyline", label: "Skyline" },
      { id: "contrast", label: "Contrast" },
      { id: "airy", label: "Airy" }
    ]
  },
  {
    category: "Creative",
    items: [
      { id: "aurora", label: "Aurora" },
      { id: "rose", label: "Rose" },
      { id: "ocean", label: "Ocean" },
      { id: "forest", label: "Forest" },
      { id: "amber", label: "Amber" },
      { id: "sand", label: "Sand" }
    ]
  },
  {
    category: "Minimal",
    items: [
      { id: "minimal", label: "Minimal" },
      { id: "serif", label: "Serif" },
      { id: "mono", label: "Mono" },
      { id: "bold", label: "Bold" },
      { id: "indigo", label: "Indigo" },
      { id: "emerald", label: "Emerald" }
    ]
  }
];

const allTemplates = templateCatalog.flatMap((group) => group.items);
const templateCategories = templateCatalog.map((group) => group.category);

const templateLabelMap = Object.fromEntries(
  allTemplates.map((template) => [template.id, template.label])
) as Record<TemplateId, string>;

const templateCategoryById = Object.fromEntries(
  templateCatalog.flatMap((group) => group.items.map((template) => [template.id, group.category]))
) as Record<TemplateId, string>;

const fontCatalog: Array<{ category: string; items: FontItem[] }> = [
  {
    category: "Sans",
    items: [
      { id: "inter", label: "Inter" },
      { id: "poppins", label: "Poppins" },
      { id: "lato", label: "Lato" },
      { id: "manrope", label: "Manrope" },
      { id: "montserrat", label: "Montserrat" },
      { id: "nunito", label: "Nunito" },
      { id: "spaceGrotesk", label: "Space Grotesk" }
    ]
  },
  {
    category: "Serif",
    items: [
      { id: "merriweather", label: "Merriweather" },
      { id: "playfair", label: "Playfair Display" },
      { id: "robotoSlab", label: "Roboto Slab" },
      { id: "sourceSerif", label: "Source Serif 4" }
    ]
  }
];

const allFonts = fontCatalog.flatMap((group) => group.items);
const fontCategories = fontCatalog.map((group) => group.category);
const fontCategoryById = Object.fromEntries(
  fontCatalog.flatMap((group) => group.items.map((font) => [font.id, group.category]))
) as Record<ResumeFontId, string>;

const fontSizeCatalog: Array<{ category: string; items: FontSizeItem[] }> = [
  {
    category: "Compact",
    items: [
      { id: "xsmall", label: "Extra Small" },
      { id: "small", label: "Small" }
    ]
  },
  {
    category: "Standard",
    items: [{ id: "default", label: "Default" }]
  },
  {
    category: "Readable",
    items: [
      { id: "large", label: "Large" },
      { id: "xlarge", label: "Extra Large" }
    ]
  }
];

const allFontSizes = fontSizeCatalog.flatMap((group) => group.items);
const fontSizeCategories = fontSizeCatalog.map((group) => group.category);
const fontSizeCategoryById = Object.fromEntries(
  fontSizeCatalog.flatMap((group) => group.items.map((size) => [size.id, group.category]))
) as Record<ResumeFontSizeId, string>;

const cleanFilename = (name: string) =>
  (name || "resume").replace(/[^\w-]+/g, "_").slice(0, 40) || "resume";

const controlSelectClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none sm:min-w-[170px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-400";

const controlGhostButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const controlPrimaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500";

const App = () => {
  const { isDark, toggle } = useTheme();
  const {
    resume,
    template,
    font,
    fontSize,
    sectionOrder,
    ai,
    setResume,
    setTemplate,
    setFont,
    setFontSize,
    setSectionOrder,
    setAi
  } = useResumeStore();

  const [templateCategory, setTemplateCategory] = useState<string>(templateCategoryById[template]);
  const [fontCategory, setFontCategory] = useState<string>(fontCategoryById[font]);
  const [fontSizeCategory, setFontSizeCategory] = useState<string>(fontSizeCategoryById[fontSize]);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [importErrorMessage, setImportErrorMessage] = useState("");

  const selectedTemplateOptions = useMemo(
    () =>
      templateCatalog.find((group) => group.category === templateCategory)?.items || allTemplates,
    [templateCategory]
  );
  const selectedFontOptions = useMemo(
    () => fontCatalog.find((group) => group.category === fontCategory)?.items || allFonts,
    [fontCategory]
  );
  const selectedFontSizeOptions = useMemo(
    () =>
      fontSizeCatalog.find((group) => group.category === fontSizeCategory)?.items || allFontSizes,
    [fontSizeCategory]
  );

  const form = useForm<ResumeData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: resume || defaultResume,
    mode: "onChange"
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      setResume(value as ResumeData);
    });
    return () => subscription.unsubscribe();
  }, [form, setResume]);

  const editorDesign = useMemo<ResumeDesign>(() => ({
    template,
    font,
    font_size: fontSize,
    section_order: sectionOrder
  }), [font, fontSize, sectionOrder, template]);
  const applyDesign = useCallback((design: ResumeDesign) => {
    setTemplate(design.template);
    setFont(design.font);
    setFontSize(design.font_size);
    setSectionOrder(design.section_order);
  }, [setFont, setFontSize, setSectionOrder, setTemplate]);
  const { hydrated } = useResumePersistence(resume, setResume, form.reset, editorDesign, applyDesign);

  const completion = useMemo(() => computeCompletion(resume), [resume]);
  const showSamplePreview = completion.completed === 0;
  const previewResume = useMemo(() => {
    if (showSamplePreview) return sampleResume;
    if (!resume.personal.summary.trim()) {
      return {
        ...resume,
        personal: {
          ...resume.personal,
          summary: sampleResume.personal.summary
        }
      };
    }
    return resume;
  }, [resume, showSamplePreview]);

  useEffect(() => {
    if (ai.scoreSource !== "ai") {
      const score = computeHeuristicScore(resume);
      setAi({ strengthScore: score, scoreSource: "heuristic" });
    }
  }, [ai.scoreSource, resume, setAi]);

  useEffect(() => {
    const category = templateCategoryById[template];
    if (category !== templateCategory) {
      setTemplateCategory(category);
    }
  }, [template, templateCategory]);

  useEffect(() => {
    const category = fontCategoryById[font];
    if (category !== fontCategory) {
      setFontCategory(category);
    }
  }, [font, fontCategory]);

  useEffect(() => {
    const category = fontSizeCategoryById[fontSize];
    if (category !== fontSizeCategory) {
      setFontSizeCategory(category);
    }
  }, [fontSize, fontSizeCategory]);

  const { improveSummary, rewriteExperience, generateBullets, grammarImprove } = useAiActions();

  const handleImproveSummary = async () => {
    const summary = form.getValues("personal.summary");
    if (!summary) return;
    const output = await improveSummary(summary);
    if (output) {
      const cleaned = output.replace(/\s+/g, " ").trim();
      const limited =
        cleaned.length > 500 ? cleaned.slice(0, 499).replace(/\s+\S*$/, "") : cleaned;
      form.setValue("personal.summary", limited, { shouldDirty: true });
    }
  };

  const handleRewriteExperience = async (index: number) => {
    const entry = form.getValues(`experience.${index}`);
    const output = await rewriteExperience(entry.role, entry.company, entry.description);
    if (output) {
      form.setValue(`experience.${index}.description`, output, { shouldDirty: true });
    }
  };

  const handleGenerateBullets = async (index: number) => {
    const entry = form.getValues(`experience.${index}`);
    const output = await generateBullets(entry.role, entry.company);
    if (!output) return;
    const bullets = output
      .split("\n")
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n");
    const current = form.getValues(`experience.${index}.description`);
    const next = current ? `${current}\n${bullets}` : bullets;
    form.setValue(`experience.${index}.description`, next, { shouldDirty: true });
  };

  const handleGrammarImprove = async (index: number) => {
    const entry = form.getValues(`experience.${index}.description`);
    if (!entry) return;
    const output = await grammarImprove(entry);
    if (output) {
      form.setValue(`experience.${index}.description`, output, { shouldDirty: true });
    }
  };

  const handleTemplateCategoryChange = (nextCategory: string) => {
    setTemplateCategory(nextCategory);
    const nextItems =
      templateCatalog.find((group) => group.category === nextCategory)?.items || allTemplates;
    if (!nextItems.some((item) => item.id === template)) {
      setTemplate(nextItems[0].id);
    }
  };

  const handleRandomTemplate = () => {
    const nextTemplate = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    const nextFont = allFonts[Math.floor(Math.random() * allFonts.length)];
    setTemplate(nextTemplate.id);
    setFont(nextFont.id);
  };

  const handleFontCategoryChange = (nextCategory: string) => {
    setFontCategory(nextCategory);
    const nextItems = fontCatalog.find((group) => group.category === nextCategory)?.items || allFonts;
    if (!nextItems.some((item) => item.id === font)) {
      setFont(nextItems[0].id);
    }
  };

  const handleFontSizeCategoryChange = (nextCategory: string) => {
    setFontSizeCategory(nextCategory);
    const nextItems =
      fontSizeCatalog.find((group) => group.category === nextCategory)?.items || allFontSizes;
    if (!nextItems.some((item) => item.id === fontSize)) {
      setFontSize(nextItems[0].id);
    }
  };

  const handleImportFile = async (file: File) => {
    setImportLoading(true);
    setImportStatusMessage("");
    setImportErrorMessage("");

    try {
      const { importResumeFromFile } = await import("./lib/importResume");
      const nextResume = await importResumeFromFile(file, form.getValues());
      form.reset(nextResume);
      setResume(nextResume);
      setAi({ error: undefined, scoreSource: null });
      setImportStatusMessage(`Imported data from ${file.name}. Please review and edit where needed.`);
    } catch (error) {
      setImportErrorMessage(
        error instanceof Error ? error.message : "Import failed. Please try another file."
      );
    } finally {
      setImportLoading(false);
    }
  };

  const addEducation = () => {
    const next = [...form.getValues("education"), { degree: "", institution: "", year: "", score: "" }];
    form.setValue("education", next, { shouldDirty: true });
  };

  const removeEducation = (index: number) => {
    const next = form.getValues("education").filter((_, idx) => idx !== index);
    form.setValue("education", next.length ? next : [{ degree: "", institution: "", year: "", score: "" }], {
      shouldDirty: true
    });
  };

  const addExperience = () => {
    const next = [
      ...form.getValues("experience"),
      { company: "", role: "", duration: "", description: "" }
    ];
    form.setValue("experience", next, { shouldDirty: true });
  };

  const removeExperience = (index: number) => {
    const next = form.getValues("experience").filter((_, idx) => idx !== index);
    form.setValue(
      "experience",
      next.length ? next : [{ company: "", role: "", duration: "", description: "" }],
      { shouldDirty: true }
    );
  };

  const addProject = () => {
    const next = [
      ...form.getValues("projects"),
      { name: "", link: "", description: "", tech: "" }
    ];
    form.setValue("projects", next, { shouldDirty: true });
  };

  const removeProject = (index: number) => {
    const next = form.getValues("projects").filter((_, idx) => idx !== index);
    form.setValue("projects", next.length ? next : [{ name: "", link: "", description: "", tech: "" }], {
      shouldDirty: true
    });
  };

  const addCertification = () => {
    const next = [
      ...form.getValues("certifications"),
      { name: "", issuer: "", year: "" }
    ];
    form.setValue("certifications", next, { shouldDirty: true });
  };

  const removeCertification = (index: number) => {
    const next = form.getValues("certifications").filter((_, idx) => idx !== index);
    form.setValue("certifications", next.length ? next : [{ name: "", issuer: "", year: "" }], {
      shouldDirty: true
    });
  };

  const handleExport = async () => {
    const element = document.getElementById("resume-preview-surface");
    if (!element) return;
    try {
      await exportResumePdf(element, `${cleanFilename(resume.personal.name)}.pdf`);
    } catch (_error) {
      alert("PDF export failed. Please try again.");
    }
  };

  const handleApplyResume = (next: ResumeData) => {
    form.reset(next);
    setResume(next);
    setAi({ error: undefined, scoreSource: null });
  };

  if (!hydrated) {
    return <div className="state-card resume-loading" role="status" aria-live="polite">Loading your saved resume…</div>;
  }

  return (
    <div className={`resume-builder-app mx-auto w-full max-w-[1460px] pb-8${isDark ? " dark" : ""}`}>
      <header className="resume-builder-header mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Resume Workspace
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Interactive Resume Builder
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Professional resume drafting with live preview, AI refinement, and reliable PDF export.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm sm:w-[190px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Completion</span>
                <span className="font-semibold text-slate-900 dark:text-white">{completion.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-slate-500 to-slate-800"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={toggle}
              className={`${controlGhostButtonClass} whitespace-nowrap`}
            >
              {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className={`${controlPrimaryButtonClass} whitespace-nowrap`}
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Template Layout
            </p>
            <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                value={templateCategory}
                onChange={(event) => handleTemplateCategoryChange(event.target.value)}
                className={controlSelectClass}
              >
                {templateCategories.map((category) => (
                  <option key={category} value={category}>
                    Category: {category}
                  </option>
                ))}
              </select>
              <select
                value={template}
                onChange={(event) => setTemplate(event.target.value as TemplateId)}
                className={controlSelectClass}
              >
                {selectedTemplateOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    Template: {item.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRandomTemplate}
                className={`${controlGhostButtonClass} text-xs sm:text-sm`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Random Style
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Font
            </p>
            <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                value={fontCategory}
                onChange={(event) => handleFontCategoryChange(event.target.value)}
                className={controlSelectClass}
              >
                {fontCategories.map((category) => (
                  <option key={category} value={category}>
                    Font Category: {category}
                  </option>
                ))}
              </select>
              <select
                value={font}
                onChange={(event) => setFont(event.target.value as ResumeFontId)}
                className={controlSelectClass}
              >
                {selectedFontOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    Font: {option.label}
                  </option>
                ))}
              </select>
              <select
                value={fontSizeCategory}
                onChange={(event) => handleFontSizeCategoryChange(event.target.value)}
                className={controlSelectClass}
              >
                {fontSizeCategories.map((category) => (
                  <option key={category} value={category}>
                    Size Category: {category}
                  </option>
                ))}
              </select>
              <select
                value={fontSize}
                onChange={(event) => setFontSize(event.target.value as ResumeFontSizeId)}
                className={controlSelectClass}
              >
                {selectedFontSizeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    Font Size: {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Editor Panel
          </p>
          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
            <ImportSection
              loading={importLoading}
              statusMessage={importStatusMessage}
              errorMessage={importErrorMessage}
              onFileSelect={(file) => {
                void handleImportFile(file);
              }}
            />
            <PersonalSection form={form} onImproveSummary={handleImproveSummary} loading={ai.loading} />
            <EducationSection form={form} onAdd={addEducation} onRemove={removeEducation} />
            <ExperienceSection
              form={form}
              onAdd={addExperience}
              onRemove={removeExperience}
              onRewrite={handleRewriteExperience}
              onBullets={handleGenerateBullets}
              onGrammar={handleGrammarImprove}
              loading={ai.loading}
            />
            <ProjectsSection form={form} onAdd={addProject} onRemove={removeProject} />
            <SkillsSection form={form} />
            <CertificationsSection form={form} onAdd={addCertification} onRemove={removeCertification} />
          </form>
        </div>

        <div className="min-w-0 space-y-5 xl:sticky xl:top-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Preview Panel
          </p>
          <div className="glass-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Live Preview</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Updates instantly as you type.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {templateLabelMap[template]} Style
                </span>
                {showSamplePreview ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Sample Preview
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-4">
              <Suspense fallback={<div className="text-sm text-slate-400">Loading preview...</div>}>
                <AnimatePresence mode="wait">
                  <motion.div key={template} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ResumePreview
                      resume={previewResume}
                      template={template}
                      order={sectionOrder}
                      font={font}
                      fontSize={fontSize}
                    />
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </div>
          </div>

          <SectionOrder order={sectionOrder} onReorder={setSectionOrder} />

          <Suspense fallback={<div className="text-sm text-slate-400">Loading ATS score...</div>}>
            <AiPanel resume={resume} onApplyResume={handleApplyResume} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default App;
