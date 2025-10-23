import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EnhancedDashboard from './components/EnhancedDashboard';
import Clients from './components/Clients';
import BulkUpload from './components/BulkUpload';
import UnifiedEmail from './components/UnifiedEmail';
import Templates from './components/Templates';
import EmailLogs from './components/EmailLogs';
import Settings from './components/Settings';
import CampaignManagement from './components/CampaignManagement';
import ConferenceManagement from './components/ConferenceManagement';
import EnhancedUserManagement from './components/EnhancedUserManagement';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<EnhancedDashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="bulk-upload" element={<BulkUpload />} />
        <Route path="email" element={<UnifiedEmail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="campaigns" element={<CampaignManagement />} />
        <Route path="conferences" element={<ConferenceManagement />} />
        <Route path="users" element={<EnhancedUserManagement />} />
        <Route path="email-logs" element={<EmailLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="App">
            <AppRoutes />
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
