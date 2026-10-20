import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeData, ResumeFontId, ResumeFontSizeId, SectionKey, TemplateId } from "../../types/resume";

type ResumePreviewProps = {
  resume: ResumeData;
  template: TemplateId;
  order: SectionKey[];
  font: ResumeFontId;
  fontSize: ResumeFontSizeId;
};

const templateStyles: Record<
  TemplateId,
  {
    page: string;
    header: string;
    sectionTitle: string;
    sectionWrap: string;
    skillChip: string;
  }
> = {
  classic: {
    page: "bg-white text-slate-900",
    header: "border-b-2 border-teal-600 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.2em] text-teal-700",
    sectionWrap: "",
    skillChip: "bg-teal-100 text-teal-700"
  },
  modern: {
    page: "bg-gradient-to-br from-white to-slate-50 text-slate-900",
    header:
      "rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-700 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.2em] text-slate-600",
    sectionWrap: "border-l-2 border-teal-500 pl-4",
    skillChip: "bg-slate-900 text-white"
  },
  minimal: {
    page: "bg-white text-slate-900",
    header: "border-b border-slate-300 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500",
    sectionWrap: "",
    skillChip: "border border-slate-400 text-slate-700"
  },
  slate: {
    page: "bg-slate-50 text-slate-900",
    header: "rounded-2xl bg-slate-900 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-500",
    sectionWrap: "border-l-2 border-slate-300 pl-4",
    skillChip: "bg-slate-900 text-white"
  },
  emerald: {
    page: "bg-white text-slate-900",
    header: "border-b-2 border-emerald-600 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700",
    sectionWrap: "",
    skillChip: "bg-emerald-100 text-emerald-700"
  },
  indigo: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-indigo-700 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600",
    sectionWrap: "border-l-2 border-indigo-500 pl-4",
    skillChip: "bg-indigo-600 text-white"
  },
  amber: {
    page: "bg-amber-50 text-slate-900",
    header: "border-b-2 border-amber-500 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-amber-700",
    sectionWrap: "",
    skillChip: "bg-amber-100 text-amber-800"
  },
  rose: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-rose-600 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-rose-600",
    sectionWrap: "border-l-2 border-rose-300 pl-4",
    skillChip: "bg-rose-100 text-rose-700"
  },
  graphite: {
    page: "bg-slate-100 text-slate-900",
    header: "border-b-2 border-slate-700 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-600",
    sectionWrap: "",
    skillChip: "bg-slate-700 text-white"
  },
  serif: {
    page: "bg-white text-slate-900",
    header: "border-b border-slate-400 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-500",
    sectionWrap: "",
    skillChip: "border border-slate-400 text-slate-700"
  },
  executive: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-black px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-600",
    sectionWrap: "border-l-2 border-slate-400 pl-4",
    skillChip: "bg-black text-white"
  },
  aurora: {
    page: "bg-gradient-to-br from-white to-emerald-50 text-slate-900",
    header: "rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-500 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600",
    sectionWrap: "",
    skillChip: "bg-emerald-200 text-emerald-800"
  },
  cobalt: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-blue-700 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-blue-600",
    sectionWrap: "border-l-2 border-blue-400 pl-4",
    skillChip: "bg-blue-600 text-white"
  },
  mono: {
    page: "bg-white text-slate-900",
    header: "border-b border-slate-300 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-500",
    sectionWrap: "",
    skillChip: "border border-slate-400 text-slate-700"
  },
  clean: {
    page: "bg-white text-slate-900",
    header: "pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-400",
    sectionWrap: "",
    skillChip: "bg-slate-100 text-slate-700"
  },
  bold: {
    page: "bg-slate-900 text-white",
    header: "rounded-2xl bg-white/10 px-5 py-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-white/70",
    sectionWrap: "",
    skillChip: "bg-white text-slate-900"
  },
  airy: {
    page: "bg-white text-slate-900",
    header: "pb-6 border-b border-slate-200",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-400",
    sectionWrap: "",
    skillChip: "bg-slate-100 text-slate-700"
  },
  contrast: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-slate-900 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-900",
    sectionWrap: "",
    skillChip: "bg-slate-900 text-white"
  },
  skyline: {
    page: "bg-gradient-to-b from-white to-slate-100 text-slate-900",
    header: "rounded-2xl bg-gradient-to-r from-slate-800 to-slate-600 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-slate-600",
    sectionWrap: "border-l-2 border-slate-300 pl-4",
    skillChip: "bg-slate-700 text-white"
  },
  horizon: {
    page: "bg-white text-slate-900",
    header: "border-b-2 border-indigo-300 pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-indigo-500",
    sectionWrap: "",
    skillChip: "bg-indigo-100 text-indigo-700"
  },
  ink: {
    page: "bg-white text-slate-900",
    header: "border-b-2 border-black pb-4",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-black",
    sectionWrap: "",
    skillChip: "bg-black text-white"
  },
  sand: {
    page: "bg-amber-50 text-slate-900",
    header: "rounded-2xl bg-amber-200 px-5 py-4 text-slate-900",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-amber-700",
    sectionWrap: "",
    skillChip: "bg-amber-100 text-amber-800"
  },
  ocean: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-cyan-700 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600",
    sectionWrap: "border-l-2 border-cyan-300 pl-4",
    skillChip: "bg-cyan-100 text-cyan-700"
  },
  forest: {
    page: "bg-white text-slate-900",
    header: "rounded-2xl bg-emerald-800 px-5 py-4 text-white",
    sectionTitle: "text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700",
    sectionWrap: "",
    skillChip: "bg-emerald-100 text-emerald-700"
  }
};

