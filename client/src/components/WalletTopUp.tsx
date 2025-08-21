import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Sparkles, 
  Check, 
  Info, 
  CreditCard,
  Zap,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { FadeIn, SoftHoverCard, motionTimings } from './ui/motion-components';

export type WalletTopUpProps = {
  initialAmount?: number;
  onCheckout?: (amount: number) => void | Promise<void>;
  min?: number;
  max?: number;
  className?: string;
};

type TopUpState = {
  selectedType: 'preset' | 'custom';
  amount: number | null;
  error?: string;
  isLoading?: boolean;
};

const PRESET_AMOUNTS = [10000, 20000, 50000, 100000] as const;

const useTopUp = (initialAmount?: number, min = 10000, max = 100000) => {
  const [state, setState] = useState<TopUpState>(() => {
    if (initialAmount && initialAmount >= min && initialAmount <= max) {
      const isPreset = PRESET_AMOUNTS.includes(initialAmount as any);
      return {
        selectedType: isPreset ? 'preset' : 'custom',
        amount: initialAmount,
        error: undefined
      };
    }
    return {
      selectedType: 'preset',
      amount: null,
      error: undefined
    };
  });

  const formatIndianNumber = useCallback((num: number): string => {
    return num.toLocaleString('en-IN');
  }, []);

  const parseIndianNumber = useCallback((str: string): number | null => {
    const cleanStr = str.replace(/[,\s]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) ? null : num;
  }, []);

  const validateAmount = useCallback((amount: number | null): string | undefined => {
    if (amount === null || amount === 0) return undefined;
    if (amount < min) return `Amount must be at least ₹${formatIndianNumber(min)}`;
    if (amount > max) return `Amount cannot exceed ₹${formatIndianNumber(max)}`;
    return undefined;
  }, [min, max, formatIndianNumber]);

  const selectPreset = useCallback((amount: number) => {
    setState({
      selectedType: 'preset',
      amount,
      error: validateAmount(amount)
    });
  }, [validateAmount]);

  const setCustomAmount = useCallback((amount: number | null) => {
    setState({
      selectedType: 'custom',
      amount,
      error: validateAmount(amount)
    });
  }, [validateAmount]);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const isValid = useMemo(() => {
    return state.amount !== null && 
           state.amount >= min && 
           state.amount <= max && 
           !state.error;
  }, [state.amount, state.error, min, max]);

  return {
    ...state,
    isValid,
    formatIndianNumber,
    parseIndianNumber,
    selectPreset,
    setCustomAmount,
    setLoading,
    min,
    max
  };
};

