import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  FileText, 
  MessageSquare,
  LifeBuoy,
  CreditCard,
  TrendingUp,
  Settings,
  BarChart3,
  Users,
  Activity,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import DashboardLayout from '../components/layout/DashboardLayout';
import { FadeIn, SlideUp, StaggerContainer, SoftHoverCard } from '../components/ui/motion-components';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Mock data - in real app this would come from API
  const stats = {
    totalMessages: 0, // Will show 0 initially, should be fetched from API
    activeTemplates: 0, // Will show 0 initially, should be fetched from API
    credits: user?.creditBalance || 0
  };

  const quickActions = [
    {
      id: 'send-bulk',
      title: 'Send Bulk Messages',
      description: 'Broadcast messages to multiple contacts',
      icon: Send,
      path: '/user/whatsapp-bulk',
      color: 'bg-blue-600 hover:bg-blue-700',
      iconBg: 'bg-blue-500'
    },
    {
      id: 'create-template',
      title: 'Create Template',
      description: 'Design reusable message templates',
      icon: FileText,
      path: '/user/templates',
      color: 'bg-emerald-600 hover:bg-emerald-700',
      iconBg: 'bg-emerald-500'
    },
    {
      id: 'view-reports',
      title: 'View Reports',
      description: 'Analyze your campaign performance',
      icon: BarChart3,
      path: '/user/manage-reports',
      color: 'bg-purple-600 hover:bg-purple-700',
      iconBg: 'bg-purple-500'
    },
    {
      id: 'customize',
      title: 'Customize Messages',
      description: 'Personalize your messaging campaigns',
      icon: Settings,
      path: '/user/customize-message',
      color: 'bg-orange-600 hover:bg-orange-700',
      iconBg: 'bg-orange-500'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      action: 'Dashboard accessed',
      time: 'Just now',
      status: 'success'
    },
    {
      id: 2,
      action: 'Account created',
      time: 'Recently',
      status: 'success'
    }
  ];

  return (
    <DashboardLayout 
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name}! Here's your WhatsApp Business overview.`}
    >
      {/* Header Stats Section */}
      <FadeIn>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
          {/* Left side - Welcome */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name}!
                </h1>
                <p className="text-gray-600">{formatDate(currentTime)} • {formatTime(currentTime)}</p>
              </div>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed">
              Ready to connect with your customers through WhatsApp Business messaging.
            </p>
          </div>

          {/* Right side - Key metric (Credits only) */}
          <div className="flex gap-6">
            <div className="text-center px-6 py-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-900 mb-1">{stats.credits.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Available Credits</div>
              <Button
                size="sm"
                onClick={() => navigate('/user/wallet')}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Top Up
              </Button>
            </div>
          </div>
        </div>
      </div>
      </FadeIn>

      <div className="space-y-8">
        {/* Main Content - Quick Actions */}
        <div>
          <FadeIn delay={0.05}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            {/* Header */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Quick Actions</h2>
                  <p className="text-gray-600 mt-1">Get started with common tasks</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/user/whatsapp-bulk')}
                  className="hidden sm:flex"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="p-4 sm:p-6 lg:p-8">
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <SoftHoverCard
                      key={action.id}
                      onClick={() => navigate(action.path)}
                      className="group p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 text-left bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 ${action.iconBg} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-gray-800 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {action.description}
                      </p>
                    </SoftHoverCard>
                  );
                })}
              </StaggerContainer>
            </div>
          </div>
          </FadeIn>

          {/* Performance Overview (Credits only) */}
          <FadeIn delay={0.1}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-8">
            <div className="px-8 py-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Account Overview</h2>
                  <p className="text-gray-600 mt-1">Your account status and key metrics</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/user/manage-reports')}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  View Details
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <SoftHoverCard className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mb-2">{stats.credits.toLocaleString()}</div>
                  <div className="text-blue-700 font-medium mb-1">Available Credits</div>
                  <div className="text-blue-600 text-xs mb-3">Ready to use</div>
                  <Button
                    size="sm"
                    onClick={() => navigate('/user/wallet')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Top Up Wallet
                  </Button>
                </SoftHoverCard>
              </div>
            </div>
          </div>
          </FadeIn>
        </div>
      </div>
    </DashboardLayout>
  );
}