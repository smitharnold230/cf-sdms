'use client';

import { useAuth } from '@/contexts/AuthContext';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import Layout from '@/components/Layout';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <Layout>
      <StudentDashboard />
    </Layout>
  );
}