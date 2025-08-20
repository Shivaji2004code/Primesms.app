import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminRoute } from './components/guards/AdminRoute';
import { UserRoute } from './components/guards/UserRoute';
import { PrivateRoute } from './components/guards/PrivateRoute';
import { Toaster } from './components/ui/toaster';
import { LoadingProvider } from './contexts/LoadingContext';
import { NotificationProvider } from './contexts/NotificationContext';
import GlobalLoader from './components/ui/GlobalLoader';
import TopNotification from './components/ui/TopNotification';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserDetails from './pages/AdminUserDetails';
import AdminUserSettings from './pages/AdminUserSettings';
import AdminUserWallet from './pages/AdminUserWallet';
import AdminUserTemplates from './pages/AdminUserTemplates';
import AdminLogCleanup from './pages/AdminLogCleanup';
import NotificationTest from './pages/NotificationTest';
import UserDashboard from './pages/UserDashboard';
import ManageTemplatesWrapper from './components/ManageTemplatesWrapper';
import CreateTemplateWrapper from './components/CreateTemplateWrapper';
import WhatsAppBulkMessagingPage from './pages/WhatsAppBulkMessaging';
import CustomizeMessage from './pages/CustomizeMessage';
import ManageReports from './pages/ManageReports';
import APIManagement from './pages/APIManagement';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import Terms from './pages/Terms';
import Docs from './pages/Docs';
import Contact from './pages/Contact';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <NotificationProvider>
          <Router>
            <GlobalLoader />
            <TopNotification />
            <Routes>
          {/* Public routes - use old Layout */}
          <Route path="/" element={<Layout><Landing /></Layout>} />
          <Route path="/docs" element={<Layout><Docs /></Layout>} />
          <Route path="/contact" element={<Layout><Contact /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/signup" element={<Layout><Signup /></Layout>} />
          
          {/* Dashboard routes - use DashboardLayout (already included in components) */}
          <Route 
            path="/admin/dashboard" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users/:id/details" 
            element={
              <AdminRoute>
                <AdminUserDetails />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users/:id/settings" 
            element={
              <AdminRoute>
                <AdminUserSettings />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users/:id/wallet" 
            element={
              <AdminRoute>
                <AdminUserWallet />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users/:id/templates" 
            element={
              <AdminRoute>
                <AdminUserTemplates />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/logs" 
            element={
              <AdminRoute>
                <AdminLogCleanup />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/test-notifications" 
            element={
              <AdminRoute>
                <NotificationTest />
              </AdminRoute>
            } 
          />
          
          <Route 
            path="/user/dashboard" 
            element={
              <UserRoute>
                <UserDashboard />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/templates" 
            element={
              <UserRoute>
                <ManageTemplatesWrapper />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/templates/create" 
            element={
              <UserRoute>
                <CreateTemplateWrapper />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/templates/:id/edit" 
            element={
              <UserRoute>
                <CreateTemplateWrapper />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/whatsapp-bulk" 
            element={
              <UserRoute>
                <WhatsAppBulkMessagingPage />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/api-management" 
            element={
              <UserRoute>
                <APIManagement />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/customize-message" 
            element={
              <UserRoute>
                <CustomizeMessage />
              </UserRoute>
            } 
          />
          <Route 
            path="/user/manage-reports" 
            element={
              <UserRoute>
                <ManageReports />
              </UserRoute>
            } 
          />

          {/* Public: Privacy Policy */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Profile routes - accessible by both admin and user */}
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/admin/profile" 
            element={
              <AdminRoute>
                <Profile />
              </AdminRoute>
            } 
          />
          <Route 
            path="/user/profile" 
            element={
              <UserRoute>
                <Profile />
              </UserRoute>
            } 
          />
          
          {/* 404 Route */}
          <Route 
            path="*" 
            element={
              <Layout>
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-4">Page not found</p>
                    <button 
                      onClick={() => window.history.back()}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              </Layout>
            } 
          />
        </Routes>
        <Toaster />
          </Router>
        </NotificationProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
