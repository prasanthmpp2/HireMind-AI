import JSZip from "jszip";
import {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeData
} from "../types/resume";

type ResumeSection =
  | "header"
  | "summary"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "certifications";

type ParsedResume = Partial<ResumeData>;

const sectionHeadings: Array<{ section: Exclude<ResumeSection, "header">; keywords: string[] }> = [
  {
    section: "summary",
    keywords: ["summary", "about", "profile", "objective", "professional summary"]
  },
  {
    section: "education",
    keywords: ["education", "academic background", "academics", "qualification", "qualifications"]
  },
  {
    section: "experience",
    keywords: ["experience", "work experience", "employment", "work history", "professional experience"]
  },
  {
    section: "projects",
    keywords: ["projects", "project", "personal projects"]
  },
  {
    section: "skills",
    keywords: ["skills", "technical skills", "core skills", "key skills", "tech stack"]
  },
  {
    section: "certifications",
    keywords: ["certifications", "certification", "licenses", "license", "courses"]
  }
];

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const linkedinPattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,;|)]+/i;
const githubPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,;|)]+/i;
const urlPattern = /https?:\/\/[^\s,;|)]+/i;
const yearPattern = /\b(?:19|20)\d{2}(?:\s*(?:-|to)\s*(?:present|current|(?:19|20)\d{2}))?\b/i;
const durationPattern =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}\s*(?:-|to)\s*(?:present|current|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2})\b/i;

const degreePattern =
  /\b(b\.?\s?tech|m\.?\s?tech|bachelor|master|mba|bsc|msc|phd|diploma|associate|b\.?e\.?|m\.?e\.?|high school|secondary)\b/i;
const institutionPattern = /\b(university|college|institute|school|academy|polytechnic)\b/i;
const scorePattern = /\b(cgpa|gpa|grade|percentage|score)\b/i;
const techPattern = /\b(tech stack|stack|technologies|tools|built with|using)\b/i;
const companyHintPattern =
  /\b(inc|llc|ltd|limited|pvt|technologies|technology|solutions|systems|corp|company|labs|studio|agency)\b/i;

const trimTo = (value: string, max: number) => value.trim().slice(0, max);

const ensureUrl = (url: string) => {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const cleanLine = (line: string) =>
  line
    .replace(/\u2022/g, "-")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripBullet = (line: string) => line.replace(/^(?:[-*]|\d+[.)])\s+/, "").trim();

const getMeaningfulBlocks = (lines: string[]) => {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const cleaned = stripBullet(line);
    if (!cleaned) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(cleaned);
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
};

const hasEducationData = (item: EducationItem) =>
  Boolean(item.degree || item.institution || item.year || item.score);
const hasExperienceData = (item: ExperienceItem) =>
  Boolean(item.company || item.role || item.duration || item.description);
const hasProjectData = (item: ProjectItem) =>
  Boolean(item.name || item.link || item.description || item.tech);
const hasCertificationData = (item: CertificationItem) =>
  Boolean(item.name || item.issuer || item.year);

const detectHeading = (line: string): Exclude<ResumeSection, "header"> | null => {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  for (const entry of sectionHeadings) {
    const match = entry.keywords.some(
      (keyword) => normalized === keyword || normalized.startsWith(`${keyword} `)
    );
    if (match) return entry.section;
  }

  return null;
};

const parseSections = (text: string): Record<ResumeSection, string[]> => {
  const sections: Record<ResumeSection, string[]> = {
    header: [],
    summary: [],
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: []
  };

  const normalizedText = text.replace(/\r/g, "\n").replace(
    /\b(SUMMARY|EDUCATION|EXPERIENCE|PROJECTS|SKILLS|CERTIFICATIONS)\b/g,
    "\n$1\n"
  );
  const lines = normalizedText.split("\n").map(cleanLine);

  let currentSection: ResumeSection = "header";
  for (const line of lines) {
    if (!line) {
      if (currentSection !== "header") {
        sections[currentSection].push("");
      }
      continue;
    }

    const heading = detectHeading(line);
    if (heading) {
      currentSection = heading;
      continue;
    }

    sections[currentSection].push(line);
  }

  return sections;
};

