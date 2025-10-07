'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/ui/NotificationBell';
import { LogOut, User, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', roles: ['student', 'faculty', 'admin'] },
    { name: 'Review', href: '/faculty', roles: ['faculty', 'admin'] },
    { name: 'Admin', href: '/admin', roles: ['admin'] },
  ];

  const visibleItems = navigationItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SDMS</h1>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {visibleItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  {item.name}
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <NotificationBell />
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <User className="w-8 h-8 text-gray-400 bg-gray-100 rounded-full p-1" />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}