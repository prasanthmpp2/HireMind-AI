import { beforeEach, describe, expect, it } from "vitest";
import { getSavedResumes, saveResume } from "./savedResumeStorage";
import { defaultResume, defaultSectionOrder } from "../../lib/resume";

describe("local saved resumes", () => {
  beforeEach(() => localStorage.clear());

  it("keeps selected design settings with a named saved copy", () => {
    const design = {
      template: "ocean" as const,
      font: "poppins" as const,
      font_size: "large" as const,
      section_order: [...defaultSectionOrder].reverse()
    };
    saveResume({ ...defaultResume, personal: { ...defaultResume.personal, name: "Zoë Li" } }, design);
    const [saved] = getSavedResumes();
    expect(saved.name).toBe("Zoë Li");
    expect(saved.design).toEqual(design);
    expect(saved.resume.personal.name).toBe("Zoë Li");
  });
});
