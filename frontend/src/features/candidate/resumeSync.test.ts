import { describe, expect, it, vi } from "vitest";
import type { ResumeDraft } from "../../api/types";
import { applyDraftToEditor } from "./resumeSync";

describe("structured resume editor mapping", () => {
  it("restores every editor section and the rendering metadata", () => {
    const draft: ResumeDraft = {
      id: 9, candidate_id: 4, name: "Unicode resume", schema_version: 1,
      resume: {
        personal: { name: "Zoë 李", email: "zoe@example.test", phone: "+1 555", address: "東京", linkedin: "https://linkedin.com/in/zoe", github: "https://github.com/zoe", photo: "data:image/png;base64,AA==", summary: "Summary" },
        education: [{ degree: "MSc", institution: "大学", year: "2024", score: "A" }],
        experience: [{ company: "Example", role: "Engineer", duration: "2022–2024", description: "Built it." }],
        projects: [{ name: "Project", link: "https://example.test", description: "Details", tech: "React" }],
        skills: ["TypeScript"], certifications: [{ name: "Certificate", issuer: "Org", year: "2025" }]
      },
      design: { template: "emerald", font: "merriweather", font_size: "large", section_order: ["summary", "experience", "education", "projects", "skills", "certifications"] },
      created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z"
    };
    const setters = { setResume: vi.fn(), setTemplate: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(), setSectionOrder: vi.fn() };
    applyDraftToEditor(draft, setters);
    expect(setters.setResume).toHaveBeenCalledWith(draft.resume);
    expect(setters.setTemplate).toHaveBeenCalledWith("emerald");
    expect(setters.setFont).toHaveBeenCalledWith("merriweather");
    expect(setters.setFontSize).toHaveBeenCalledWith("large");
    expect(setters.setSectionOrder).toHaveBeenCalledWith(draft.design.section_order);
    expect(localStorage.getItem("irb-resume-data-v2")).toBe(JSON.stringify(draft.resume));
  });
});
