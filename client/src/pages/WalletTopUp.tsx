import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WalletTopUp from '@/components/WalletTopUp';
import { useAuth } from '@/hooks/useAuth';
import { 
  Wallet, 
  CreditCard, 
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { FadeIn } from '@/components/ui/motion-components';
import { useNavigate } from 'react-router-dom';

export default function WalletTopUpPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // Fetch current credit balance from server
  useEffect(() => {
    fetchCreditBalance();
  }, []);

  const fetchCreditBalance = async () => {
    try {
      console.log('💰 🔄 WALLET PAGE: Starting balance fetch...');
      setIsLoadingBalance(true);
      const timestamp = Date.now();
      const url = `/api/auth/me?t=${timestamp}`;
      
      console.log('💰 🔍 WALLET PAGE: Fetching from:', url);
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-cache'
      });
      
      console.log('💰 📊 WALLET PAGE: Fetch response status:', response.status, response.statusText);
      
      if (response.ok) {
        const userData = await response.json();
        const newBalance = userData.user?.creditBalance || 0;
        console.log('💰 ✅ WALLET PAGE: Balance fetched successfully:', {
          oldBalance: currentBalance,
          newBalance: newBalance,
          userData: userData.user
        });
        setCurrentBalance(newBalance);
      } else {
        console.error('💰 ❌ WALLET PAGE: Failed to fetch user data, using fallback');
        setCurrentBalance(user?.creditBalance || 0);
      }
    } catch (error) {
      console.error('💰 ❌ WALLET PAGE: Error fetching credit balance:', error);
      setCurrentBalance(user?.creditBalance || 0);
    } finally {
      setIsLoadingBalance(false);
      console.log('💰 🏁 WALLET PAGE: Balance fetch completed');
    }
  };

  const handleTopUp = async (amount: number): Promise<void> => {
    // This will be handled by the WalletTopUp component's Razorpay integration
    // Just show initial feedback
    toast.info('Processing payment...', {
      description: 'Please complete the payment in the Razorpay window'
    });
  };

  const handlePaymentSuccess = () => {
    console.log('💰 🎉 WALLET PAGE: Payment success callback triggered!');
    // Refresh balance after successful payment
    setTimeout(() => {
      console.log('💰 🔄 WALLET PAGE: Refreshing balance after payment success...');
      fetchCreditBalance();
    }, 1000);
  };

  const refreshBalance = () => {
    fetchCreditBalance();
  };

  return (
    <DashboardLayout 
      title="Wallet Top-Up"
      subtitle="Add credits to your Prime SMS account"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button */}
        <FadeIn>
          <Button
            variant="outline"
            onClick={() => navigate('/user/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Balance */}
          <div className="lg:col-span-1">
            <FadeIn delay={0.1}>
              <Card>
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Current Balance</CardTitle>
                  <CardDescription>Available credits in your account</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  {isLoadingBalance ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        ₹{currentBalance?.toLocaleString('en-IN') || '0'}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">Credits available</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshBalance}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        Refresh Balance
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Wallet Top-Up Component */}
          <div className="lg:col-span-2">
            <FadeIn delay={0.2}>
              <WalletTopUp
                onCheckout={handleTopUp}
                onPaymentSuccess={handlePaymentSuccess}
                className="w-full"
              />
            </FadeIn>
          </div>
        </div>

        {/* Instructions */}
        <FadeIn delay={0.3}>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Secure Payment</h3>
                  <p className="text-blue-800 text-sm leading-relaxed">
                    Your payment is processed securely through Razorpay. Credits will be added to your account 
                    immediately after successful payment confirmation. You can use cards, UPI, net banking, 
                    and wallets for payment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </DashboardLayout>
  );
}