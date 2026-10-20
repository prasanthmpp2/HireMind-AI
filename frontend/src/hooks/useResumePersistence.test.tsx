import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResume, defaultSectionOrder } from "../lib/resume";
import type { ResumeDesign } from "../api/types";
import { useResumePersistence } from "./useResumePersistence";

const design: ResumeDesign = {
  template: "ocean",
  font: "poppins",
  font_size: "large",
  section_order: [...defaultSectionOrder].reverse()
};

describe("resume autosave hydration", () => {
  beforeEach(() => localStorage.clear());

  it("restores the saved draft and appearance before enabling autosave in StrictMode", async () => {
    const saved = { ...defaultResume, personal: { ...defaultResume.personal, name: "Saved Candidate" } };
    localStorage.setItem("irb-resume-data-v2", JSON.stringify(saved));
    localStorage.setItem("irb-resume-design-v1", JSON.stringify(design));
    const setResume = vi.fn();
    const resetForm = vi.fn();
    const applyDesign = vi.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>;

    const { result, rerender } = renderHook(
      ({ resume }) => useResumePersistence(resume, setResume, resetForm, design, applyDesign),
      { initialProps: { resume: defaultResume }, wrapper }
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(setResume).toHaveBeenCalledWith(saved);
    expect(resetForm).toHaveBeenCalledWith(saved);
    expect(applyDesign).toHaveBeenCalledWith(design);

    const edited = { ...saved, personal: { ...saved.personal, name: "Edited Candidate" } };
    rerender({ resume: edited });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 300)); });
    expect(JSON.parse(localStorage.getItem("irb-resume-data-v2") || "{}").personal.name).toBe("Edited Candidate");
    expect(JSON.parse(localStorage.getItem("irb-resume-design-v1") || "{}")).toEqual(design);
  });
});
