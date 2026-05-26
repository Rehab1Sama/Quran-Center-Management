import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import CirclesPage from "@/pages/circles";
import LeaderCirclesPage from "@/pages/leader-circles";
import DataEntryStatusPage from "@/pages/data-entry-status";
import AccountsPage from "@/pages/accounts";
import StatisticsPage from "@/pages/statistics";
import RegistrationManagePage from "@/pages/registration-manage";
import AttendancePage from "@/pages/attendance";
import DataEntryPage from "@/pages/data-entry";
import MyCirclePage from "@/pages/my-circle";
import MyProgressPage from "@/pages/my-progress";
import AudioPage from "@/pages/audio";
import TrackPage from "@/pages/track";
import RegisterPage from "@/pages/register";
import StaffRegisterPage from "@/pages/staff-register";
import OnboardPage from "@/pages/onboard";
import RegisterExistingPage from "@/pages/register-existing";
import ExportPage from "@/pages/export";
import StudentProfilePage from "@/pages/student-profile";
import MonthlyReportPage from "@/pages/monthly-report";
import MessagesPage from "@/pages/messages";
import MyMessagesPage from "@/pages/my-messages";
import ArchivedStudentsPage from "@/pages/archived-students";
import ManageTracksPage from "@/pages/manage-tracks";
import DailyTasksPage from "@/pages/daily-tasks";
import LeaderTasksPage from "@/pages/leader-tasks";
import CalendarPage from "@/pages/calendar";
import StorePage from "@/pages/store";
import StoreManagePage from "@/pages/store-manage";
import VolunteerPage from "@/pages/volunteer";
import BadgesPage from "@/pages/badges";
import TeacherRotationPage from "@/pages/teacher-rotation";
import ShortcomingsPage from "@/pages/shortcomings";
import StumblingStatsPage from "@/pages/stumbling-stats";
import ReviewPlansPage from "@/pages/review-plans";
import ThursdayReviewPage from "@/pages/thursday-review";
import DeputyTasksPage from "@/pages/deputy-tasks";
import DeputyBoardPage from "@/pages/deputy-board";
import DeputyCirclesPage from "@/pages/deputy-circles";
import PendingRegistrationsPage from "@/pages/pending-registrations";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function getHomePageForRole(role: string) {
  if (role === "leader") return DashboardPage;
  if (role === "deputy") return DashboardPage;
  if (role === "data_entry") return DataEntryPage;
  if (role === "teacher" || role === "supervisor") return MyCirclePage;
  if (role === "student") return MyProgressPage;
  if (role === "track_supervisor") return TrackPage;
  return DashboardPage;
}

function AppRoutes() {
  const token = getToken();
  const { data: user, isLoading } = useGetCurrentUser({
    query: { enabled: !!token, queryKey: ["getCurrentUser"] }
  });

  if (isLoading && token) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg-soft">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary font-semibold text-lg">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <Switch>
        <Route path="/register" component={RegisterPage} />
        <Route path="/register-existing" component={RegisterExistingPage} />
        <Route path="/staff-register" component={StaffRegisterPage} />
        <Route path="/store" component={StorePage} />
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  const HomePage = getHomePageForRole(user.role);
  const isLeader = user.role === "leader";
  const isDeputy = (user.role as string) === "deputy";
  const isLeaderOrDeputy = isLeader || isDeputy;
  const isTrackSupervisor = user.role === "track_supervisor";
  const isDataEntry = user.role === "data_entry";
  const isStudent = user.role === "student";
  const isTeacher = user.role === "teacher";
  const isSupervisor = user.role === "supervisor";
  const isVolunteer = user.role === "volunteer";
  const isExamSupervisor = user.role === "exam_supervisor";
  const canViewStats = ["leader", "deputy", "track_supervisor", "teacher", "supervisor", "student", "exam_supervisor"].includes(user.role);
  const canViewProfile = isLeader || isDeputy || isTrackSupervisor || isTeacher || isSupervisor;

  return (
    <Layout user={user}>
      <Switch>
        {(isVolunteer || isExamSupervisor)
          ? <Route path="/"><VolunteerPage userRole={user.role} /></Route>
          : <Route path="/" component={HomePage} />}

        <Route path="/register" component={RegisterPage} />
        <Route path="/register-existing" component={RegisterExistingPage} />
        <Route path="/staff-register" component={StaffRegisterPage} />
        <Route path="/login"><Redirect to="/" /></Route>

        {/* Leader and Deputy shared routes */}
        <Route path="/circles">
          {(isLeader || isTrackSupervisor) ? <LeaderCirclesPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/deputy-circles">
          {isDeputy ? <DeputyCirclesPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/data-entry-status">
          {isLeader ? <DataEntryStatusPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/accounts">
          {isLeaderOrDeputy ? <AccountsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/statistics">
          {canViewStats ? <StatisticsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/data-entry">
          {(isLeader || isDataEntry) ? <DataEntryPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/registration">
          {isLeader ? <RegistrationManagePage /> : <Redirect to="/" />}
        </Route>
        <Route path="/pending-registrations">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <PendingRegistrationsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/onboard">
          {isLeaderOrDeputy ? <OnboardPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/export">
          {isLeaderOrDeputy ? <ExportPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/monthly-report">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <MonthlyReportPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/archived-students">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <ArchivedStudentsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/manage-tracks">
          {isLeaderOrDeputy ? <ManageTracksPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/leader-tasks">
          {isLeaderOrDeputy ? <LeaderTasksPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/daily-tasks">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <DailyTasksPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/messages">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <MessagesPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/my-messages">
          {(isStudent || isTeacher || isSupervisor || isTrackSupervisor)
            ? <MyMessagesPage />
            : <Redirect to="/" />}
        </Route>
        <Route path="/attendance">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <AttendancePage /> : <Redirect to="/" />}
        </Route>
        <Route path="/audio">
          {isStudent ? <AudioPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/store" component={StorePage} />
        <Route path="/store-manage">
          {isLeaderOrDeputy ? <StoreManagePage /> : <Redirect to="/" />}
        </Route>
        <Route path="/teacher-rotation">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <TeacherRotationPage userRole={user.role} /> : <Redirect to="/" />}
        </Route>
        <Route path="/calendar">
          <CalendarPage userRole={user.role} userId={user.id} />
        </Route>
        <Route path="/shortcomings">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <ShortcomingsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/stumbling-stats">
          {(isLeaderOrDeputy || isTrackSupervisor) ? <StumblingStatsPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/review-plans">
          {(isLeaderOrDeputy || isTrackSupervisor || isTeacher || isSupervisor || isStudent) ? <ReviewPlansPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/thursday-review">
          {isLeader ? <ThursdayReviewPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/badges">
          <BadgesPage userRole={user.role} userId={user.id} />
        </Route>
        <Route path="/volunteer">
          {(isVolunteer || isExamSupervisor || isLeaderOrDeputy || isTrackSupervisor)
            ? <VolunteerPage userRole={user.role} />
            : <Redirect to="/" />}
        </Route>

        {/* Deputy specific routes */}
        <Route path="/deputy-tasks">
          {isDeputy ? <DeputyTasksPage /> : <Redirect to="/" />}
        </Route>
        <Route path="/deputy-board">
          {isLeader ? <DeputyBoardPage /> : <Redirect to="/" />}
        </Route>

        <Route path="/students/:id">
          {(params) =>
            canViewProfile
              ? <StudentProfilePage id={parseInt(params.id)} />
              : <Redirect to="/" />
          }
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