const isFilled = (value?: string) => Boolean(value?.trim().length);

const contactLine = (resume: ResumeData) => {
  const parts = [
    resume.personal.email,
    resume.personal.phone,
    resume.personal.address,
    resume.personal.linkedin,
    resume.personal.github
  ].filter((item) => isFilled(item));
  return parts.join(" | ");
};

const hasAny = (items: Array<Record<string, string>>) =>
  items.some((item) => Object.values(item).some((value) => isFilled(value)));

const darkHeaderTemplates: TemplateId[] = [
  "modern",
  "slate",
  "indigo",
  "rose",
  "executive",
  "aurora",
  "cobalt",
  "contrast",
  "skyline",
  "ocean",
  "forest"
];

const fontClassMap: Record<ResumeFontId, string> = {
  inter: "resume-font-inter",
  poppins: "resume-font-poppins",
  lato: "resume-font-lato",
  manrope: "resume-font-manrope",
  montserrat: "resume-font-montserrat",
  nunito: "resume-font-nunito",
  merriweather: "resume-font-merriweather",
  playfair: "resume-font-playfair",
  robotoSlab: "resume-font-roboto-slab",
  sourceSerif: "resume-font-source-serif",
  spaceGrotesk: "resume-font-space-grotesk"
};

const fontSizeClassMap: Record<ResumeFontSizeId, string> = {
  xsmall: "resume-size-xsmall",
  small: "resume-size-small",
  default: "resume-size-default",
  large: "resume-size-large",
  xlarge: "resume-size-xlarge"
};

