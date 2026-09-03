
import { useState, lazy, Suspense } from "react";
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

const Dashboard2 = lazy(() => import("./pages/Dashboard2"));
const Users = lazy(() => import("./pages/Users"));
const Roles = lazy(() => import("./pages/Roles"));
const CustomFields = lazy(() => import("./pages/CustomFields"));
const LogAnalyzer = lazy(() => import("./pages/LogAnalyzer"));
const Settings = lazy(() => import("./pages/Settings"));
const AutomationSettings = lazy(() => import("./pages/AutomationSettings"));
const IntegrationsSettings = lazy(() => import("./pages/IntegrationsSettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const ResponseControl = lazy(() => import("./pages/ResponseControl"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetails = lazy(() => import("./pages/TicketDetails"));
const TicketServices = lazy(() => import("./pages/TicketServices"));
const TicketServicesManagement = lazy(() => import("./pages/TicketServicesManagement"));
const TicketServiceCategories = lazy(() => import("./pages/TicketServiceCategories"));
const AccessChecklistServices = lazy(() => import("./pages/AccessChecklistServices"));
const TicketStatuses = lazy(() => import("./pages/TicketStatuses"));
const TicketPriorities = lazy(() => import("./pages/TicketPriorities"));
const TicketWatcherRules = lazy(() => import("./pages/TicketWatcherRules"));
const SLA = lazy(() => import("./pages/SLA"));
const SlaServiceMappings = lazy(() => import("./pages/SlaServiceMappings"));
const ServiceProviders = lazy(() => import("./pages/ServiceProviders"));
const FieldRegistry = lazy(() => import("./pages/FieldRegistry"));
const Services = lazy(() => import("./pages/Services"));
const CustomFieldGroups = lazy(() => import("./pages/CustomFieldGroups"));
const ServiceFieldMappings = lazy(() => import("./pages/ServiceFieldMappings"));
const Companies = lazy(() => import("./pages/Companies"));
const Departments = lazy(() => import("./pages/Departments"));
const Positions = lazy(() => import("./pages/Positions"));
const ExecutorGroups = lazy(() => import("./pages/ExecutorGroups"));
const ExecutorAssignments = lazy(() => import("./pages/ExecutorAssignments"));
const WorkSchedules = lazy(() => import("./pages/WorkSchedules"));
const BitrixCallback = lazy(() => import("./pages/BitrixCallback"));
const AiTraining = lazy(() => import("./pages/AiTraining"));
const BitrixInactiveUsers = lazy(() => import("./pages/BitrixInactiveUsers"));
const OrgChart = lazy(() => import("./pages/OrgChart"));
const ReplyTemplates = lazy(() => import("./pages/ReplyTemplates"));
const TopicsAnalytics = lazy(() => import("./pages/TopicsAnalytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
  </div>
);

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
            <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/bitrix/callback" element={<BitrixCallback />} />
            <Route path="/" element={<ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'read' }}><Dashboard2 /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}><Users /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute requiredPermission={{ resource: 'roles', action: 'read' }}><Roles /></ProtectedRoute>} />
            <Route path="/custom-fields" element={<ProtectedRoute requiredPermission={{ resource: 'custom_fields', action: 'read' }}><CustomFields /></ProtectedRoute>} />
            <Route path="/log-analyzer" element={<ProtectedRoute><LogAnalyzer /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/automation" element={<ProtectedRoute><AutomationSettings /></ProtectedRoute>} />
            <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationsSettings /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="/settings/response-control" element={<ProtectedRoute requiredPermission={{ resource: 'response_control', action: 'read' }}><ResponseControl /></ProtectedRoute>} />
            <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
            <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
            <Route path="/ticket-services" element={<ProtectedRoute><TicketServices /></ProtectedRoute>} />
            <Route path="/ticket-services-management" element={<ProtectedRoute><TicketServicesManagement /></ProtectedRoute>} />
            <Route path="/ticket-service-categories" element={<ProtectedRoute><TicketServiceCategories /></ProtectedRoute>} />
            <Route path="/access-checklist-services" element={<ProtectedRoute><AccessChecklistServices /></ProtectedRoute>} />
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
            <Route path="/topics-analytics" element={<ProtectedRoute adminOnly><TopicsAnalytics /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </ImageLightboxProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;