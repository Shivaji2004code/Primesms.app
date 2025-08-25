import { useState, useEffect } from 'react';
import { IndianRupee, Users, Settings, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '../components/layout/DashboardLayout';
import AdminGlobalPricing from '../components/AdminGlobalPricing';

interface PricingStats {
  totalUsers: number;
  usersWithCustomPricing: number;
  usersWithDefaultPricing: number;
  averageMarketingPrice: string;
  averageUtilityPrice: string;
  averageAuthenticationPrice: string;
}

export default function AdminPricing() {
  const [stats, setStats] = useState<PricingStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    // For now, we'll show placeholder stats
    // In a real implementation, you'd fetch actual stats from the API
    setTimeout(() => {
      setStats({
        totalUsers: 0,
        usersWithCustomPricing: 0,
        usersWithDefaultPricing: 0,
        averageMarketingPrice: "0.80",
        averageUtilityPrice: "0.15",
        averageAuthenticationPrice: "0.15"
      });
      setIsLoadingStats(false);
    }, 1000);
  }, []);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
            <p className="text-gray-600 mt-2">
              Configure global default pricing and manage per-user custom pricing
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            <IndianRupee className="h-4 w-4 mr-1" />
            INR Currency
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? '...' : stats?.totalUsers || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Active users in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custom Pricing</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? '...' : stats?.usersWithCustomPricing || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Users with custom rates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Default Pricing</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? '...' : stats?.usersWithDefaultPricing || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Users using defaults
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Marketing</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{isLoadingStats ? '...' : stats?.averageMarketingPrice || '0.80'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per message rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">How Pricing Works</h3>
                <div className="text-sm text-blue-800 mt-2 space-y-1">
                  <p>• <strong>Global Defaults:</strong> Set default per-message prices that apply to all users</p>
                  <p>• <strong>Custom User Pricing:</strong> Override defaults for specific users in User Settings → Pricing tab</p>
                  <p>• <strong>Effective Pricing:</strong> Users inherit global defaults unless they have custom pricing configured</p>
                  <p>• <strong>Message Categories:</strong> Marketing (promotional), Utility (transactional), Authentication (OTP/verification)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Pricing Configuration */}
        <AdminGlobalPricing />

        {/* Future Enhancement Placeholder */}
        <Card className="border-dashed border-2 border-gray-300">
          <CardHeader>
            <CardTitle className="text-gray-500">Coming Soon</CardTitle>
            <CardDescription>
              Additional features like bulk pricing updates, pricing analytics, and usage reports will be available in future updates.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  );
}