const pickPhone = (text: string) => {
  const matches = text.match(/\+?\d[\d\s().-]{8,}\d/g) ?? [];
  for (const candidate of matches) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      return trimTo(candidate, 20);
    }
  }
  return "";
};

const extractName = (headerLines: string[]) => {
  const isContactLike = (line: string) =>
    emailPattern.test(line) ||
    linkedinPattern.test(line) ||
    githubPattern.test(line) ||
    /\+?\d[\d\s().-]{8,}\d/.test(line) ||
    /^https?:\/\//i.test(line);

  for (const line of headerLines) {
    if (isContactLike(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (!words.every((word) => /^\p{L}[\p{L}'’.-]*$/u.test(word))) continue;
    return trimTo(line, 80);
  }
  return "";
};

const extractAddress = (headerLines: string[], name: string) => {
  for (const line of headerLines) {
    if (!line || line === name) continue;
    if (emailPattern.test(line) || linkedinPattern.test(line) || githubPattern.test(line)) continue;
    if (/\+?\d[\d\s().-]{8,}\d/.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (line.includes(",") || /\b(?:street|st|road|rd|city|state|india|usa|uk)\b/i.test(line)) {
      return trimTo(line, 120);
    }
  }
  return "";
};

const parseSkills = (lines: string[]) => {
  const tokens = lines
    .join("\n")
    .split(/[,\n;|]+/)
    .map((token) =>
      token
        .replace(/^[A-Za-z ]{2,25}:\s*/, "")
        .replace(/^\s*skills?\s*:?/i, "")
        .trim()
    )
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const key = token.toLowerCase();
    if (token.length > 40 || seen.has(key)) continue;
    seen.add(key);
    unique.push(token);
    if (unique.length >= 30) break;
  }

  return unique;
};

const parseEducation = (lines: string[]) => {
  return getMeaningfulBlocks(lines)
    .map((block) => {
      const firstLine = block[0] ?? "";
      const year = trimTo(block.join(" ").match(yearPattern)?.[0] ?? "", 12);
      const score = trimTo(block.find((line) => scorePattern.test(line)) ?? "", 20);

      let degree = block.find((line) => degreePattern.test(line)) ?? firstLine;
      let institution =
        block.find((line) => institutionPattern.test(line) && line !== degree) ?? block[1] ?? "";

      if (!institution && / - | \| /.test(degree)) {
        const parts = degree.split(/ - | \| /).map((part) => part.trim());
        if (parts.length >= 2 && institutionPattern.test(parts[1])) {
          degree = parts[0];
          institution = parts[1];
        }
      }

      return {
        degree: trimTo(degree, 100),
        institution: trimTo(institution, 120),
        year,
        score
      } satisfies EducationItem;
    })
    .filter(hasEducationData);
};

const parseExperience = (lines: string[]) => {
  return getMeaningfulBlocks(lines)
    .map((block) => {
      const firstLine = block[0] ?? "";
      const durationLine = block.find((line) => durationPattern.test(line) || yearPattern.test(line)) ?? "";
      const duration = trimTo(durationLine.match(durationPattern)?.[0] ?? durationLine.match(yearPattern)?.[0] ?? "", 60);

      let role = "";
      let company = "";

      if (/\sat\s/i.test(firstLine)) {
        const [left, right] = firstLine.split(/\sat\s/i);
        role = left?.trim() ?? "";
        company = right?.trim() ?? "";
      } else if (/ - | \| /.test(firstLine)) {
        const parts = firstLine.split(/ - | \| /).map((part) => part.trim());
        role = parts[0] ?? "";
        company = parts[1] ?? "";
      } else {
        role = firstLine;
      }

      if (!company) {
        const companyLine = block.find((line, index) => index > 0 && companyHintPattern.test(line));
        if (companyLine) company = companyLine;
      }

      const descriptionLines = block.filter((line) => {
        if (line === firstLine || line === durationLine) return false;
        if (company && line === company) return false;
        return true;
      });

      const description = trimTo(
        descriptionLines
          .map((line) => stripBullet(line))
          .filter(Boolean)
          .join("\n"),
        1200
      );

      return {
        company: trimTo(company, 120),
        role: trimTo(role, 120),
        duration,
        description
      } satisfies ExperienceItem;
    })
    .filter(hasExperienceData);
};

const parseProjects = (lines: string[]) => {
  return getMeaningfulBlocks(lines)
    .map((block) => {
      const joined = block.join(" ");
      const link = trimTo(joined.match(urlPattern)?.[0] ?? "", 160);

      let name = stripBullet(block[0] ?? "").replace(urlPattern, "").trim();
      name = name.replace(/^project\s*[:-]\s*/i, "");

      const techLine = block.find((line) => techPattern.test(line)) ?? "";
      const tech = trimTo(
        techLine
          .replace(/^.*?(?:tech stack|stack|technologies|tools|built with|using)\s*[:-]?\s*/i, "")
          .trim(),
        120
      );

      const description = trimTo(
        block
          .filter((line, index) => index > 0 && line !== techLine)
          .map((line) => stripBullet(line))
          .join("\n"),
        1200
      );

      if (!name && description) {
        name = description.split("\n")[0].slice(0, 120);
      }

      return {
        name: trimTo(name, 120),
        link,
        description,
        tech
      } satisfies ProjectItem;
    })
    .filter(hasProjectData);
};

const parseCertifications = (lines: string[]) => {
  return getMeaningfulBlocks(lines)
    .map((block) => {
      const firstLine = block[0] ?? "";
      const year = trimTo(
        firstLine.match(yearPattern)?.[0] ?? block.join(" ").match(yearPattern)?.[0] ?? "",
        12
      );

      let name = firstLine;
      let issuer = block[1] ?? "";

      if (/ - | \| /.test(firstLine)) {
        const [left, right] = firstLine.split(/ - | \| /);
        name = left?.trim() ?? "";
        issuer = right?.trim() ?? issuer;
      } else if (/\sby\s/i.test(firstLine)) {
        const [left, right] = firstLine.split(/\sby\s/i);
        name = left?.trim() ?? "";
        issuer = right?.trim() ?? issuer;
      }

      return {
        name: trimTo(name, 120),
        issuer: trimTo(issuer, 120),
        year
      } satisfies CertificationItem;
    })
    .filter(hasCertificationData);
};

const parseResumeText = (text: string): ParsedResume => {
  const sections = parseSections(text);
  const headerText = sections.header.join(" ");
  const name = extractName(sections.header);

  const summary = trimTo(sections.summary.filter(Boolean).join(" "), 500);
  const email = trimTo(headerText.match(emailPattern)?.[0] ?? text.match(emailPattern)?.[0] ?? "", 120);
  const phone = pickPhone(text);
  const linkedin = trimTo(
    ensureUrl(headerText.match(linkedinPattern)?.[0] ?? text.match(linkedinPattern)?.[0] ?? ""),
    120
  );
  const github = trimTo(
    ensureUrl(headerText.match(githubPattern)?.[0] ?? text.match(githubPattern)?.[0] ?? ""),
    120
  );
  const address = extractAddress(sections.header, name);

  return {
    personal: {
      name,
      email,
      phone,
      address,
      linkedin,
      github,
      photo: "",
      summary
    },
    education: parseEducation(sections.education),
    experience: parseExperience(sections.experience),
    projects: parseProjects(sections.projects),
    skills: parseSkills(sections.skills),
    certifications: parseCertifications(sections.certifications)
  };
};

const mergeResumeData = (current: ResumeData, extracted: ParsedResume): ResumeData => {
  const mergedPersonal = {
    ...current.personal,
    ...Object.fromEntries(
      Object.entries(extracted.personal ?? {}).filter(([, value]) => Boolean((value ?? "").trim()))
    )
  };

  return {
    personal: {
      ...mergedPersonal,
      name: trimTo(mergedPersonal.name, 80),
      email: trimTo(mergedPersonal.email, 120),
      phone: trimTo(mergedPersonal.phone, 20),
      address: trimTo(mergedPersonal.address, 120),
      linkedin: trimTo(mergedPersonal.linkedin, 120),
      github: trimTo(mergedPersonal.github, 120),
      photo: mergedPersonal.photo,
      summary: trimTo(mergedPersonal.summary, 500)
    },
    education:
      extracted.education && extracted.education.some(hasEducationData)
        ? extracted.education
        : current.education,
    experience:
      extracted.experience && extracted.experience.some(hasExperienceData)
        ? extracted.experience
        : current.experience,
    projects:
      extracted.projects && extracted.projects.some(hasProjectData)
        ? extracted.projects
        : current.projects,
    skills:
      extracted.skills && extracted.skills.length
        ? extracted.skills
        : current.skills,
    certifications:
      extracted.certifications && extracted.certifications.some(hasCertificationData)
        ? extracted.certifications
        : current.certifications
  };
};

const extractPdfText = async (file: File) => {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;
    const lines: string[] = [];
    for (const item of items) {
      if (!item.str) continue;
      lines.push(item.str);
      lines.push(item.hasEOL ? "\n" : " ");
    }
    pages.push(lines.join(""));
  }

  await loadingTask.destroy();
  return pages.join("\n");
};

const extractDocxText = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX file does not contain a readable document.");
  const document = new DOMParser().parseFromString(documentXml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error("DOCX document content is invalid.");
  }
  return Array.from(document.getElementsByTagNameNS("*", "p"))
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS("*", "t"))
      .map((node) => node.textContent ?? "").join("").trim())
    .filter(Boolean)
    .join("\n");
};

const extractPptxText = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const aNum = Number((a.match(/slide(\d+)\.xml/i)?.[1] ?? "0"));
      const bNum = Number((b.match(/slide(\d+)\.xml/i)?.[1] ?? "0"));
      return aNum - bNum;
    });

  if (!slidePaths.length) {
    return "";
  }

  const slideText: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = Array.from(doc.getElementsByTagNameNS("*", "t"));
    const text = nodes
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text) slideText.push(text);
  }

  return slideText.join("\n");
};

