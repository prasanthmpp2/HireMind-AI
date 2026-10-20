import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../app/ToastContext";
import { JobsPage } from "./JobsPage";

describe("recruiter jobs", () => {
  it("creates a job through the configured API and reports success", async () => {
    const created = {
      id: 71, title: "Platform Engineer", department: "Engineering", experience_required: "",
      experience_years_min: 0, required_skills: [], nice_to_have_skills: [], responsibilities: [],
      raw_description: "Build dependable systems.", match_count: 0
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = init?.method === "POST" ? { item: created } : { items: [] };
      return { ok: true, status: 200, json: async () => payload } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ToastProvider><JobsPage /></ToastProvider></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Job title *"), { target: { value: "Platform Engineer" } });
    fireEvent.change(screen.getByLabelText("Job description *"), { target: { value: "Build dependable systems." } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));

    expect(await screen.findByText("Job created.")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/jobs$/), expect.objectContaining({ method: "POST" })));
    vi.unstubAllGlobals();
  });
});
