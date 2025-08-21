import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WalletTopUp from '@/components/WalletTopUp';
import { 
  Wallet, 
  CreditCard, 
  RefreshCw, 
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles
} from 'lucide-react';
import { FadeIn, StaggerContainer, SoftHoverCard } from '@/components/ui/motion-components';

export default function WalletTopUpDemo() {
  const [currentBalance, setCurrentBalance] = useState(25000);
  const [lastTopUp, setLastTopUp] = useState<{ amount: number; timestamp: Date } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTopUp = async (amount: number): Promise<void> => {
    setIsProcessing(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Simulate successful top-up
      setCurrentBalance(prev => prev + amount);
      setLastTopUp({ amount, timestamp: new Date() });
      
      toast.success(`Successfully added ₹${amount.toLocaleString('en-IN')} credits!`, {
        description: `Your new balance is ₹${(currentBalance + amount).toLocaleString('en-IN')}`
      });
    } catch (error) {
      toast.error('Top-up failed', {
        description: 'Please try again or contact support if the issue persists.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDemo = () => {
    setCurrentBalance(25000);
    setLastTopUp(null);
    toast.info('Demo reset', {
      description: 'Balance and history have been reset for testing.'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <DashboardLayout 
      title="Wallet Top-Up Demo"
      subtitle="Test the world-class wallet top-up UI experience"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Demo Controls */}
        <FadeIn>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Demo Environment</CardTitle>
                </div>
                <Button 
                  onClick={resetDemo}
                  variant="outline" 
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Demo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-blue-800 text-sm">
                This is a demonstration of the wallet top-up component. All transactions are simulated 
                and no real payments are processed. Use this to test the UI/UX before integration.
              </p>
            </CardContent>
          </Card>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Status */}
          <div className="lg:col-span-1 space-y-6">
            <FadeIn delay={0.1}>
              <Card>
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Wallet className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle className="text-lg">Current Balance</CardTitle>
                  <CardDescription>Available credits in your account</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    ₹{currentBalance.toLocaleString('en-IN')}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Ready to use
                  </Badge>
                </CardContent>
              </Card>
            </FadeIn>

            {/* Recent Activity */}
            <FadeIn delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lastTopUp ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-green-900 text-sm">
                              Credits Added
                            </p>
                            <p className="text-green-700 text-xs">
                              {formatTime(lastTopUp.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            +₹{lastTopUp.amount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recent activity</p>
                      <p className="text-xs">Top up credits to see transaction history</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Wallet Top-Up Component */}
          <div className="lg:col-span-2">
            <FadeIn delay={0.3}>
              <WalletTopUp
                onCheckout={handleTopUp}
                className="w-full"
              />
            </FadeIn>

            {/* Feature Highlights */}
            <FadeIn delay={0.4}>
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Component Features
                  </CardTitle>
                  <CardDescription>
                    Key features demonstrated in this wallet top-up UI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        title: 'Quick-Pick Presets',
                        description: 'Pre-defined amounts with single-click selection',
                        status: 'implemented'
                      },
                      {
                        title: 'Custom Amount Input',
                        description: 'Manual entry with Indian number formatting',
                        status: 'implemented'
                      },
                      {
                        title: 'Real-time Validation',
                        description: 'Live feedback for amount range (₹10k-₹1L)',
                        status: 'implemented'
                      },
                      {
                        title: 'Micro-interactions',
                        description: 'Smooth animations and hover effects',
                        status: 'implemented'
                      },
                      {
                        title: 'Accessibility Ready',
                        description: 'ARIA labels, keyboard navigation, screen reader support',
                        status: 'implemented'
                      },
                      {
                        title: 'Responsive Design',
                        description: 'Mobile-first approach with perfect scaling',
                        status: 'implemented'
                      },
                      {
                        title: 'Dark Mode Support',
                        description: 'Seamless theme switching with shadcn tokens',
                        status: 'implemented'
                      },
                      {
                        title: 'Payment Integration',
                        description: 'Ready for Razorpay/Stripe integration',
                        status: 'pending'
                      }
                    ].map((feature, index) => (
                      <SoftHoverCard
                        key={feature.title}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            feature.status === 'implemented' 
                              ? 'bg-green-500' 
                              : 'bg-yellow-500'
                          }`} />
                          <div className="min-w-0">
                            <h4 className="font-medium text-sm mb-1">{feature.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </SoftHoverCard>
                    ))}
                  </StaggerContainer>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </div>

        {/* Integration Notes */}
        <FadeIn delay={0.5}>
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-900">Integration Notes</CardTitle>
              <CardDescription className="text-purple-700">
                How to integrate this component into your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">Component Usage</h4>
                  <div className="bg-purple-100 rounded-lg p-3 font-mono text-xs">
                    {`<WalletTopUp
  onCheckout={handlePayment}
  min={10000}
  max={100000}
  initialAmount={50000}
/>`}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">Next Steps</h4>
                  <ul className="space-y-1 text-purple-700 text-xs">
                    <li>• Connect to payment gateway (Razorpay/Stripe)</li>
                    <li>• Add transaction logging</li>
                    <li>• Implement success/failure handling</li>
                    <li>• Add loading states for real API calls</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </DashboardLayout>
  );
}