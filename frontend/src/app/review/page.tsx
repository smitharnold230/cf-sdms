'use client';

import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Certificate } from '@/types';
import { facultyApi } from '@/lib/api';
import { FileCheck, Download, CheckCircle, XCircle, Calendar, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else if (user.role !== 'faculty' && user.role !== 'admin') {
        router.push('/dashboard');
      } else {
        fetchPendingCertificates();
      }
    }
  }, [user, loading, router]);

  const fetchPendingCertificates = async () => {
    try {
      setLoadingCerts(true);
      const response = await facultyApi.getPendingCertificates();
      if (response.success) {
        setCertificates(response.certificates || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending certificates:', error);
      toast.error('Failed to load pending certificates');
    } finally {
      setLoadingCerts(false);
    }
  };

  const handleApprove = async (certificateId: number) => {
    try {
      await facultyApi.approveCertificate(certificateId);
      toast.success('Certificate approved successfully');
      fetchPendingCertificates(); // Refresh list
    } catch (error) {
      toast.error('Failed to approve certificate');
    }
  };

  const handleReject = async (certificateId: number) => {
    try {
      await facultyApi.rejectCertificate(certificateId);
      toast.success('Certificate rejected');
      fetchPendingCertificates(); // Refresh list
    } catch (error) {
      toast.error('Failed to reject certificate');
    }
  };

  if (loading || !user) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Certificate Review</h1>
          <p className="text-gray-600 mt-2">Review and approve pending certificate submissions</p>
        </div>

        {/* Certificates List */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Pending Certificates</h2>
            <div className="text-sm text-gray-500">
              {certificates.length} pending review{certificates.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loadingCerts ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : certificates.length > 0 ? (
            <div className="space-y-4">
              {certificates.map((cert) => (
                <div key={cert.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-orange-100 rounded-lg">
                        <FileCheck className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{cert.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            Student ID: {cert.user_id}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(cert.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => window.open(`/api/certificates/${cert.id}/download`, '_blank')}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        View
                      </button>
                      <button
                        onClick={() => handleReject(cert.id)}
                        className="flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(cert.id)}
                        className="flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pending certificates</h3>
              <p className="text-gray-500">All certificates have been reviewed.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}