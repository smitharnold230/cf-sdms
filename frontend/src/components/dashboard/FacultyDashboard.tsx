'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi, facultyApi } from '@/lib/api';
import { User } from '@/types';
import { 
  Users, 
  FileCheck, 
  Calendar,
  BookOpen,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FacultyDashboardStats {
  pendingReviews: number;
  totalStudents: number;
  eventsCreated: number;
  workshopsCreated: number;
}

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FacultyDashboardStats>({
    pendingReviews: 0,
    totalStudents: 0,
    eventsCreated: 0,
    workshopsCreated: 0,
  });
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStudents, setShowStudents] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await dashboardApi.getFacultyDashboard();
      
      if (response.success) {
        setStats({
          pendingReviews: response.data.pendingReviews || 0,
          totalStudents: response.data.totalStudents || 0,
          eventsCreated: response.data.eventsCreated || 0,
          workshopsCreated: response.data.workshopsCreated || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch faculty dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await facultyApi.getStudents();
      if (response.success) {
        setStudents(response.students);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
      toast.error('Failed to load students');
    }
  };

  const handleViewStudents = () => {
    if (!showStudents && students.length === 0) {
      fetchStudents();
    }
    setShowStudents(!showStudents);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.full_name}!
        </h1>
        <p className="text-gray-600">Here's your faculty dashboard overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Reviews */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileCheck className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Reviews</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingReviews}</p>
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
              </div>
            </div>
            <button
              onClick={handleViewStudents}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showStudents ? 'Hide' : 'View List'}
            </button>
          </div>
        </div>

        {/* Events Created */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Events Created</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.eventsCreated}</p>
            </div>
          </div>
        </div>

        {/* Workshops Created */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BookOpen className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Workshops Created</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.workshopsCreated}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Student List */}
      {showStudents && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Students List</h2>
          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(student.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-700 mr-3">
                          View Details
                        </button>
                        <button className="text-green-600 hover:text-green-700">
                          View Certificates
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No students found</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <FileCheck className="h-5 w-5 text-orange-600 mr-3" />
            <span className="text-sm font-medium">Review Certificates</span>
          </button>
          <button className="flex items-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-sm font-medium">Create Event</span>
          </button>
          <button className="flex items-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <BookOpen className="h-5 w-5 text-purple-600 mr-3" />
            <span className="text-sm font-medium">Create Workshop</span>
          </button>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h2>
        <div className="text-center text-gray-500 py-8">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No upcoming deadlines</p>
        </div>
      </div>
    </div>
  );
}