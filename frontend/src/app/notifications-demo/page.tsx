'use client';

import React from 'react';
import { NotificationCenter, NotificationPreferences } from '@/components/notifications';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function NotificationsDemo() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Notification System Demo</h1>
              <p className="text-gray-600 mt-2">
                Test the real-time notification center and user preferences
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Notification Center Demo */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Center</h2>
                  <p className="text-gray-600 mb-4">
                    Click the bell icon to view notifications
                  </p>
                  <div className="flex justify-center">
                    <NotificationCenter />
                  </div>
                </div>

                {/* Connection Status */}
                <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Real-time Status</h3>
                  <ConnectionStatus />
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="lg:col-span-2">
                <NotificationPreferences />
              </div>
            </div>
          </div>
        </div>
      </NotificationProvider>
    </AuthProvider>
  );
}

function ConnectionStatus() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-700">Demo Mode - Real-time disabled</span>
      </div>
      <p className="text-xs text-gray-500">
        In production, this will show WebSocket connection status
      </p>
    </div>
  );
}