'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Notification } from '@/types';
import { notificationsApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import toast from 'react-hot-toast';
import { Bell, CheckCircle, AlertCircle, Info, Award } from 'lucide-react';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  isConnected: boolean;
  connectionError: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Handle new real-time notifications
  const handleRealtimeNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  // Setup real-time connection
  const { isConnected, connectionError } = useRealTimeNotifications({
    onNotification: handleRealtimeNotification,
    autoConnect: true,
  });

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const pollNotifications = async () => {
      try {
        const response = await notificationsApi.getNotifications(user.id);
        const newNotifications = response.notifications;
        
        // Check for new notifications since last fetch
        if (lastFetch > 0) {
          const recentNotifications = newNotifications.filter(
            notif => new Date(notif.created_at).getTime() > lastFetch
          );
          
          // Show toast for new notifications
          recentNotifications.forEach(notif => {
            showNotificationToast(notif);
          });
        }
        
        setNotifications(newNotifications);
        setLastFetch(Date.now());
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    // Initial fetch
    pollNotifications();

    // Set up polling interval
    const interval = setInterval(pollNotifications, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, user, lastFetch]);

  const showNotificationToast = (notification: Notification) => {
    const getIcon = (type: string) => {
      switch (type) {
        case 'certificate':
          return <CheckCircle className="w-5 h-5" />;
        case 'points':
          return <Award className="w-5 h-5" />;
        case 'system':
          return <AlertCircle className="w-5 h-5" />;
        default:
          return <Info className="w-5 h-5" />;
      }
    };

    const getToastType = (type: string) => {
      switch (type) {
        case 'certificate':
          return notification.message.includes('approved') ? 'success' : 
                 notification.message.includes('rejected') ? 'error' : 'default';
        case 'points':
          return 'success';
        case 'system':
          return 'error';
        default:
          return 'default';
      }
    };

    const toastType = getToastType(notification.type);
    const icon = getIcon(notification.type);

    const toastContent = (
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {notification.title}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {notification.message}
          </p>
        </div>
      </div>
    );

    if (toastType === 'success') {
      toast.success(toastContent as any);
    } else if (toastType === 'error') {
      toast.error(toastContent as any);
    } else {
      toast(toastContent as any);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await notificationsApi.markAllAsRead(user.id);
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const refreshNotifications = async () => {
    if (!user) return;
    
    try {
      const response = await notificationsApi.getNotifications(user.id);
      setNotifications(response.notifications);
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    isConnected,
    connectionError,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}