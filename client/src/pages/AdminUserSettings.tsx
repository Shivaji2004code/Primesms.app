import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, Eye, EyeOff, User as UserIcon, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '../components/layout/DashboardLayout';
import type { UserWithBusinessInfo, CreateBusinessInfoRequest } from '@/types';

export default function AdminUserSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [userDetails, setUserDetails] = useState<UserWithBusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);

  // Form states
  const [basicFormData, setBasicFormData] = useState({
    name: '',
    email: '',
    username: '',
    phoneNumber: '',
    role: 'user' as 'user' | 'admin',
    creditBalance: 0
  });

  const [businessFormData, setBusinessFormData] = useState<CreateBusinessInfoRequest>({
    businessName: '',
    whatsappNumber: '',
    whatsappNumberId: '',
    wabaId: '',
    accessToken: '',
    webhookUrl: '',
    webhookVerifyToken: '',
    appSecret: '',
    isActive: true
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/users/${id}/details`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUserDetails(data.user);
        
        // Populate form data
        setBasicFormData({
          name: data.user.name || '',
          email: data.user.email || '',
          username: data.user.username || '',
          phoneNumber: data.user.phoneNumber || '',
          role: data.user.role || 'user',
          creditBalance: data.user.creditBalance || 0
        });

        if (data.user.businessInfo) {
          setBusinessFormData({
            businessName: data.user.businessInfo.businessName || '',
            whatsappNumber: data.user.businessInfo.whatsappNumber || '',
            whatsappNumberId: data.user.businessInfo.whatsappNumberId || '',
            wabaId: data.user.businessInfo.wabaId || '',
            accessToken: data.user.businessInfo.accessToken || '',
            webhookUrl: data.user.businessInfo.webhookUrl || '',
            webhookVerifyToken: data.user.businessInfo.webhookVerifyToken || '',
            appSecret: data.user.businessInfo.appSecret || '',
            isActive: data.user.businessInfo.isActive ?? true
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch user details');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    // Basic info validation
    if (!basicFormData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!basicFormData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(basicFormData.email)) {
        errors.email = 'Invalid email format';
      }
    }

    if (!basicFormData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (basicFormData.creditBalance < 0) {
      errors.creditBalance = 'Credit balance cannot be negative';
    }

    // Business info validation
    if (businessFormData.whatsappNumber && !/^\+?[\d\s-()]+$/.test(businessFormData.whatsappNumber)) {
      errors.whatsappNumber = 'Invalid WhatsApp number format';
    }

    if (businessFormData.webhookUrl && !/^https?:\/\/.+/.test(businessFormData.webhookUrl)) {
      errors.webhookUrl = 'Webhook URL must be a valid HTTP/HTTPS URL';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !id) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // Update basic user info
      const basicResponse = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(basicFormData)
      });

      if (!basicResponse.ok) {
        const errorData = await basicResponse.json();
        throw new Error(errorData.error || 'Failed to update basic information');
      }

      // Update business info
      const businessResponse = await fetch(`/api/admin/users/${id}/business-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(businessFormData)
      });

      if (!businessResponse.ok) {
        const errorData = await businessResponse.json();
        throw new Error(errorData.error || 'Failed to update business information');
      }

      setSuccessMessage('User settings updated successfully');
      fetchUserDetails(); // Refresh data

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any, isBusinessField = false) => {
    if (isBusinessField) {
      setBusinessFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setBasicFormData(prev => ({ ...prev, [field]: value }));
    }

    // Clear field error
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Clear messages
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  if (isLoading) {
    return (
      <DashboardLayout 
        title="User Settings"
        subtitle="Loading user configuration..."
      >
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading user settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="User Settings"
      subtitle={userDetails ? `Configure settings for ${userDetails.name}` : 'Configure user settings'}
    >
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/dashboard')}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
            <X className="h-5 w-5 mr-2 text-red-500" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
            <Save className="h-5 w-5 mr-2 text-green-500" />
            {successMessage}
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-96">
            <TabsTrigger value="basic" className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4" />
              <span>Basic Information</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>WhatsApp Business</span>
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <CardTitle className="flex items-center space-x-2 text-gray-800">
                  <UserIcon className="h-5 w-5 text-blue-600" />
                  <span>Basic Information</span>
                </CardTitle>
                <CardDescription>
                  Manage user account details, permissions, and credit balance
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Name *</label>
                    <Input
                      value={basicFormData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`transition-all ${formErrors.name ? 'border-red-300 focus:ring-red-200' : 'focus:ring-blue-200'}`}
                      placeholder="Enter full name"
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Email *</label>
                    <Input
                      type="email"
                      value={basicFormData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`transition-all ${formErrors.email ? 'border-red-300 focus:ring-red-200' : 'focus:ring-blue-200'}`}
                      placeholder="Enter email address"
                    />
                    {formErrors.email && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Username *</label>
                    <Input
                      value={basicFormData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className={`transition-all ${formErrors.username ? 'border-red-300 focus:ring-red-200' : 'focus:ring-blue-200'}`}
                      placeholder="Enter username"
                    />
                    {formErrors.username && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.username}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Phone Number</label>
                    <Input
                      value={basicFormData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="focus:ring-blue-200"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Role</label>
                    <select
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                      value={basicFormData.role}
                      onChange={(e) => handleInputChange('role', e.target.value as 'user' | 'admin')}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Credit Balance</label>
                    <Input
                      type="number"
                      value={basicFormData.creditBalance}
                      onChange={(e) => handleInputChange('creditBalance', parseInt(e.target.value) || 0)}
                      className={`transition-all ${formErrors.creditBalance ? 'border-red-300 focus:ring-red-200' : 'focus:ring-blue-200'}`}
                      placeholder="Enter credit balance"
                    />
                    {formErrors.creditBalance && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.creditBalance}
                      </p>
                    )}
                  </div>
                </div>

                {userDetails && (
                  <div className="pt-6 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-800">User ID:</span>
                        <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">{userDetails.id}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Created:</span>
                        <p>{new Date(userDetails.createdAt).toLocaleDateString()}</p>
                      </div>
                      {userDetails.updatedAt && (
                        <div>
                          <span className="font-semibold text-gray-800">Updated:</span>
                          <p>{new Date(userDetails.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Business Tab */}
          <TabsContent value="business" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <CardTitle className="flex items-center space-x-2 text-gray-800">
                  <Building className="h-5 w-5 text-green-600" />
                  <span>WhatsApp Business Information</span>
                </CardTitle>
                <CardDescription>
                  Configure WhatsApp Business API credentials and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Business Name</label>
                    <Input
                      value={businessFormData.businessName || ''}
                      onChange={(e) => handleInputChange('businessName', e.target.value, true)}
                      placeholder="Your Business Name"
                      className="focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">WhatsApp Number</label>
                    <Input
                      value={businessFormData.whatsappNumber || ''}
                      onChange={(e) => handleInputChange('whatsappNumber', e.target.value, true)}
                      placeholder="+1234567890"
                      className={`transition-all ${formErrors.whatsappNumber ? 'border-red-300 focus:ring-red-200' : 'focus:ring-green-200'}`}
                    />
                    {formErrors.whatsappNumber && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.whatsappNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">WhatsApp Number ID</label>
                    <Input
                      value={businessFormData.whatsappNumberId || ''}
                      onChange={(e) => handleInputChange('whatsappNumberId', e.target.value, true)}
                      placeholder="Meta WhatsApp Number ID"
                      className="focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">WABA ID</label>
                    <Input
                      value={businessFormData.wabaId || ''}
                      onChange={(e) => handleInputChange('wabaId', e.target.value, true)}
                      placeholder="WhatsApp Business Account ID"
                      className="focus:ring-green-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Access Token</label>
                    <div className="relative">
                      <Input
                        type={showAccessToken ? 'text' : 'password'}
                        value={businessFormData.accessToken || ''}
                        onChange={(e) => handleInputChange('accessToken', e.target.value, true)}
                        placeholder="Meta API Access Token"
                        className="pr-12 focus:ring-green-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessToken(!showAccessToken)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Webhook URL</label>
                    <Input
                      value={businessFormData.webhookUrl || ''}
                      onChange={(e) => handleInputChange('webhookUrl', e.target.value, true)}
                      placeholder="https://your-domain.com/webhook"
                      className={`transition-all ${formErrors.webhookUrl ? 'border-red-300 focus:ring-red-200' : 'focus:ring-green-200'}`}
                    />
                    {formErrors.webhookUrl && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.webhookUrl}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Webhook Verify Token</label>
                    <Input
                      value={businessFormData.webhookVerifyToken || ''}
                      onChange={(e) => handleInputChange('webhookVerifyToken', e.target.value, true)}
                      placeholder="Your webhook verification token"
                      className="focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">App Secret</label>
                    <div className="relative">
                      <Input
                        type={showAppSecret ? 'text' : 'password'}
                        value={businessFormData.appSecret || ''}
                        onChange={(e) => handleInputChange('appSecret', e.target.value, true)}
                        placeholder="Meta App Secret for webhook signature verification"
                        className="pr-12 focus:ring-green-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppSecret(!showAppSecret)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Required for webhook signature verification. Get this from Meta Developers Console.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={businessFormData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked, true)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
                    Account Active
                  </label>
                  <span className="text-xs text-gray-500">Enable WhatsApp Business API for this user</span>
                </div>

                {userDetails?.businessInfo && (
                  <div className="pt-6 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-800">Business ID:</span>
                        <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">{userDetails.businessInfo.id}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Created:</span>
                        <p>{new Date(userDetails.businessInfo.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Updated:</span>
                        <p>{new Date(userDetails.businessInfo.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}