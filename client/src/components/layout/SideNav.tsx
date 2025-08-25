import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Send, 
  MessageSquare,
  Settings,
  BarChart3,
  Code,
  User,
  Trash2,
  IndianRupee
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { GlassCard } from '../ui/glass-card';
import { FadeIn, HoverScale } from '../ui/motion-components';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

export default function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';
  
  const userNavItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/user/dashboard',
      icon: LayoutDashboard
    },
    {
      name: 'WhatsApp Quick Send',
      path: '/user/whatsapp-bulk',
      icon: Send
    },
    {
      name: 'API Management',
      path: '/user/api-management',
      icon: Code
    },
    {
      name: 'Customize Message',
      path: '/user/customize-message',
      icon: Settings
    },
    {
      name: 'Templates',
      path: '/user/templates',
      icon: FileText
    },
    {
      name: 'Manage Reports',
      path: '/user/manage-reports',
      icon: BarChart3
    },
    {
      name: 'Profile',
      path: '/user/profile',
      icon: User
    }
  ];

  const adminNavItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: LayoutDashboard
    },
    {
      name: 'User Management',
      path: '/admin/users',
      icon: FileText
    },
    {
      name: 'Log Management',
      path: '/admin/logs',
      icon: Trash2
    },
    {
      name: 'Pricing Management',
      path: '/admin/pricing',
      icon: IndianRupee
    },
    {
      name: 'Profile',
      path: '/admin/profile',
      icon: User
    }
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <div className="hidden md:flex md:w-72 min-h-screen flex-col fixed left-0 top-0 z-40 p-4">
      <GlassCard variant="glass" className="flex-1 flex flex-col overflow-hidden">
        {/* Logo Section */}
        <FadeIn className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Prime SMS</h1>
              <p className="text-xs text-gray-500 font-medium">WhatsApp Business</p>
            </div>
          </div>
        </FadeIn>

        {/* Navigation Items */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <FadeIn key={item.path} delay={index * 0.05}>
                  <HoverScale scale={1.01}>
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group relative overflow-hidden",
                        active
                          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-700 shadow-lg ring-1 ring-emerald-500/20"
                          : "text-gray-600 hover:text-gray-900 hover:bg-white/60 hover:shadow-md hover:ring-1 hover:ring-white/30"
                      )}
                    >
                      {/* Active indicator pill */}
                      {active && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full shadow-md" />
                      )}
                      
                      <Icon className={cn(
                        "h-5 w-5 transition-all duration-300 flex-shrink-0",
                        active ? "text-emerald-600 scale-110" : "text-gray-400 group-hover:text-gray-600 group-hover:scale-105"
                      )} />
                      <span className={cn(
                        "text-sm font-medium tracking-tight transition-all duration-300",
                        active ? "text-emerald-700 font-semibold" : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {item.name}
                      </span>
                      
                      {/* Active glow effect */}
                      {active && (
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-xl" />
                      )}
                    </button>
                  </HoverScale>
                </FadeIn>
              );
            })}
          </div>
        </nav>

        {/* User Info Footer */}
        <FadeIn delay={0.3} className="p-4 border-t border-white/10">
          <GlassCard variant="subtle" className="p-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center ring-2 ring-white/20 shadow-lg">
                <span className="text-white text-sm font-bold tracking-tight">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate tracking-tight">
                  {user?.name}
                </p>
                <p className="text-xs text-emerald-600 capitalize truncate font-medium">
                  {user?.role}
                </p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </GlassCard>
    </div>
  );
}