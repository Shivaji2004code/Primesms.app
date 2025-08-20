import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Filter,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  MessageSquare,
  Calendar,
  ChevronDown
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../components/ui/use-toast';

interface MessageReport {
  id: string;
  campaign_name: string;
  template_used: string;
  from_number: string | null;
  recipient_number: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'duplicate';
  read_status: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface CampaignSummary {
  total_campaigns: number;
  total_messages: number;
  successful_messages: number;
  failed_messages: number;
  success_rate: number;
}

export default function ManageReports() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    recipientNumber: '',
    template: '',
    status: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(50);
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Load reports data
  useEffect(() => {
    loadReports();
    loadSummary();
    loadAvailableTemplates();
  }, [currentPage]);

  // Reload when filters change
  useEffect(() => {
    setCurrentPage(1);
    loadReports();
  }, [filters]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (exportDropdownOpen && !target.closest('.relative')) {
        setExportDropdownOpen(false);
      }
    };

    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportDropdownOpen]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        recipientNumber: filters.recipientNumber,
        template: filters.template,
        status: filters.status
      });

      // Remove empty parameters
      for (const [key, value] of params.entries()) {
        if (!value || value === 'all') {
          params.delete(key);
        }
      }

      const response = await fetch(`/api/whatsapp/reports?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.data.reports || []);
        setTotalPages(Math.ceil(data.data.total / pageSize));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Reports API Error:', response.status, errorData);
        toast({
          title: "Error",
          description: `Failed to load reports: ${errorData.error || response.status}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports - Network error",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await fetch('/api/whatsapp/reports/summary', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadAvailableTemplates = async () => {
    try {
      const response = await fetch('/api/whatsapp/reports/templates', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      recipientNumber: '',
      template: '',
      status: 'all'
    });
  };

  const exportReports = async (format: 'csv' | 'excel') => {
    try {
      console.log(`📊 Starting ${format.toUpperCase()} export...`);
      
      const params = new URLSearchParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        recipientNumber: filters.recipientNumber,
        template: filters.template,
        status: filters.status,
        export: format
      });

      // Remove empty parameters
      for (const [key, value] of params.entries()) {
        if (!value || value === 'all') {
          params.delete(key);
        }
      }

      console.log(`📊 Export URL: /api/whatsapp/reports?${params}`);

      const response = await fetch(`/api/whatsapp/reports?${params}`, {
        credentials: 'include'
      });

      console.log(`📊 Response status: ${response.status}`);
      console.log(`📊 Response headers:`, response.headers);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log(`📊 Content-Type: ${contentType}`);
        
        const blob = await response.blob();
        console.log(`📊 Blob size: ${blob.size} bytes, type: ${blob.type}`);
        
        if (blob.size === 0) {
          throw new Error('Empty file received');
        }
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename based on filters
        const filterStr = Object.entries(filters)
          .filter(([key, value]) => value && value !== 'all')
          .map(([key, value]) => `${key}-${value}`)
          .join('_');
        
        const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
        const filename = filterStr 
          ? `whatsapp_reports_filtered_${filterStr}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
          : `whatsapp_reports_all_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
        
        console.log(`📊 Download filename: ${filename}`);
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: filterStr 
            ? `Filtered reports exported as ${format.toUpperCase()} successfully` 
            : `All reports exported as ${format.toUpperCase()} successfully`,
          variant: "default"
        });
      } else {
        const errorText = await response.text();
        console.error(`📊 Export failed: ${response.status} - ${errorText}`);
        
        let errorMessage = "Failed to export reports";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.details || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error exporting reports:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export reports",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-bold shadow-md min-w-[85px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-2 w-2 text-blue-600" />
            </div>
            <span>SENT</span>
          </div>
        );
      case 'delivered':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg text-xs font-bold shadow-md min-w-[95px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-2 w-2 text-green-600" />
            </div>
            <span>DELIVERED</span>
          </div>
        );
      case 'failed':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-xs font-bold shadow-md min-w-[85px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <XCircle className="h-2 w-2 text-red-600" />
            </div>
            <span>FAILED</span>
          </div>
        );
      case 'duplicate':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-xs font-bold shadow-md min-w-[95px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <XCircle className="h-2 w-2 text-orange-600" />
            </div>
            <span>DUPLICATE</span>
          </div>
        );
      case 'read':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg text-xs font-bold shadow-md min-w-[75px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-2 w-2 text-purple-600" />
            </div>
            <span>READ</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg text-xs font-bold shadow-md min-w-[85px] justify-center">
            <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
              <Clock className="h-2 w-2 text-gray-500" />
            </div>
            <span>PENDING</span>
          </div>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return '-';
    return phone.startsWith('+') ? phone : `+${phone}`;
  };

  return (
    <DashboardLayout
      title="Manage Reports"
      subtitle="View and analyze your WhatsApp campaign performance and message delivery reports"
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/user/dashboard')}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total Campaigns</p>
                    <p className="text-2xl font-bold text-blue-900">{summary.total_campaigns}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Total Messages</p>
                    <p className="text-2xl font-bold text-green-900">{summary.total_messages}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-600 text-sm font-medium">Successful</p>
                    <p className="text-2xl font-bold text-emerald-900">{summary.successful_messages}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-medium">Success Rate</p>
                    <p className="text-2xl font-bold text-purple-900">{summary.success_rate.toFixed(1)}%</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Message Reports</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadReports}
                  disabled={loading}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('CSV export clicked');
                    exportReports('csv');
                  }}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Excel export clicked');
                    exportReports('excel');
                  }}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export Excel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Enhanced Filters */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Filter Reports</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Clear All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Recipient Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., +919398424270"
                    value={filters.recipientNumber}
                    onChange={(e) => handleFilterChange('recipientNumber', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template
                  </label>
                  <select
                    value={filters.template}
                    onChange={(e) => handleFilterChange('template', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Templates</option>
                    {availableTemplates.map((template) => (
                      <option key={template} value={template}>
                        {template}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                    <option value="duplicate">Duplicate Blocked</option>
                    <option value="read">Read</option>
                  </select>
                </div>
              </div>

              {/* Active Filters Display */}
              {Object.entries(filters).some(([key, value]) => value && value !== 'all') && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value || value === 'all') return null;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs"
                      >
                        {key}: {value}
                        <button
                          onClick={() => handleFilterChange(key, key === 'status' ? 'all' : '')}
                          className="hover:text-green-900"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reports Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-full border-collapse bg-white table-fixed">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[18%] border-r border-slate-700">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Template
                      </div>
                    </th>
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[15%] border-r border-slate-700">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Recipient
                      </div>
                    </th>
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[12%] border-r border-slate-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Status
                      </div>
                    </th>
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[16%] border-r border-slate-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Delivered At
                      </div>
                    </th>
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[14%] border-r border-slate-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-400" />
                        Read At
                      </div>
                    </th>
                    <th className="text-left px-4 py-5 font-bold text-xs uppercase tracking-widest w-[25%]">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        Error Message
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 px-4">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-5 w-5 animate-spin text-green-600 mr-2" />
                          <span className="text-sm text-gray-600">Loading reports...</span>
                        </div>
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 px-4 text-gray-500">
                        <div className="flex flex-col items-center">
                          <FileText className="h-10 w-10 text-gray-300 mb-2" />
                          <span className="text-sm">No reports found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reports.map((report, index) => (
                      <tr key={report.id} className={`hover:bg-slate-50 transition-all duration-300 border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-4 py-5 w-[18%] border-r border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm text-gray-800 font-semibold truncate" title={report.template_used}>
                              {report.template_used}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-5 w-[15%] border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Phone className="h-3 w-3 text-green-600" />
                            </div>
                            <span className="text-sm text-gray-800 font-mono font-medium truncate" title={formatPhoneNumber(report.recipient_number)}>
                              {formatPhoneNumber(report.recipient_number)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-5 w-[12%] border-r border-gray-100">
                          {getStatusBadge(report.status)}
                        </td>
                        <td className="px-4 py-5 w-[16%] border-r border-gray-100">
                          <div className="flex flex-col gap-1">
                            {report.delivered_at ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-xs font-semibold text-green-700">
                                    {new Date(report.delivered_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-600 font-medium ml-7">
                                  {new Date(report.delivered_at).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                </div>
                                <span className="text-xs text-gray-400 font-medium">Not delivered</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 w-[14%] border-r border-gray-100">
                          <div className="flex flex-col gap-1">
                            {report.read_at ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="h-3 w-3 text-purple-600" />
                                  </div>
                                  <span className="text-xs font-semibold text-purple-700">
                                    {new Date(report.read_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-600 font-medium ml-7">
                                  {new Date(report.read_at).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                </div>
                                <span className="text-xs text-gray-400 font-medium">Not read</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 w-[25%]">
                          {report.error_message ? (
                            <div className="relative group">
                              <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 rounded-r-lg px-3 py-2 cursor-help">
                                <div className="flex items-start gap-2">
                                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-red-800 mb-1">Error Details</p>
                                    <p className="text-xs text-red-700 font-medium leading-relaxed" style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {report.error_message}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {/* Enhanced tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 px-4 py-3 bg-gray-900 text-white text-xs rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 min-w-[320px] max-w-[450px]">
                                <div className="break-words whitespace-normal leading-relaxed">
                                  <p className="font-semibold mb-1 text-yellow-400">Complete Error Message:</p>
                                  {report.error_message}
                                </div>
                                <div className="absolute top-full left-6 -mt-1">
                                  <div className="border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              </div>
                              <span className="text-xs text-green-600 font-medium">No errors</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}