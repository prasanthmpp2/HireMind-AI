import { Navigate, Route, Routes } from "react-router-dom";
import { CandidateDashboardPage } from "../features/candidate/CandidateDashboardPage";
import { ProfileSettingsPage } from "../features/candidate/ProfileSettingsPage";
import { SavedResumesPage } from "../features/candidate/SavedResumesPage";
import { ResumeBuilderRoute } from "../features/candidate/ResumeBuilderRoute";
import { CandidateDetailPage } from "../features/recruiter/CandidateDetailPage";
import { InterviewStudioPage } from "../features/recruiter/InterviewStudioPage";
import { JobsPage } from "../features/recruiter/JobsPage";
import { MatchesPage } from "../features/recruiter/MatchesPage";
import { RecruiterDashboardPage } from "../features/recruiter/RecruiterDashboardPage";
import { ScreeningPage } from "../features/recruiter/ScreeningPage";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { AuthPage } from "../features/auth/AuthPage";
import { LandingPage } from "../features/auth/LandingPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/candidate" element={<WorkspaceLayout portal="candidate" />}>
        <Route index element={<CandidateDashboardPage />} />
        <Route path="resume-builder" element={<ResumeBuilderRoute />} />
        <Route path="resumes" element={<SavedResumesPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
      </Route>
      <Route path="/recruiter" element={<WorkspaceLayout portal="recruiter" />}>
        <Route index element={<RecruiterDashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="screening" element={<ScreeningPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="candidates/:candidateId" element={<CandidateDetailPage />} />
        <Route path="interviews" element={<InterviewStudioPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/candidate" replace />} />
    </Routes>
  );
}

