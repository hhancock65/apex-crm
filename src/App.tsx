import { Route, Routes } from "react-router-dom"

import AppLayout from "@/components/layout/AppLayout"
import ProtectedRoute from "@/components/ProtectedRoute"
import SignInPage from "@/pages/auth/SignInPage"
import SignUpPage from "@/pages/auth/SignUpPage"
import NotFound from "@/pages/NotFound"

import DashboardPage from "@/pages/overview/DashboardPage"
import AICommandCenterPage from "@/pages/overview/AICommandCenterPage"
import ActivityFeed from "@/pages/overview/ActivityFeed"

import LeadsPage from "@/pages/crm/LeadsPage"
import LeadDetailPage from "@/pages/crm/LeadDetailPage"
import ContactsPage from "@/pages/crm/ContactsPage"
import ContactDetailPage from "@/pages/crm/ContactDetailPage"
import Companies from "@/pages/crm/Companies"
import PipelinePage from "@/pages/crm/PipelinePage"
import DealsPage from "@/pages/crm/DealsPage"
import DealDetailPage from "@/pages/crm/DealDetailPage"

import AIEmployeesPage from "@/pages/ai-workforce/AIEmployeesPage"
import AIEmployeeDetailPage from "@/pages/ai-workforce/AIEmployeeDetailPage"
import AIActivityPage from "@/pages/ai-workforce/AIActivityPage"
import ConversationsPage from "@/pages/ai-workforce/ConversationsPage"
import ConversationDetailPage from "@/pages/ai-workforce/ConversationDetailPage"
import MessagesPage from "@/pages/ai-workforce/MessagesPage"
import CallsPage from "@/pages/ai-workforce/CallsPage"
import CallDetailPage from "@/pages/ai-workforce/CallDetailPage"
import CampaignsPage from "@/pages/ai-workforce/CampaignsPage"
import CampaignDetailPage from "@/pages/ai-workforce/CampaignDetailPage"
import KnowledgeBase from "@/pages/ai-workforce/KnowledgeBase"

import TasksPage from "@/pages/productivity/TasksPage"
import CalendarPage from "@/pages/productivity/CalendarPage"
import AppointmentsPage from "@/pages/productivity/AppointmentsPage"
import Notes from "@/pages/productivity/Notes"

import WorkflowsPage from "@/pages/automation/WorkflowsPage"
import WorkflowBuilderPage from "@/pages/automation/WorkflowBuilderPage"
import WorkflowRunDetailPage from "@/pages/automation/WorkflowRunDetailPage"
import Triggers from "@/pages/automation/Triggers"
import Templates from "@/pages/automation/Templates"
import Integrations from "@/pages/automation/Integrations"

import SalesAnalyticsPage from "@/pages/analytics/SalesAnalyticsPage"
import AIPerformancePage from "@/pages/analytics/AIPerformancePage"
import ConversionAnalytics from "@/pages/analytics/ConversionAnalytics"
import RevenueAttributionPage from "@/pages/analytics/RevenueAttributionPage"

import TeamPage from "@/pages/admin/TeamPage"
import RolesPermissionsPage from "@/pages/admin/RolesPermissionsPage"
import BillingPage from "@/pages/admin/BillingPage"
import PricingPage from "@/pages/admin/PricingPage"
import UsageHistoryPage from "@/pages/admin/UsageHistoryPage"
import JHDMAdminPage from "@/pages/admin/JHDMAdminPage"
import SettingsPage from "@/pages/admin/SettingsPage"

import PartnerRegistrationPage from "@/pages/partner/PartnerRegistrationPage"
import PartnerDashboardPage from "@/pages/partner/PartnerDashboardPage"

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/partner/sign-up" element={<PartnerRegistrationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ai-command-center" element={<AICommandCenterPage />} />
          <Route path="/activity-feed" element={<ActivityFeed />} />

          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:id" element={<DealDetailPage />} />

          <Route path="/ai-employees" element={<AIEmployeesPage />} />
          <Route path="/ai-employees/:id" element={<AIEmployeeDetailPage />} />
          <Route path="/ai-activity" element={<AIActivityPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/conversations/:id" element={<ConversationDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/calls/:id" element={<CallDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />

          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/notes" element={<Notes />} />

          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:id" element={<WorkflowBuilderPage />} />
          <Route path="/workflows/:workflowId/runs/:runId" element={<WorkflowRunDetailPage />} />
          <Route path="/triggers" element={<Triggers />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/integrations" element={<Integrations />} />

          <Route path="/analytics/sales" element={<SalesAnalyticsPage />} />
          <Route path="/analytics/ai-performance" element={<AIPerformancePage />} />
          <Route path="/analytics/conversion" element={<ConversionAnalytics />} />
          <Route
            path="/analytics/revenue-attribution"
            element={<RevenueAttributionPage />}
          />

          <Route path="/pricing" element={<PricingPage />} />

          <Route path="/partner/dashboard" element={<PartnerDashboardPage />} />

          <Route path="/admin/team" element={<TeamPage />} />
          <Route path="/admin/roles-permissions" element={<RolesPermissionsPage />} />
          <Route path="/admin/billing" element={<BillingPage />} />
          <Route path="/admin/usage" element={<UsageHistoryPage />} />
          <Route path="/admin/jhdm" element={<JHDMAdminPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