const extractImageText = async (file: File) => {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "eng");
  return data?.text ?? "";
};

export const importResumeFromFile = async (file: File, current: ResumeData): Promise<ResumeData> => {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("File is too large. Please use a file smaller than 15 MB.");
  }
  const filename = file.name.toLowerCase();
  const isPdf = filename.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx = filename.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isText = filename.endsWith(".txt") || file.type === "text/plain";
  const isPptx =
    filename.endsWith(".pptx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const isPpt = filename.endsWith(".ppt") || file.type === "application/vnd.ms-powerpoint";
  const isJpg =
    filename.endsWith(".jpg") || filename.endsWith(".jpeg") || file.type === "image/jpeg";
  const isPng = filename.endsWith(".png") || file.type === "image/png";
  const isImage = isJpg || isPng;

  if (!isPdf && !isDocx && !isText && !isPptx && !isPpt && !isImage) {
    throw new Error("Unsupported format. Please upload PDF, DOCX, TXT, PPTX, JPG, or PNG.");
  }

  let text = "";
  if (isPdf) {
    text = await extractPdfText(file);
  } else if (isDocx) {
    try {
      text = await extractDocxText(file);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("DOCX")) throw error;
      throw new Error("Unable to read this DOCX file. Please try a valid Word document.");
    }
  } else if (isText) {
    text = await file.text();
  } else if (isImage) {
    text = await extractImageText(file);
  } else {
    try {
      text = await extractPptxText(file);
    } catch (_error) {
      if (isPpt) {
        throw new Error("Legacy .ppt files are not supported. Save as .pptx and try again.");
      }
      throw new Error("Unable to read PowerPoint file. Please try a valid .pptx file.");
    }
  }

  if (!text.trim()) {
    throw new Error("No readable text found in the file.");
  }

  const extracted = parseResumeText(text);
  return mergeResumeData(current, extracted);
};
