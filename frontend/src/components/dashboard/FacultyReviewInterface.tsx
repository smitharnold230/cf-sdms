'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Certificate, User } from '@/types';
import { certificatesApi, usersApi } from '@/lib/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Download,
  Clock,
  User as UserIcon,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CertificateWithUser extends Certificate {
  user?: User;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function FacultyReviewInterface() {
  const { user, hasRole } = useAuth();
  const [certificates, setCertificates] = useState<CertificateWithUser[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<CertificateWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState<number | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  
  // Modal state
  const [reviewModal, setReviewModal] = useState<{
    certificate: CertificateWithUser | null;
    action: 'approve' | 'reject' | null;
  }>({
    certificate: null,
    action: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (user && hasRole(['faculty', 'admin'])) {
      fetchData();
    }
  }, [user, hasRole]);

  useEffect(() => {
    applyFilters();
  }, [certificates, searchTerm, statusFilter, selectedUserId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all users to get certificate submissions
      const usersResponse = await usersApi.getUsers();
      setUsers(usersResponse.users);
      
      // Fetch certificates for all users
      const allCertificates: CertificateWithUser[] = [];
      
      for (const userData of usersResponse.users) {
        try {
          const userCerts = await certificatesApi.getUserCertificates(userData.id);
          const certsWithUser = userCerts.certificates.map(cert => ({
            ...cert,
            user: userData
          }));
          allCertificates.push(...certsWithUser);
        } catch (error) {
          // Skip if no access to user's certificates
          console.warn(`Could not fetch certificates for user ${userData.id}`);
        }
      }
      
      // Sort by creation date (newest first)
      allCertificates.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setCertificates(allCertificates);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load certificate data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = certificates;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(cert => 
        cert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.user?.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(cert => cert.status === statusFilter);
    }

    // User filter
    if (selectedUserId) {
      filtered = filtered.filter(cert => cert.user_id === selectedUserId);
    }

    setFilteredCertificates(filtered);
  };

  const handleReview = async (certificateId: number, status: 'approved' | 'rejected', reason?: string) => {
    try {
      setReviewLoading(certificateId);
      
      await certificatesApi.reviewCertificate(certificateId, status, reason);
      
      // Update local state
      setCertificates(prev => 
        prev.map(cert => 
          cert.id === certificateId 
            ? { 
                ...cert, 
                status, 
                reviewer_id: user?.id,
                reviewed_at: new Date().toISOString(),
                rejection_reason: reason 
              }
            : cert
        )
      );
      
      toast.success(`Certificate ${status} successfully`);
      setReviewModal({ certificate: null, action: null });
      setRejectionReason('');
      
    } catch (error: any) {
      console.error('Review failed:', error);
      toast.error(error.response?.data?.message || 'Review failed');
    } finally {
      setReviewLoading(null);
    }
  };

  const downloadCertificate = async (certificateId: number, title: string) => {
    try {
      const blob = await certificatesApi.downloadCertificate(certificateId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download certificate');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-100';
      case 'rejected':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-yellow-700 bg-yellow-100';
    }
  };

  if (!hasRole(['faculty', 'admin'])) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Certificate Review</h1>
          <p className="text-gray-600 mt-2">Review and approve student certificate submissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">
                  {certificates.filter(c => c.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {certificates.filter(c => c.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">
                  {certificates.filter(c => c.status === 'rejected').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-primary-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, student name, or email..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="input md:w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* User Filter */}
            <select
              className="input md:w-64"
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All Students</option>
              {users.filter(u => u.role === 'student').map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Certificates List */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certificate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCertificates.map((certificate) => (
                  <tr key={certificate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {certificate.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            Issued: {certificate.issued_date}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserIcon className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {certificate.user?.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {certificate.user?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(certificate.status)}
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(certificate.status)}`}>
                          {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(parseISO(certificate.created_at))} ago
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadCertificate(certificate.id, certificate.title)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        {certificate.status === 'pending' && (
                          <>
                            <button
                              onClick={() => setReviewModal({ certificate, action: 'approve' })}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                              disabled={reviewLoading === certificate.id}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => setReviewModal({ certificate, action: 'reject' })}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                              disabled={reviewLoading === certificate.id}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredCertificates.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
                <p className="text-gray-500">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Review Modal */}
        {reviewModal.certificate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {reviewModal.action === 'approve' ? 'Approve' : 'Reject'} Certificate
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Certificate:</strong> {reviewModal.certificate.title}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Student:</strong> {reviewModal.certificate.user?.full_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Issued:</strong> {reviewModal.certificate.issued_date}
                </p>
              </div>

              {reviewModal.action === 'reject' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Please provide a reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setReviewModal({ certificate: null, action: null });
                    setRejectionReason('');
                  }}
                  className="btn btn-secondary"
                  disabled={reviewLoading === reviewModal.certificate.id}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (reviewModal.action === 'reject' && !rejectionReason.trim()) {
                      toast.error('Please provide a rejection reason');
                      return;
                    }
                    handleReview(
                      reviewModal.certificate!.id,
                      reviewModal.action === 'approve' ? 'approved' : 'rejected',
                      reviewModal.action === 'reject' ? rejectionReason : undefined
                    );
                  }}
                  className={`btn ${reviewModal.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  disabled={reviewLoading === reviewModal.certificate.id}
                >
                  {reviewLoading === reviewModal.certificate.id ? 'Processing...' : 
                    (reviewModal.action === 'approve' ? 'Approve' : 'Reject')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}