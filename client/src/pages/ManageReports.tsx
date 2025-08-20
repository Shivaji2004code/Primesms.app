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
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium min-w-[60px] justify-center">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>Sent</span>
          </div>
        );
      case 'delivered':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium min-w-[70px] justify-center">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>Delivered</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium min-w-[60px] justify-center">
            <XCircle className="h-2.5 w-2.5" />
            <span>Failed</span>
          </div>
        );
      case 'duplicate':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium min-w-[75px] justify-center">
            <XCircle className="h-2.5 w-2.5" />
            <span>Duplicate</span>
          </div>
        );
      case 'read':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium min-w-[50px] justify-center">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>Read</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs font-medium min-w-[60px] justify-center">
            <Clock className="h-2.5 w-2.5" />
            <span>Pending</span>
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
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm table-fixed">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[15%]">Template</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[12%]">Recipient</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[10%]">Status</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[12%]">Sent At</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[13%]">Delivered At</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[12%]">Read At</th>
                    <th className="text-left px-3 py-4 font-semibold text-sm uppercase tracking-wider w-[26%]">Error Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 px-4">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-5 w-5 animate-spin text-green-600 mr-2" />
                          <span className="text-sm text-gray-600">Loading reports...</span>
                        </div>
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 px-4 text-gray-500">
                        <div className="flex flex-col items-center">
                          <FileText className="h-10 w-10 text-gray-300 mb-2" />
                          <span className="text-sm">No reports found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reports.map((report, index) => (
                      <tr key={report.id} className={`hover:bg-gray-50 transition-all duration-200 border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-4 w-[15%]">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                            <span className="text-sm text-gray-700 font-medium truncate" title={report.template_used}>
                              {report.template_used}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 w-[12%]">
                          <span className="text-sm text-gray-700 font-mono truncate" title={formatPhoneNumber(report.recipient_number)}>
                            {formatPhoneNumber(report.recipient_number)}
                          </span>
                        </td>
                        <td className="px-3 py-4 w-[10%]">
                          {getStatusBadge(report.status)}
                        </td>
                        <td className="px-3 py-4 w-[12%]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-blue-600 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate" title={formatDate(report.sent_at)}>
                              {formatDate(report.sent_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 w-[13%]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-green-600 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate" title={formatDate(report.delivered_at)}>
                              {formatDate(report.delivered_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 w-[12%]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-purple-600 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate" title={formatDate(report.read_at)}>
                              {formatDate(report.read_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 w-[26%]">
                          {report.error_message ? (
                            <div className="relative group">
                              <div 
                                className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg px-2 py-1 cursor-help"
                                title={report.error_message}
                              >
                                <div className="flex items-center gap-1">
                                  <XCircle className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{report.error_message}</span>
                                </div>
                              </div>
                              {/* Enhanced tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-[300px] max-w-[400px]">
                                <div className="break-words whitespace-normal">
                                  {report.error_message}
                                </div>
                                {/* Arrow */}
                                <div className="absolute top-full left-4 -mt-1">
                                  <div className="border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No errors</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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