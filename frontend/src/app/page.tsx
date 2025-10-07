'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/auth/login');
      } else {
        // Redirect based on user role
        switch (user?.role) {
          case 'admin':
            router.push('/admin');
            break;
          case 'faculty':
            router.push('/faculty');
            break;
          case 'student':
            router.push('/dashboard');
            break;
          default:
            router.push('/dashboard');
        }
      }
    }
  }, [isAuthenticated, loading, user?.role, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return null;
}