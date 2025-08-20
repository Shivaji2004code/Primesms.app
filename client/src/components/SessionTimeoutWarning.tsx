import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  warningTimeMinutes?: number;
}

export function SessionTimeoutWarning({
  isOpen,
  onStayLoggedIn,
  onLogout,
  warningTimeMinutes = 2
}: SessionTimeoutWarningProps) {
  const [countdown, setCountdown] = useState(warningTimeMinutes * 60);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCountdown(warningTimeMinutes * 60);
    }
  }, [isOpen, warningTimeMinutes]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-logout when countdown reaches 0
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onLogout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStayLoggedIn = () => {
    setIsVisible(false);
    setTimeout(() => onStayLoggedIn(), 300); // Delay for smooth animation
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onLogout}
      />
      
      {/* Modal */}
      <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-300 ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        <Card className="w-full max-w-md mx-auto shadow-2xl border-2 border-red-200 bg-white animate-pulse-border">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200">
            <CardTitle className="flex items-center space-x-3 text-red-800">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
              </div>
              <span>Session Timeout Warning</span>
            </CardTitle>
            <CardDescription className="text-red-700">
              Your session will expire due to inactivity
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Countdown Display */}
            <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full animate-pulse">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600 font-mono">
                  {formatTime(countdown)}
                </div>
                <div className="text-sm text-gray-600">
                  Time remaining
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="text-center space-y-2">
              <p className="text-gray-700">
                You will be automatically logged out in <strong className="text-red-600">{formatTime(countdown)}</strong> due to inactivity.
              </p>
              <p className="text-sm text-gray-500">
                Click "Stay Logged In" to continue your session, or you'll be redirected to the login page.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleStayLoggedIn}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Stay Logged In
              </Button>
              
              <Button
                onClick={onLogout}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 font-semibold py-3 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout Now
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-center pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                This helps protect your account when you're away from your computer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes pulse-border {
          0%, 100% {
            border-color: rgb(252 165 165);
          }
          50% {
            border-color: rgb(239 68 68);
          }
        }
        
        .animate-pulse-border {
          animation: pulse-border 2s infinite;
        }
      `}</style>
    </>
  );
}