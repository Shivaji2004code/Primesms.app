import { useState, useEffect } from 'react';
import { IndianRupee, Save, RotateCcw, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PricingDefaults {
  marketing: string;
  utility: string;
  authentication: string;
  currency: string;
}

interface UserPricingCustom {
  marketing?: string;
  utility?: string;
  authentication?: string;
}

interface UserPricingData {
  userId: number;
  mode: 'custom' | 'default';
  custom: UserPricingCustom;
  effective: PricingDefaults;
  defaults: Omit<PricingDefaults, 'currency'>;
}

interface AdminUserPricingProps {
  userId: number;
}

export default function AdminUserPricing({ userId }: AdminUserPricingProps) {
  const [pricingData, setPricingData] = useState<UserPricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form state
  const [useCustomPricing, setUseCustomPricing] = useState(false);
  const [customPricing, setCustomPricing] = useState<UserPricingCustom>({});
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchUserPricing();
  }, [userId]);

  const fetchUserPricing = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`/api/admin/pricing/users/${userId}/pricing`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPricingData(data);
        setUseCustomPricing(data.mode === 'custom');
        setCustomPricing(data.custom || {});
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch user pricing data');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Fetch pricing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePrice = (price: string): string | null => {
    if (!price.trim()) return null; // Empty is valid (will use default)
    
    const regex = /^\d+(\.\d{1,4})?$/;
    if (!regex.test(price)) {
      return 'Price must be a valid decimal with up to 4 decimal places';
    }
    
    const num = parseFloat(price);
    if (num < 0) {
      return 'Price cannot be negative';
    }
    
    return null;
  };

  const handleCustomPricingChange = (field: keyof UserPricingCustom, value: string) => {
    setCustomPricing(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');
      setFormErrors({});

      // Validate custom pricing if enabled
      if (useCustomPricing) {
        const newErrors: { [key: string]: string } = {};
        
        Object.entries(customPricing).forEach(([field, value]) => {
          if (value && value.trim()) {
            const error = validatePrice(value.trim());
            if (error) {
              newErrors[field] = error;
            }
          }
        });

        if (Object.keys(newErrors).length > 0) {
          setFormErrors(newErrors);
          setIsSaving(false);
          return;
        }

        // Check that at least one custom price is provided
        const hasCustomPricing = Object.values(customPricing).some(price => price && price.trim());
        if (!hasCustomPricing) {
          setError('At least one custom price must be provided when using custom pricing');
          setIsSaving(false);
          return;
        }
      }

      const requestBody = {
        mode: useCustomPricing ? 'custom' as const : 'default' as const,
        ...(useCustomPricing && { pricing: customPricing })
      };

      const response = await fetch(`/api/admin/pricing/users/${userId}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        setPricingData(data);
        setUseCustomPricing(data.mode === 'custom');
        setCustomPricing(data.custom || {});
        setSuccessMessage(data.message || 'Pricing updated successfully');
      } else {
        const errorData = await response.json();
        if (errorData.details && Array.isArray(errorData.details)) {
          const fieldErrors: { [key: string]: string } = {};
          errorData.details.forEach((detail: any) => {
            fieldErrors[detail.field] = detail.message;
          });
          setFormErrors(fieldErrors);
        } else {
          setError(errorData.error || 'Failed to update pricing');
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Save pricing error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToDefaults = async () => {
    if (!confirm('Are you sure you want to revert to default pricing? This will remove all custom pricing for this user.')) {
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await fetch(`/api/admin/pricing/users/${userId}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ mode: 'default' })
      });

      if (response.ok) {
        const data = await response.json();
        setPricingData(data);
        setUseCustomPricing(false);
        setCustomPricing({});
        setSuccessMessage('Pricing reverted to defaults successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to revert to defaults');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Revert pricing error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <IndianRupee className="h-5 w-5" />
            <span>Pricing Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading pricing data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pricingData) {
    return (
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load pricing data. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IndianRupee className="h-5 w-5 text-green-600" />
            <span>Pricing Settings</span>
          </div>
          <Badge variant={pricingData.mode === 'custom' ? 'default' : 'secondary'}>
            {pricingData.mode === 'custom' ? 'Custom Pricing' : 'Default Pricing'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Configure per-message pricing for Marketing, Utility, and Authentication messages (in INR)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Current Effective Pricing Display */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Current Effective Pricing</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                ₹{pricingData.effective.marketing}
              </div>
              <div className="text-sm text-gray-600">Marketing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                ₹{pricingData.effective.utility}
              </div>
              <div className="text-sm text-gray-600">Utility</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                ₹{pricingData.effective.authentication}
              </div>
              <div className="text-sm text-gray-600">Authentication</div>
            </div>
          </div>
        </div>

        {/* Global Defaults Display */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
            <Info className="h-4 w-4" />
            <span>Global Default Prices</span>
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>Marketing: ₹{pricingData.defaults.marketing}</div>
            <div>Utility: ₹{pricingData.defaults.utility}</div>
            <div>Authentication: ₹{pricingData.defaults.authentication}</div>
          </div>
        </div>

        {/* Custom Pricing Toggle */}
        <div className="flex items-center justify-between py-4 border-t border-b">
          <div className="space-y-1">
            <Label htmlFor="use-custom-pricing" className="text-base font-medium">
              Use Custom Pricing
            </Label>
            <p className="text-sm text-gray-600">
              Override global defaults with user-specific pricing
            </p>
          </div>
          <Switch
            id="use-custom-pricing"
            checked={useCustomPricing}
            onCheckedChange={setUseCustomPricing}
            disabled={isSaving}
          />
        </div>

        {/* Custom Pricing Form */}
        {useCustomPricing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Marketing Price */}
              <div className="space-y-2">
                <Label htmlFor="marketing-price">
                  Marketing Price (₹)
                  <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
                </Label>
                <Input
                  id="marketing-price"
                  type="text"
                  placeholder={pricingData.defaults.marketing}
                  value={customPricing.marketing || ''}
                  onChange={(e) => handleCustomPricingChange('marketing', e.target.value)}
                  className={formErrors.marketing ? 'border-red-500' : ''}
                  disabled={isSaving}
                />
                {formErrors.marketing && (
                  <p className="text-xs text-red-600">{formErrors.marketing}</p>
                )}
              </div>

              {/* Utility Price */}
              <div className="space-y-2">
                <Label htmlFor="utility-price">
                  Utility Price (₹)
                  <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
                </Label>
                <Input
                  id="utility-price"
                  type="text"
                  placeholder={pricingData.defaults.utility}
                  value={customPricing.utility || ''}
                  onChange={(e) => handleCustomPricingChange('utility', e.target.value)}
                  className={formErrors.utility ? 'border-red-500' : ''}
                  disabled={isSaving}
                />
                {formErrors.utility && (
                  <p className="text-xs text-red-600">{formErrors.utility}</p>
                )}
              </div>

              {/* Authentication Price */}
              <div className="space-y-2">
                <Label htmlFor="authentication-price">
                  Authentication Price (₹)
                  <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
                </Label>
                <Input
                  id="authentication-price"
                  type="text"
                  placeholder={pricingData.defaults.authentication}
                  value={customPricing.authentication || ''}
                  onChange={(e) => handleCustomPricingChange('authentication', e.target.value)}
                  className={formErrors.authentication ? 'border-red-500' : ''}
                  disabled={isSaving}
                />
                {formErrors.authentication && (
                  <p className="text-xs text-red-600">{formErrors.authentication}</p>
                )}
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Leave fields empty to use global defaults. At least one custom price must be provided.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <div>
            {pricingData.mode === 'custom' && (
              <Button
                variant="outline"
                onClick={handleRevertToDefaults}
                disabled={isSaving}
                className="text-orange-700 hover:text-orange-800"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert to Defaults
              </Button>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}