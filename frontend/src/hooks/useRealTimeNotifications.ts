'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import toast from 'react-hot-toast';

interface UseRealTimeNotificationsOptions {
  onNotification?: (notification: Notification) => void;
  autoConnect?: boolean;
}

export function useRealTimeNotifications(options: UseRealTimeNotificationsOptions = {}) {
  const { user, isAuthenticated } = useAuth();
  const { onNotification, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (!isAuthenticated || !user || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8787';
      const token = localStorage.getItem('token');
      
      if (!token) {
        setConnectionError('No authentication token available');
        return;
      }

      const ws = new WebSocket(`${wsUrl}/api/notifications/ws?token=${token}&userId=${user.id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for real-time notifications');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;

        // Send initial ping to establish connection
        ws.send(JSON.stringify({
          type: 'ping',
          userId: user.id,
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'notification':
              const notification: Notification = data.notification;
              
              // Call custom handler if provided
              if (onNotification) {
                onNotification(notification);
              }
              
              // Show toast notification
              showNotificationToast(notification);
              break;
              
            case 'pong':
              console.log('WebSocket pong received');
              break;
              
            case 'error':
              console.error('WebSocket error message:', data.message);
              setConnectionError(data.message);
              break;
              
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not a clean close and under retry limit
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError('Failed to reconnect after multiple attempts');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionError('Failed to establish connection');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  };

  const sendPing = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && user) {
      wsRef.current.send(JSON.stringify({
        type: 'ping',
        userId: user.id,
        timestamp: Date.now()
      }));
    }
  };

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user, autoConnect]);

  // Ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(sendPing, 30000);
    return () => clearInterval(pingInterval);
  }, [isConnected, user]);

  // Show notification toast
  const showNotificationToast = (notification: Notification) => {
    const getToastType = (type: string, priority?: string) => {
      if (priority === 'urgent') return 'error';
      if (type === 'certificate' && notification.message.includes('approved')) return 'success';
      if (type === 'certificate' && notification.message.includes('rejected')) return 'error';
      if (type === 'points') return 'success';
      if (type === 'system') return 'error';
      return 'default';
    };

    const toastType = getToastType(notification.type, notification.priority);
    
    // Simple text-based toast content
    const message = `${notification.title}\n${notification.message}${notification.priority === 'urgent' ? ' (URGENT)' : ''}`;

    switch (toastType) {
      case 'success':
        toast.success(message, { duration: 5000 });
        break;
      case 'error':
        toast.error(message, { duration: 7000 });
        break;
      default:
        toast(message, { duration: 4000 });
    }

    // Request browser notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification for urgent items
    if (notification.priority === 'urgent' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `notification-${notification.id}`,
      });
    }
  };

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendPing,
  };
}