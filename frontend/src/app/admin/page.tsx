'use client';

import { useAuth } from '@/contexts/AuthContext';
import AdminPanel from '@/components/dashboard/AdminPanel';
import Layout from '@/components/Layout';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else if (user.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Layout>
      <AdminPanel />
    </Layout>
  );
}