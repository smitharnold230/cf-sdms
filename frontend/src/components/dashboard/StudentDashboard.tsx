'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Certificate, Event, Workshop, PointsEntry, Notification } from '@/types';
import { certificatesApi, eventsApi, workshopsApi, pointsApi, notificationsApi, dashboardApi } from '@/lib/api';
import { formatDistanceToNow, parseISO, isBefore, addDays } from 'date-fns';
import { 
  Award, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalPoints: number;
  pendingCertificates: number;
  approvedCertificates: number;
  upcomingDeadlines: number;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPoints: 0,
    pendingCertificates: 0,
    approvedCertificates: 0,
    upcomingDeadlines: 0,
  });
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<(Event | Workshop)[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Use centralized dashboard API if user is faculty or admin
      if (user.role === 'faculty' || user.role === 'admin') {
        const dashboardResponse = await dashboardApi.getDashboard();
        if (dashboardResponse.success) {
          const data = dashboardResponse.data;
          setStats({
            totalPoints: 0, // Faculty doesn't have points
            pendingCertificates: data.pendingReviews || 0,
            approvedCertificates: 0,
            upcomingDeadlines: 0,
          });
          setLoading(false);
          return;
        }
      }
      
      // Original student dashboard logic
      // Fetch user certificates
      const certsResponse = await certificatesApi.getUserCertificates(user.id);
      setCertificates(certsResponse.certificates);

      // Fetch points
      const pointsResponse = await pointsApi.getUserPoints(user.id);
      
      // Fetch events and workshops
      const eventsResponse = await eventsApi.getEvents();
      const workshopsResponse = await workshopsApi.getWorkshops();
      
      // Filter upcoming events/workshops with deadlines
      const now = new Date();
      const upcoming = [
        ...eventsResponse.events.filter(e => 
          e.registration_deadline && isBefore(now, parseISO(e.registration_deadline))
        ),
        ...workshopsResponse.workshops.filter(w => 
          w.registration_deadline && isBefore(now, parseISO(w.registration_deadline))
        )
      ].sort((a, b) => 
        new Date(a.registration_deadline!).getTime() - new Date(b.registration_deadline!).getTime()
      );
      
      setUpcomingEvents(upcoming);

      // Fetch notifications
      const notifResponse = await notificationsApi.getNotifications(user.id);
      setNotifications(notifResponse.notifications.filter(n => !n.is_read).slice(0, 5));

      // Calculate stats
      const pendingCount = certsResponse.certificates.filter(c => c.status === 'pending').length;
      const approvedCount = certsResponse.certificates.filter(c => c.status === 'approved').length;
      const upcomingCount = upcoming.filter(item => {
        const deadline = parseISO(item.registration_deadline!);
        return isBefore(now, addDays(deadline, 7)); // Next 7 days
      }).length;

      setStats({
        totalPoints: pointsResponse.total_points,
        pendingCertificates: pendingCount,
        approvedCertificates: approvedCount,
        upcomingDeadlines: upcomingCount,
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-gray-600 mt-2">Here's your academic progress overview</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Award className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Points</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPoints}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingCertificates}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approvedCertificates}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming Deadlines</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcomingDeadlines}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Certificates */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Certificates</h2>
                <button className="btn btn-primary flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload New
                </button>
              </div>
              
              <div className="space-y-4">
                {certificates.slice(0, 5).map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(cert.status)}
                      <div>
                        <p className="font-medium text-gray-900">{cert.title}</p>
                        <p className="text-sm text-gray-500">
                          Submitted {formatDistanceToNow(parseISO(cert.created_at))} ago
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
                      {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                    </span>
                  </div>
                ))}
                
                {certificates.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No certificates uploaded yet</p>
                    <p className="text-sm">Upload your first certificate to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Deadlines */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 3).map((event) => (
                  <div key={`${event.id}-${'start_datetime' in event ? 'event' : 'workshop'}`} 
                       className="flex items-start space-x-3">
                    <Calendar className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-500">
                        Due {formatDistanceToNow(parseISO(event.registration_deadline!))} from now
                      </p>
                    </div>
                  </div>
                ))}
                
                {upcomingEvents.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No upcoming deadlines
                  </p>
                )}
              </div>
            </div>

            {/* Recent Notifications */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h3>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex items-start space-x-3">
                    <Bell className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(parseISO(notification.created_at))} ago
                      </p>
                    </div>
                  </div>
                ))}
                
                {notifications.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No new notifications
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}