const ResumePreview = ({ resume, template, order, font, fontSize }: ResumePreviewProps) => {
  const styles = templateStyles[template];
  const hasDarkHeader = darkHeaderTemplates.includes(template);
  const hasPhoto = isFilled(resume.personal.photo);

  const sections: Record<SectionKey, ReactNode | null> = {
    summary: isFilled(resume.personal.summary) ? (
      <div>
        <h3 className={styles.sectionTitle}>About</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{resume.personal.summary}</p>
      </div>
    ) : null,
    education: hasAny(resume.education) ? (
      <div>
        <h3 className={styles.sectionTitle}>Education</h3>
        <div className="mt-3 space-y-3">
          {resume.education
            .filter((item) => isFilled(item.degree) || isFilled(item.institution) || isFilled(item.year))
            .map((item, index) => (
              <div key={`${item.degree}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.degree ? <p className="text-sm font-semibold text-slate-800">{item.degree}</p> : null}
                  {item.year ? <span className="text-xs text-slate-500">{item.year}</span> : null}
                </div>
                {(item.institution || item.score) && (
                  <p className="text-sm text-slate-600">
                    {item.institution}
                    {item.institution && item.score ? ` | ${item.score}` : item.score || ""}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    ) : null,
    experience: hasAny(resume.experience) ? (
      <div>
        <h3 className={styles.sectionTitle}>Experience</h3>
        <div className="mt-3 space-y-4">
          {resume.experience
            .filter(
              (item) =>
                isFilled(item.role) || isFilled(item.company) || isFilled(item.description) || isFilled(item.duration)
            )
            .map((item, index) => (
              <div key={`${item.role}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {(item.role || item.company) ? (
                    <p className="text-sm font-semibold text-slate-800">
                      {[item.role, item.company].filter(Boolean).join(" | ")}
                    </p>
                  ) : null}
                  {item.duration ? <span className="text-xs text-slate-500">{item.duration}</span> : null}
                </div>
                {item.description ? (
                  <p className="text-sm text-slate-600 whitespace-pre-line">{item.description}</p>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    ) : null,
    projects: hasAny(resume.projects) ? (
      <div>
        <h3 className={styles.sectionTitle}>Projects</h3>
        <div className="mt-3 space-y-4">
          {resume.projects
            .filter(
              (item) =>
                isFilled(item.name) || isFilled(item.description) || isFilled(item.tech) || isFilled(item.link)
            )
            .map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.name ? <p className="text-sm font-semibold text-slate-800">{item.name}</p> : null}
                  {item.link ? <span className="text-xs text-slate-500">{item.link}</span> : null}
                </div>
                {item.description ? <p className="text-sm text-slate-600">{item.description}</p> : null}
                {item.tech ? <p className="text-xs text-slate-500">Tech: {item.tech}</p> : null}
              </div>
            ))}
        </div>
      </div>
    ) : null,
    skills: resume.skills.length ? (
      <div>
        <h3 className={styles.sectionTitle}>Skills</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {resume.skills.map((skill) => (
            <span key={skill} className={`rounded-full px-3 py-1 text-xs font-medium ${styles.skillChip}`}>
              {skill}
            </span>
          ))}
        </div>
      </div>
    ) : null,
    certifications: hasAny(resume.certifications) ? (
      <div>
        <h3 className={styles.sectionTitle}>Certifications</h3>
        <div className="mt-3 space-y-3">
          {resume.certifications
            .filter((item) => isFilled(item.name) || isFilled(item.issuer) || isFilled(item.year))
            .map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.name ? <p className="text-sm font-semibold text-slate-800">{item.name}</p> : null}
                  {item.year ? <span className="text-xs text-slate-500">{item.year}</span> : null}
                </div>
                {item.issuer ? <p className="text-sm text-slate-600">{item.issuer}</p> : null}
              </div>
            ))}
        </div>
      </div>
    ) : null
  };

  const showHeader =
    isFilled(resume.personal.name) || isFilled(contactLine(resume)) || isFilled(resume.personal.photo);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={template}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`min-h-[900px] w-full rounded-3xl px-8 py-6 shadow-2xl ${styles.page} ${fontClassMap[font]} ${fontSizeClassMap[fontSize]}`}
        id="resume-preview-surface"
      >
        {showHeader ? (
          <header className={`${styles.header} flex items-start justify-between gap-4`}>
            <div className="min-w-0 flex-1">
              {resume.personal.name ? <h2 className="text-2xl font-semibold">{resume.personal.name}</h2> : null}
              {contactLine(resume) ? (
                <p className={`mt-1 text-sm ${hasDarkHeader ? "text-white/80" : "text-slate-500"}`}>
                  {contactLine(resume)}
                </p>
              ) : null}
            </div>
            {hasPhoto ? (
              <img
                src={resume.personal.photo}
                alt={resume.personal.name ? `${resume.personal.name} profile photo` : "Profile photo"}
                className={`h-20 w-20 shrink-0 rounded-2xl border object-cover ${
                  hasDarkHeader ? "border-white/30 bg-white/10" : "border-slate-200 bg-white"
                }`}
              />
            ) : null}
          </header>
        ) : null}
        <div className={`mt-6 flex flex-col gap-6 ${styles.sectionWrap}`}>
          {order.map((section) =>
            sections[section] ? <div key={section}>{sections[section]}</div> : null
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ResumePreview;

