
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PushNotificationPrompt from "@/components/notifications/PushNotificationPrompt";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard2 from "./pages/Dashboard2";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import CustomFields from "./pages/CustomFields";
import LogAnalyzer from "./pages/LogAnalyzer";
import Settings from "./pages/Settings";
import Tickets from "./pages/Tickets";
import TicketDetails from "./pages/TicketDetails";
import TicketServices from "./pages/TicketServices";
import TicketServicesManagement from "./pages/TicketServicesManagement";
import TicketServiceCategories from "./pages/TicketServiceCategories";
import ServiceProviders from "./pages/ServiceProviders";
import FieldRegistry from "./pages/FieldRegistry";
import CustomFieldGroups from "./pages/CustomFieldGroups";
import NotFound from "./pages/NotFound";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <PushNotificationPrompt />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard2 /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}><Users /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute requiredPermission={{ resource: 'roles', action: 'read' }}><Roles /></ProtectedRoute>} />
            <Route path="/custom-fields" element={<ProtectedRoute requiredPermission={{ resource: 'custom_fields', action: 'read' }}><CustomFields /></ProtectedRoute>} />
            <Route path="/log-analyzer" element={<ProtectedRoute><LogAnalyzer /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
            <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
            <Route path="/ticket-services" element={<ProtectedRoute><TicketServices /></ProtectedRoute>} />
            <Route path="/ticket-services-management" element={<ProtectedRoute><TicketServicesManagement /></ProtectedRoute>} />
            <Route path="/ticket-service-categories" element={<ProtectedRoute><TicketServiceCategories /></ProtectedRoute>} />
            <Route path="/service-providers" element={<ProtectedRoute><ServiceProviders /></ProtectedRoute>} />
            <Route path="/field-registry" element={<ProtectedRoute><FieldRegistry /></ProtectedRoute>} />
            <Route path="/custom-field-groups" element={<ProtectedRoute><CustomFieldGroups /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;