import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceLayout } from "./WorkspaceLayout";

vi.mock("../api/client", () => ({
  api: { session: vi.fn().mockResolvedValue({ id: 1, email: "candidate@example.test", role: "candidate", candidate_id: 1 }), logout: vi.fn() }
}));

describe("workspace layouts", () => {
  it("shows the candidate navigation after the server validates the session", async () => {
    render(<MemoryRouter initialEntries={["/candidate"]}><Routes><Route path="/candidate" element={<WorkspaceLayout portal="candidate" />}><Route index element={<h1>Candidate overview</h1>} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Candidate overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Resume builder/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
