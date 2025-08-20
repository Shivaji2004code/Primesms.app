import { useNavigate } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  ChevronDown,
  CreditCard,
  Wallet
} from 'lucide-react';
import { Button } from '../ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard } from '../ui/glass-card';
import { FadeIn, HoverScale } from '../ui/motion-components';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  // Get page title from current path if not provided
  const getPageTitle = () => {
    if (title) return title;
    
    const path = window.location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/templates')) return 'Templates';
    if (path.includes('/whatsapp-bulk')) return 'WhatsApp Bulk Messaging';
    if (path.includes('/users')) return 'User Management';
    return 'Dashboard';
  };

  // Get page subtitle
  const getPageSubtitle = () => {
    if (subtitle) return subtitle;
    
    const path = window.location.pathname;
    if (path.includes('/dashboard')) return 'Here\'s what\'s happening with your WhatsApp campaigns today.';
    if (path.includes('/templates')) return 'Create, edit, and manage your message templates.';
    if (path.includes('/whatsapp-bulk')) return 'Send bulk messages to multiple recipients.';
    if (path.includes('/users')) return 'Manage user accounts and permissions.';
    return isAdmin ? 'Admin Panel' : 'WhatsApp Business Platform';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="px-8 py-6">
        <div className="flex justify-between items-start">
          {/* Left side - Page Title and Subtitle */}
          <FadeIn className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight leading-tight">
              {getPageTitle()}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
              {getPageSubtitle()}
            </p>
          </FadeIn>

          {/* Right side - User Actions */}
          <FadeIn delay={0.1} className="flex items-center space-x-4 ml-8">
            {/* User Credits Pill (for users only) */}
            {!isAdmin && (
              <HoverScale scale={1.02}>
                <GlassCard variant="subtle" className="flex items-center space-x-3 px-4 py-3 border border-emerald-200/50">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Credits</p>
                    <p className="text-sm font-bold text-gray-900 -mt-0.5">
                      {user?.creditBalance?.toLocaleString() || '0'}
                    </p>
                  </div>
                </GlassCard>
              </HoverScale>
            )}

            {/* User Profile Chip */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HoverScale scale={1.02}>
                  <Button variant="ghost" className="flex items-center space-x-3 hover:bg-white/60 p-3 rounded-2xl transition-all duration-300 ring-1 ring-gray-200/50 hover:ring-gray-300/50 hover:shadow-md">
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center ring-2 ring-white/50 shadow-lg">
                      <span className="text-white text-sm font-bold tracking-tight">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-semibold text-gray-900 tracking-tight">{user?.name}</p>
                      <p className="text-xs text-emerald-600 capitalize font-medium">{user?.role}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </HoverScale>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 bg-white/90 backdrop-blur-xl border border-gray-200/50 shadow-xl rounded-2xl">
                <div className="px-4 py-3 border-b border-gray-100 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50">
                  <p className="text-sm font-semibold text-gray-900 tracking-tight">{user?.name}</p>
                  <p className="text-xs text-gray-600">{user?.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg capitalize">
                      {user?.role}
                    </div>
                  </div>
                </div>
                <div className="py-2 space-y-1">
                  <DropdownMenuItem onClick={() => navigate('/user/profile')} className="rounded-lg p-3 transition-all duration-200 hover:bg-gray-100/60">
                    <User className="h-4 w-4 mr-3 text-gray-500" />
                    <span className="font-medium">Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/user/billing')} className="rounded-lg p-3 transition-all duration-200 hover:bg-gray-100/60">
                    <CreditCard className="h-4 w-4 mr-3 text-gray-500" />
                    <span className="font-medium">Billing & Credits</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="my-2 bg-gray-200/50" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-3 transition-all duration-200 font-medium">
                  <LogOut className="h-4 w-4 mr-3" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </FadeIn>
        </div>
      </div>
    </header>
  );
}