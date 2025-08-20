import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

interface AutoLogoutConfig {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onWarning?: () => void;
  onLogout?: () => void;
}

export const useAutoLogout = ({
  timeoutMinutes = 10,
  warningMinutes = 2,
  onWarning,
  onLogout
}: AutoLogoutConfig = {}) => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(false);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

  // Logout function
  const performLogout = useCallback(async () => {
    console.log('🚪 Auto-logout triggered due to inactivity');
    
    try {
      // Call backend logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error during auto-logout:', error);
    }

    // Call custom logout handler if provided
    if (onLogout) {
      onLogout();
    }

    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Navigate to login page
    navigate('/login', { replace: true });
    
    // Reload the page to ensure clean state
    window.location.reload();
  }, [navigate, onLogout]);

  // Show warning function
  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      console.log('⚠️ Session warning: Auto-logout in 2 minutes');
      
      if (onWarning) {
        onWarning();
      } else {
        // Default warning behavior
        const shouldStay = window.confirm(
          `Your session will expire in ${warningMinutes} minutes due to inactivity. Click OK to stay logged in.`
        );
        
        if (shouldStay) {
          // Reset activity to extend session
          resetActivity();
        }
      }
    }
  }, [onWarning, warningMinutes]);

  // Reset activity function
  const resetActivity = useCallback(async () => {
    // Only reset activity if user is logged in and not currently loading
    if (!user || isLoading || !isActiveRef.current) {
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    warningShownRef.current = false;

    // Clear existing timers
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Call backend to reset session activity
    try {
      await fetch('/api/auth/reset-activity', {
        method: 'POST',
        credentials: 'include'
      });
      console.log(`🔄 Activity reset for user ${user.username}. Session extended on server.`);
    } catch (error) {
      console.error('Error resetting activity on server:', error);
    }

    // Set new warning timer
    warningTimerRef.current = setTimeout(showWarning, warningMs);
    
    // Set new logout timer
    logoutTimerRef.current = setTimeout(performLogout, timeoutMs);

    console.log(`🔄 Frontend timers reset for user ${user.username}. Auto-logout in ${timeoutMinutes} minutes`);
  }, [timeoutMs, warningMs, showWarning, performLogout, timeoutMinutes, user, isLoading]);

  // Check session validity with server
  const checkSessionValidity = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        // Session expired on server
        console.log('🚪 Session expired on server, logging out');
        performLogout();
        return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return true; // Don't logout on network errors
    }
  }, [performLogout]);

  // Activity event handlers
  const handleActivity = useCallback(async () => {
    await resetActivity();
  }, [resetActivity]);

  // Effect to manage auto-logout activation based on user login status
  useEffect(() => {
    if (user && !isLoading) {
      // User is logged in, activate auto-logout
      isActiveRef.current = true;
      console.log(`🔐 Auto-logout activated for user ${user.username}`);
      resetActivity(); // Initialize timers
    } else {
      // User is not logged in, deactivate auto-logout
      isActiveRef.current = false;
      
      // Clear any existing timers
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      
      console.log('🔐 Auto-logout deactivated (user not logged in)');
    }
  }, [user, isLoading, resetActivity]);

  useEffect(() => {
    // Only set up activity listeners if user is logged in
    if (!user || isLoading) {
      return;
    }

    // List of events that constitute user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Throttle activity detection to avoid excessive resets
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(async () => {
        await handleActivity();
        throttleTimer = null;
      }, 5000); // Throttle to every 5 seconds
    };

    // Add activity event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledActivity, true);
    });

    // Set up session validity check interval
    const sessionCheckInterval = setInterval(checkSessionValidity, 30000); // Check every 30 seconds

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledActivity, true);
      });

      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
      
      clearInterval(sessionCheckInterval);
    };
  }, [handleActivity, checkSessionValidity, user, isLoading]);

  // Handle page visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check session when user returns to tab
        checkSessionValidity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSessionValidity]);

  return {
    resetActivity,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, timeoutMs - elapsed);
      return Math.ceil(remaining / 1000); // Return seconds
    },
    isWarningShown: () => warningShownRef.current
  };
};