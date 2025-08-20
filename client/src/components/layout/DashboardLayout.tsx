import { type ReactNode, useState } from 'react';
import SideNav from './SideNav';
import MobileNav from './MobileNav';
import Header from './Header';
import { NotificationSystem } from '../ui/notification-system';
import { useAuth } from '../../hooks/useAuth';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import { SessionTimeoutWarning } from '../SessionTimeoutWarning';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '../ui/button';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const { user, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Auto-logout functionality for authenticated users
  const { resetActivity } = useAutoLogout({
    timeoutMinutes: 10,
    warningMinutes: 2,
    onWarning: () => {
      console.log('🔔 Showing session timeout warning');
      setShowTimeoutWarning(true);
    },
    onLogout: () => {
      console.log('🚪 Auto-logout executed');
      setShowTimeoutWarning(false);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Prime SMS...</p>
        </div>
      </div>
    );
  }

  // Don't show dashboard layout for non-authenticated users
  if (!user) {
    return <div>{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex">
      {/* Fixed Desktop Sidebar */}
      <SideNav />
      
      {/* Mobile Navigation */}
      <MobileNav 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-72 w-full">
        {/* Mobile Header Bar */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(true)}
            className="h-8 w-8 p-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Prime SMS</span>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
        
        {/* Header */}
        <Header title={title} subtitle={subtitle} />
        
        {/* Main Content */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-auto">
          <div className="max-w-screen-xl mx-auto w-full">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4 safe-bottom">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Prime SMS</p>
                  <p className="text-xs text-gray-500 -mt-1">WhatsApp Business Platform</p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs text-gray-500">
                  © 2025 Prime SMS. All rights reserved.
                </p>
                <p className="text-xs text-gray-400">
                  Powered by WhatsApp Business API
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
      
      {/* Global Notification System */}
      <NotificationSystem />

      {/* Session Timeout Warning Modal */}
      <SessionTimeoutWarning
        isOpen={showTimeoutWarning}
        onStayLoggedIn={() => {
          console.log('👤 User chose to stay logged in');
          setShowTimeoutWarning(false);
          resetActivity();
        }}
        onLogout={async () => {
          console.log('👤 User chose to logout from warning');
          setShowTimeoutWarning(false);
          
          try {
            // Call logout endpoint
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include'
            });
          } catch (error) {
            console.error('Error during manual logout:', error);
          }

          // Clear storage and redirect
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
        }}
        warningTimeMinutes={2}
      />
    </div>
  );
}