import { useState, useEffect } from 'react';
import { IndianRupee, Save, Settings, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PricingDefaults {
  marketing: string;
  utility: string;
  authentication: string;
  currency: string;
}

export default function AdminGlobalPricing() {
  const [defaults, setDefaults] = useState<PricingDefaults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    marketing: '',
    utility: '',
    authentication: ''
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchDefaults();
  }, []);

  const fetchDefaults = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch('/api/admin/pricing/defaults', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setDefaults(data.defaults);
        setFormData({
          marketing: data.defaults.marketing,
          utility: data.defaults.utility,
          authentication: data.defaults.authentication
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch pricing defaults');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Fetch defaults error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePrice = (price: string): string | null => {
    if (!price.trim()) {
      return 'Price is required';
    }
    
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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
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

      // Validate all fields
      const newErrors: { [key: string]: string } = {};
      
      Object.entries(formData).forEach(([field, value]) => {
        const error = validatePrice(value);
        if (error) {
          newErrors[field] = error;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        setIsSaving(false);
        return;
      }

      const response = await fetch('/api/admin/pricing/defaults', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setDefaults(data.defaults);
        setFormData({
          marketing: data.defaults.marketing,
          utility: data.defaults.utility,
          authentication: data.defaults.authentication
        });
        setSuccessMessage(data.message || 'Global pricing defaults updated successfully');
      } else {
        const errorData = await response.json();
        if (errorData.details && Array.isArray(errorData.details)) {
          const fieldErrors: { [key: string]: string } = {};
          errorData.details.forEach((detail: any) => {
            fieldErrors[detail.field] = detail.message;
          });
          setFormErrors(fieldErrors);
        } else {
          setError(errorData.error || 'Failed to update pricing defaults');
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Save defaults error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = defaults && (
    formData.marketing !== defaults.marketing ||
    formData.utility !== defaults.utility ||
    formData.authentication !== defaults.authentication
  );

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Global Pricing Defaults</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading pricing defaults...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5 text-blue-600" />
          <span>Global Pricing Defaults</span>
        </CardTitle>
        <CardDescription>
          Set default per-message pricing for all users (in INR). Individual users can override these with custom pricing.
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

        {/* Current Defaults Display */}
        {defaults && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Current Global Defaults</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  ₹{defaults.marketing}
                </div>
                <div className="text-sm text-gray-600">Marketing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  ₹{defaults.utility}
                </div>
                <div className="text-sm text-gray-600">Utility</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  ₹{defaults.authentication}
                </div>
                <div className="text-sm text-gray-600">Authentication</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Update Default Pricing</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Marketing Price */}
            <div className="space-y-2">
              <Label htmlFor="marketing-default">
                Marketing Price (₹)
                <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
              </Label>
              <Input
                id="marketing-default"
                type="text"
                value={formData.marketing}
                onChange={(e) => handleInputChange('marketing', e.target.value)}
                className={formErrors.marketing ? 'border-red-500' : ''}
                disabled={isSaving}
              />
              {formErrors.marketing && (
                <p className="text-xs text-red-600">{formErrors.marketing}</p>
              )}
            </div>

            {/* Utility Price */}
            <div className="space-y-2">
              <Label htmlFor="utility-default">
                Utility Price (₹)
                <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
              </Label>
              <Input
                id="utility-default"
                type="text"
                value={formData.utility}
                onChange={(e) => handleInputChange('utility', e.target.value)}
                className={formErrors.utility ? 'border-red-500' : ''}
                disabled={isSaving}
              />
              {formErrors.utility && (
                <p className="text-xs text-red-600">{formErrors.utility}</p>
              )}
            </div>

            {/* Authentication Price */}
            <div className="space-y-2">
              <Label htmlFor="authentication-default">
                Authentication Price (₹)
                <span className="text-xs text-gray-500 ml-1">(up to 4 decimals)</span>
              </Label>
              <Input
                id="authentication-default"
                type="text"
                value={formData.authentication}
                onChange={(e) => handleInputChange('authentication', e.target.value)}
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
              <strong>Message Categories:</strong>
              <br />
              • <strong>Marketing:</strong> Promotional and marketing messages (typically most expensive)
              <br />
              • <strong>Utility:</strong> Transactional messages like order updates, shipping notifications
              <br />
              • <strong>Authentication:</strong> OTP and verification messages (typically least expensive)
            </AlertDescription>
          </Alert>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Global Defaults'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}