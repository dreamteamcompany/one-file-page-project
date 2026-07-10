
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PushNotificationPrompt from "@/components/notifications/PushNotificationPrompt";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ImageLightboxProvider } from "@/components/shared/ImageLightbox";
import Login from "./pages/Login";
import Dashboard2 from "./pages/Dashboard2";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import CustomFields from "./pages/CustomFields";
import LogAnalyzer from "./pages/LogAnalyzer";
import Settings from "./pages/Settings";
import VsdeskSettings from "./pages/VsdeskSettings";
import AutomationSettings from "./pages/AutomationSettings";
import IntegrationsSettings from "./pages/IntegrationsSettings";
import KnowledgeBase from "./pages/KnowledgeBase";
import Tickets from "./pages/Tickets";
import TicketDetails from "./pages/TicketDetails";
import TicketServices from "./pages/TicketServices";
import TicketServicesManagement from "./pages/TicketServicesManagement";
import TicketServiceCategories from "./pages/TicketServiceCategories";
import TicketStatuses from "./pages/TicketStatuses";
import TicketPriorities from "./pages/TicketPriorities";
import TicketWatcherRules from "./pages/TicketWatcherRules";
import SLA from "./pages/SLA";
import SlaServiceMappings from "./pages/SlaServiceMappings";
import ServiceProviders from "./pages/ServiceProviders";
import FieldRegistry from "./pages/FieldRegistry";
import Services from "./pages/Services";
import CustomFieldGroups from "./pages/CustomFieldGroups";
import ServiceFieldMappings from "./pages/ServiceFieldMappings";
import Companies from "./pages/Companies";
import Departments from "./pages/Departments";
import Positions from "./pages/Positions";
import ExecutorGroups from "./pages/ExecutorGroups";
import ExecutorAssignments from "./pages/ExecutorAssignments";
import WorkSchedules from "./pages/WorkSchedules";
import BitrixCallback from "./pages/BitrixCallback";
import AiTraining from "./pages/AiTraining";
import BitrixInactiveUsers from "./pages/BitrixInactiveUsers";
import OrgChart from "./pages/OrgChart";
import ReplyTemplates from "./pages/ReplyTemplates";
import NotFound from "./pages/NotFound";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ImageLightboxProvider>
        <Toaster />
        <Sonner />
        <PushNotificationPrompt />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/bitrix/callback" element={<BitrixCallback />} />
            <Route path="/" element={<ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'read' }}><Dashboard2 /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}><Users /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute requiredPermission={{ resource: 'roles', action: 'read' }}><Roles /></ProtectedRoute>} />
            <Route path="/custom-fields" element={<ProtectedRoute requiredPermission={{ resource: 'custom_fields', action: 'read' }}><CustomFields /></ProtectedRoute>} />
            <Route path="/log-analyzer" element={<ProtectedRoute><LogAnalyzer /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/vsdesk" element={<ProtectedRoute><VsdeskSettings /></ProtectedRoute>} />
            <Route path="/settings/automation" element={<ProtectedRoute><AutomationSettings /></ProtectedRoute>} />
            <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationsSettings /></ProtectedRoute>} />
            <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
            <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
            <Route path="/ticket-services" element={<ProtectedRoute><TicketServices /></ProtectedRoute>} />
            <Route path="/ticket-services-management" element={<ProtectedRoute><TicketServicesManagement /></ProtectedRoute>} />
            <Route path="/ticket-service-categories" element={<ProtectedRoute><TicketServiceCategories /></ProtectedRoute>} />
            <Route path="/ticket-statuses" element={<ProtectedRoute><TicketStatuses /></ProtectedRoute>} />
            <Route path="/ticket-priorities" element={<ProtectedRoute><TicketPriorities /></ProtectedRoute>} />
            <Route path="/ticket-watcher-rules" element={<ProtectedRoute requiredPermission={{ resource: 'ticket_priorities', action: 'read' }}><TicketWatcherRules /></ProtectedRoute>} />
            <Route path="/sla" element={<ProtectedRoute><SLA /></ProtectedRoute>} />
            <Route path="/sla-service-mappings" element={<ProtectedRoute><SlaServiceMappings /></ProtectedRoute>} />
            <Route path="/service-providers" element={<ProtectedRoute><ServiceProviders /></ProtectedRoute>} />
            <Route path="/field-registry" element={<ProtectedRoute><FieldRegistry /></ProtectedRoute>} />
            <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
            <Route path="/custom-field-groups" element={<ProtectedRoute><CustomFieldGroups /></ProtectedRoute>} />
            <Route path="/service-field-mappings" element={<ProtectedRoute><ServiceFieldMappings /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
            <Route path="/positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
            <Route path="/executor-groups" element={<ProtectedRoute requiredPermission={{ resource: 'executor_groups', action: 'read' }}><ExecutorGroups /></ProtectedRoute>} />
            <Route path="/executor-assignments" element={<ProtectedRoute requiredPermission={{ resource: 'executor_groups', action: 'read' }}><ExecutorAssignments /></ProtectedRoute>} />
            <Route path="/work-schedules" element={<ProtectedRoute requiredPermission={{ resource: 'executor_groups', action: 'read' }}><WorkSchedules /></ProtectedRoute>} />
            <Route path="/ai-training" element={<ProtectedRoute><AiTraining /></ProtectedRoute>} />
            <Route path="/bitrix-inactive-users" element={<ProtectedRoute><BitrixInactiveUsers /></ProtectedRoute>} />
            <Route path="/org-chart" element={<ProtectedRoute><OrgChart /></ProtectedRoute>} />
            <Route path="/reply-templates" element={<ProtectedRoute><ReplyTemplates /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </ImageLightboxProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;