import axios, { AxiosResponse } from 'axios';
import { 
  User, 
  Certificate, 
  Event, 
  Workshop, 
  Notification, 
  PointsEntry,
  LoginRequest, 
  LoginResponse, 
  RegisterRequest,
  UploadCertificateData
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-db-ms.smitharnold230.workers.dev';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<{ user: User }> => {
    const response = await api.post<{ user: User }>('/auth/register', data);
    return response.data;
  },
};

// Users API
export const usersApi = {
  getUsers: async (): Promise<{ users: User[] }> => {
    const response = await api.get<{ users: User[] }>('/users');
    return response.data;
  },

  getUser: async (id: number): Promise<{ user: User }> => {
    const response = await api.get<{ user: User }>(`/users/${id}`);
    return response.data;
  },

  updateUser: async (id: number, data: Partial<User>): Promise<{ user: User }> => {
    const response = await api.put<{ user: User }>(`/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: number): Promise<{ deleted: boolean }> => {
    const response = await api.delete<{ deleted: boolean }>(`/users/${id}`);
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getStudentDashboard: async (): Promise<any> => {
    const response = await api.get('/api/student/dashboard');
    return response.data;
  },

  getFacultyDashboard: async (): Promise<any> => {
    const response = await api.get('/api/faculty/dashboard');
    return response.data;
  },

  getDashboard: async (): Promise<any> => {
    const response = await api.get('/api/dashboard');
    return response.data;
  },
};

// Faculty API
export const facultyApi = {
  getStudents: async (): Promise<{ success: boolean; students: User[]; count: number }> => {
    const response = await api.get('/api/faculty/students');
    return response.data;
  },

  getStudentDetails: async (studentId: number): Promise<any> => {
    const response = await api.get(`/api/faculty/students/${studentId}`);
    return response.data;
  },

  getPendingCertificates: async (): Promise<any> => {
    const response = await api.get('/api/faculty/pending');
    return response.data;
  },

  createEvent: async (eventData: any): Promise<any> => {
    const response = await api.post('/api/faculty/events', eventData);
    return response.data;
  },

  createWorkshop: async (workshopData: any): Promise<any> => {
    const response = await api.post('/api/faculty/workshops', workshopData);
    return response.data;
  },

  approveCertificate: async (certificateId: number): Promise<any> => {
    const response = await api.put(`/api/faculty/approve/${certificateId}`);
    return response.data;
  },

  rejectCertificate: async (certificateId: number, reason?: string): Promise<any> => {
    const response = await api.put(`/api/faculty/reject/${certificateId}`, { reason });
    return response.data;
  },

  getEvents: async (): Promise<any> => {
    const response = await api.get('/api/events');
    return response.data;
  },

  getWorkshops: async (): Promise<any> => {
    const response = await api.get('/api/workshops');
    return response.data;
  },
};

// Certificates API
export const certificatesApi = {
  uploadCertificate: async (data: UploadCertificateData): Promise<{ certificate: Certificate }> => {
    const formData = new FormData();
    formData.append('file', data.file);
    
    const response = await api.post<{ certificate: Certificate }>(
      `/certificates/upload?user_id=${data.user_id}&title=${encodeURIComponent(data.title)}&issued_date=${data.issued_date}`,
      formData,
      {
        headers: {
          'Content-Type': 'application/pdf',
        },
      }
    );
    return response.data;
  },

  getUserCertificates: async (userId: number): Promise<{ certificates: Certificate[] }> => {
    const response = await api.get<{ certificates: Certificate[] }>(`/users/${userId}/certificates`);
    return response.data;
  },

  downloadCertificate: async (id: number): Promise<Blob> => {
    const response = await api.get(`/certificates/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteCertificate: async (id: number): Promise<{ deleted: boolean }> => {
    const response = await api.delete<{ deleted: boolean }>(`/certificates/${id}`);
    return response.data;
  },

  reviewCertificate: async (id: number, status: 'approved' | 'rejected', reason?: string): Promise<{ certificate: Certificate }> => {
    const response = await api.put<{ certificate: Certificate }>(`/certificates/${id}/review`, {
      status,
      rejection_reason: reason,
    });
    return response.data;
  },
};

// Real APIs integrated with backend
export const eventsApi = {
  getEvents: async (): Promise<{ events: Event[] }> => {
    const response = await api.get<Event[]>('/api/events');
    return { events: response.data };
  },

  createEvent: async (data: Partial<Event>): Promise<{ event: Event }> => {
    const response = await api.post<{ eventId: number }>('/api/faculty/events', data);
    return { event: { ...data, id: response.data.eventId } as Event };
  },
};

export const workshopsApi = {
  getWorkshops: async (): Promise<{ workshops: Workshop[] }> => {
    // Get workshops from a separate endpoint if available, otherwise return empty array
    try {
      const response = await api.get<Workshop[]>('/api/workshops');
      return { workshops: response.data };
    } catch (error) {
      // If workshops endpoint doesn't exist, return empty array
      return { workshops: [] };
    }
  },

  createWorkshop: async (eventId: number, data: Partial<Workshop>): Promise<{ workshop: Workshop }> => {
    const response = await api.post<{ workshopId: number }>(`/api/faculty/workshops?eventId=${eventId}`, data);
    return { workshop: { ...data, id: response.data.workshopId, event_id: eventId } as Workshop };
  },
};

export const pointsApi = {
  getUserPoints: async (userId: number): Promise<{ total_points: number; entries: PointsEntry[] }> => {
    const response = await api.get<{ data: { totalPoints: number; pointsHistory: PointsEntry[] } }>(`/api/analytics/user?userId=${userId}`);
    return { 
      total_points: response.data.data.totalPoints,
      entries: response.data.data.pointsHistory 
    };
  },

  addPoints: async (userId: number, points: number, reason: string): Promise<{ entry: PointsEntry }> => {
    const response = await api.post<{ entry: PointsEntry }>('/api/admin/award-points', {
      userId,
      points,
      reason
    });
    return response.data;
  },
};

export const notificationsApi = {
  getNotifications: async (userId: number): Promise<{ notifications: Notification[] }> => {
    const response = await api.get<{ notifications: Notification[] }>(`/api/notifications/${userId}`);
    return response.data;
  },

  markAsRead: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.put<{ success: boolean }>(`/api/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (userId: number): Promise<{ success: boolean }> => {
    const response = await api.put<{ success: boolean }>(`/api/notifications/${userId}/read-all`);
    return response.data;
  },

  getPreferences: async (userId: number): Promise<{ preferences: any }> => {
    const response = await api.get<{ preferences: any }>(`/api/notifications/${userId}/preferences`);
    return response.data;
  },

  updatePreferences: async (userId: number, preferences: any): Promise<{ success: boolean }> => {
    const response = await api.put<{ success: boolean }>(`/api/notifications/${userId}/preferences`, preferences);
    return response.data;
  },
};

export default api;