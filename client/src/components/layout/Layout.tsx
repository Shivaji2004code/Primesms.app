import { type ReactNode, useState } from 'react';
import Header from './Header';
import { NotificationSystem } from '../ui/notification-system';
import { useAuth } from '../../hooks/useAuth';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import { SessionTimeoutWarning } from '../SessionTimeoutWarning';
import { Loader2 } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isLoading } = useAuth();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Auto-logout functionality for authenticated users (only activate if user is logged in)
  const { resetActivity } = useAutoLogout({
    timeoutMinutes: 10,
    warningMinutes: 2,
    onWarning: () => {
      // Only show warning if user is actually logged in
      if (user) {
        console.log('🔔 Showing session timeout warning in Layout');
        setShowTimeoutWarning(true);
      }
    },
    onLogout: () => {
      console.log('🚪 Auto-logout executed in Layout');
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

  // Don't show header for non-authenticated users or on auth pages
  const showHeader = user && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup') && window.location.pathname !== '/';

  return (
    <div className="min-h-screen bg-gray-50">
      {showHeader && <Header />}
      <main className={showHeader ? "pt-0" : ""}>
        {children}
      </main>
      
      {/* Global Notification System */}
      <NotificationSystem />

      {/* Session Timeout Warning Modal - Only for authenticated users */}
      {user && (
        <SessionTimeoutWarning
          isOpen={showTimeoutWarning}
          onStayLoggedIn={() => {
            console.log('👤 User chose to stay logged in in Layout');
            setShowTimeoutWarning(false);
            resetActivity();
          }}
          onLogout={async () => {
            console.log('👤 User chose to logout from warning in Layout');
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
      )}
      
      {/* Footer */}
      {showHeader && (
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">P</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Prime SMS</p>
                  <p className="text-xs text-gray-500">WhatsApp Business Platform</p>
                </div>
              </div>
              <div className="text-right">
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
      )}
    </div>
  );
}