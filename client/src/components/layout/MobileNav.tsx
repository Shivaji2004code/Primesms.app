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
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
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

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Mobile Menu */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 md:hidden transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Prime SMS</h1>
              <p className="text-xs text-gray-500 -mt-1">WhatsApp Business</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                    active
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-blue-600" : "text-gray-400"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    active ? "text-blue-700" : "text-gray-900"
                  )}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Signed in as {user?.name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}