export const WalletTopUp: React.FC<WalletTopUpProps> = ({
  initialAmount,
  onCheckout,
  min = 10000,
  max = 100000,
  className
}) => {
  const {
    selectedType,
    amount,
    error,
    isLoading,
    isValid,
    formatIndianNumber,
    parseIndianNumber,
    selectPreset,
    setCustomAmount,
    setLoading
  } = useTopUp(initialAmount, min, max);

  const [customInput, setCustomInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const handlePresetClick = useCallback((presetAmount: number) => {
    selectPreset(presetAmount);
    setCustomInput('');
  }, [selectPreset]);

  const handleCustomInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomInput(value);
    
    if (value.trim() === '') {
      setCustomAmount(null);
      return;
    }

    const parsed = parseIndianNumber(value);
    setCustomAmount(parsed);
  }, [parseIndianNumber, setCustomAmount]);

  const handleCustomInputBlur = useCallback(() => {
    if (amount !== null) {
      setCustomInput(formatIndianNumber(amount));
    }
  }, [amount, formatIndianNumber]);

  const handleCustomInputFocus = useCallback(() => {
    if (amount !== null) {
      setCustomInput(amount.toString());
    }
  }, [amount]);

  const handleCheckout = useCallback(async () => {
    if (!isValid || !amount || isLoading) return;

    setLoading(true);
    try {
      // Create Razorpay order
      const orderResponse = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ amountCredits: amount }),
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Load Razorpay checkout script
      await loadRazorpayScript();

      // Open Razorpay checkout
      const razorpay = new (window as any).Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Prime SMS',
        description: `${formatIndianNumber(amount)} credits top-up`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment on server
            const verifyResponse = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                amountCredits: amount,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setShowSuccess(true);
              setTimeout(() => {
                setShowSuccess(false);
                window.location.href = '/user/dashboard';
              }, 1500);
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification failed:', error);
            alert(`Payment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Payment cancelled by user');
          }
        },
        theme: {
          color: '#3b82f6'
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        notes: {
          purpose: 'wallet_topup',
          credits: amount.toString()
        }
      });

      razorpay.open();
      
      // Call the original onCheckout if provided
      await onCheckout?.(amount);
      
    } catch (err) {
      console.error('Checkout failed:', err);
      alert(`Payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [isValid, amount, isLoading, onCheckout, setLoading, formatIndianNumber]);

  const presetVariants = {
    rest: { scale: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    hover: { scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    tap: { scale: 0.98 }
  };

  const checkmarkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeInOut' }
    }
  };

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <FadeIn>
        <Card className="bg-background border shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl font-semibold">Add Credits</CardTitle>
            <CardDescription>
              Top up your account with credits to send WhatsApp messages
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Quick Pick Presets */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-foreground">Choose Amount</Label>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_AMOUNTS.map((presetAmount) => {
                  const isSelected = selectedType === 'preset' && amount === presetAmount;
                  return (
                    <motion.div
                      key={presetAmount}
                      layoutId={isSelected ? 'selected-preset' : undefined}
                      variants={presetVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="lg"
                        onClick={() => handlePresetClick(presetAmount)}
                        className={cn(
                          "w-full h-14 text-base font-medium transition-all duration-200",
                          isSelected && "ring-2 ring-primary/20 shadow-md"
                        )}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>₹{formatIndianNumber(presetAmount)}</span>
                          <span className="text-xs opacity-80">credits</span>
                        </div>
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium">OR</span>
              <Separator className="flex-1" />
            </div>

            {/* Custom Amount */}
            <div className="space-y-3">
              <Label htmlFor="custom-amount" className="text-sm font-medium text-foreground">
                Custom Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  ₹
                </span>
                <Input
                  ref={customInputRef}
                  id="custom-amount"
                  value={customInput}
                  onChange={handleCustomInputChange}
                  onBlur={handleCustomInputBlur}
                  onFocus={handleCustomInputFocus}
                  placeholder="Enter amount"
                  className={cn(
                    "pl-8 h-12 text-base font-medium transition-all duration-200",
                    selectedType === 'custom' && "ring-2 ring-primary/20"
                  )}
                  aria-describedby="amount-helper amount-error"
                />
              </div>
              
              {selectedType === 'custom' && !amount && (
                <p id="amount-helper" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Enter amount between ₹{formatIndianNumber(min)} and ₹{formatIndianNumber(max)}
                </p>
              )}

              {error && (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription id="amount-error" className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Summary Card */}
            <AnimatePresence>
              {isValid && amount && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: motionTimings.durationBase, ease: motionTimings.easeStandard }}
                >
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <motion.svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <motion.path
                                d="M20 6L9 17L4 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-primary"
                                variants={checkmarkVariants}
                                initial="hidden"
                                animate="visible"
                              />
                            </motion.svg>
                          </div>
                          <div>
                            <p className="font-medium text-sm">You're adding</p>
                            <p className="text-xl font-bold text-primary">₹{formatIndianNumber(amount)}</p>
                          </div>
                        </div>
                        <Sparkles className="h-5 w-5 text-primary/60" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA Button */}
            <motion.div
              whileHover={isValid ? { scale: 1.02 } : undefined}
              whileTap={isValid ? { scale: 0.98 } : undefined}
            >
              <Button
                onClick={handleCheckout}
                disabled={!isValid || isLoading}
                size="lg"
                className={cn(
                  "w-full h-12 text-base font-medium transition-all duration-200",
                  isValid && "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl"
                )}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Add Credits
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                )}
              </Button>
            </motion.div>

            {/* Success State */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center p-4 bg-green-50 rounded-lg border border-green-200"
                >
                  <div className="flex items-center justify-center gap-2 text-green-700 font-medium">
                    <Check className="h-4 w-4" />
                    Credits added successfully!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
};

/**
 * Utility function to load Razorpay checkout script
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
}

export default WalletTopUp;