'use client';

import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { facultyApi } from '@/lib/api';
import { BookOpen, MapPin, Clock, Users, Plus, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkshopFormData {
  title: string;
  description: string;
  workshop_date: string;
  location: string;
  duration_hours: number;
  max_participants?: number;
}

export default function WorkshopsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<WorkshopFormData>({
    title: '',
    description: '',
    workshop_date: '',
    location: '',
    duration_hours: 1,
    max_participants: undefined,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else if (user.role !== 'faculty' && user.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.workshop_date || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await facultyApi.createWorkshop(formData);
      
      toast.success('Workshop created successfully!');
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        workshop_date: '',
        location: '',
        duration_hours: 1,
        max_participants: undefined,
      });
    } catch (error) {
      console.error('Failed to create workshop:', error);
      toast.error('Failed to create workshop');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_participants' || name === 'duration_hours' 
        ? (value ? parseInt(value) : (name === 'duration_hours' ? 1 : undefined)) 
        : value
    }));
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workshops Management</h1>
            <p className="text-gray-600 mt-2">Create and manage educational workshops</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {showForm ? 'Cancel' : 'Create Workshop'}
          </button>
        </div>

        {/* Create Workshop Form */}
        {showForm && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Workshop</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Workshop Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter workshop title"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="workshop_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Workshop Date *
                  </label>
                  <input
                    type="datetime-local"
                    id="workshop_date"
                    name="workshop_date"
                    value={formData.workshop_date}
                    onChange={handleInputChange}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="input"
                  placeholder="Describe the workshop content and objectives..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Workshop location"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="duration_hours" className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Hours) *
                  </label>
                  <input
                    type="number"
                    id="duration_hours"
                    name="duration_hours"
                    value={formData.duration_hours}
                    onChange={handleInputChange}
                    className="input"
                    min="1"
                    max="24"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="max_participants" className="block text-sm font-medium text-gray-700 mb-2">
                    Max Participants
                  </label>
                  <input
                    type="number"
                    id="max_participants"
                    name="max_participants"
                    value={formData.max_participants || ''}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Optional"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Workshop'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Workshops List Placeholder */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Workshops</h2>
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workshops yet</h3>
            <p className="text-gray-500">Create your first workshop to get started.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}