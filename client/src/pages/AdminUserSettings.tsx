import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, Eye, EyeOff, User as UserIcon, Building, Shield, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '../components/layout/DashboardLayout';
import WhatsApp360DialogSettings from '../components/WhatsApp360DialogSettings';
import AdminUserPricing from '../components/AdminUserPricing';
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

  // Legacy business form data - kept for backward compatibility but not used in 360dialog tab
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

  // Password change states
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

      // Business info is now handled by the 360dialog component in the WhatsApp tab
      // Legacy business info API call removed - 360dialog settings save independently

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

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordFormData(prev => ({ ...prev, [field]: value }));

    // Clear field error
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Clear messages
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handlePasswordChange = async () => {
    if (!passwordFormData.newPassword || !passwordFormData.confirmPassword) {
      setFormErrors({ passwordGeneral: 'Both password fields are required' });
      return;
    }

    if (passwordFormData.newPassword.length < 6) {
      setFormErrors({ newPassword: 'Password must be at least 6 characters long' });
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setFormErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!id) return;

    setIsChangingPassword(true);
    setError('');
    setSuccessMessage('');
    setFormErrors({});

    try {
      const response = await fetch(`/api/admin/users/${id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          newPassword: passwordFormData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      const data = await response.json();
      setSuccessMessage(`Password successfully changed for ${data.user.name}`);
      
      // Reset password form
      setPasswordFormData({
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
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
          <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
            <TabsTrigger value="basic" className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4" />
              <span>Basic Information</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>WhatsApp Business</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center space-x-2">
              <IndianRupee className="h-4 w-4" />
              <span>Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Security</span>
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

          {/* WhatsApp Business Tab - 360dialog Integration */}
          <TabsContent value="business" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <CardTitle className="flex items-center space-x-2 text-gray-800">
                  <Building className="h-5 w-5 text-green-600" />
                  <span>WhatsApp Business - 360dialog</span>
                </CardTitle>
                <CardDescription>
                  Configure 360dialog WhatsApp Business API integration
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <WhatsApp360DialogSettings userId={id || ''} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            {id && <AdminUserPricing userId={parseInt(id)} />}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b">
                <CardTitle className="flex items-center space-x-2 text-gray-800">
                  <Shield className="h-5 w-5 text-red-600" />
                  <span>Security & Password Management</span>
                </CardTitle>
                <CardDescription>
                  Change user password and manage security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-yellow-800 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-semibold">Security Warning</span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    You are about to change this user's password. This action will be logged for security auditing.
                    The user will need to use the new password for their next login.
                  </p>
                </div>

                {formErrors.passwordGeneral && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
                    <X className="h-5 w-5 mr-2 text-red-500" />
                    {formErrors.passwordGeneral}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">New Password *</label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordFormData.newPassword}
                        onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                        className={`pr-12 transition-all ${formErrors.newPassword ? 'border-red-300 focus:ring-red-200' : 'focus:ring-red-200'}`}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {formErrors.newPassword && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.newPassword}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 6 characters long
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Confirm Password *</label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordFormData.confirmPassword}
                        onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                        className={`pr-12 transition-all ${formErrors.confirmPassword ? 'border-red-300 focus:ring-red-200' : 'focus:ring-red-200'}`}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {formErrors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-2 flex items-center">
                        <X className="h-4 w-4 mr-1" />
                        {formErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">Password Change Action</h4>
                      <p className="text-xs text-gray-600 mt-1">This action will be logged in the admin audit trail</p>
                    </div>
                    <Button
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword || !passwordFormData.newPassword || !passwordFormData.confirmPassword}
                      className="bg-red-600 hover:bg-red-700 text-white px-6"
                    >
                      {isChangingPassword ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Changing...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {userDetails && (
                  <div className="pt-6 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">Last Password Change:</span>
                      <p>Password changes are not tracked historically. This feature logs all admin password changes for security auditing.</p>
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