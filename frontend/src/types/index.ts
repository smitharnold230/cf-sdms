// Type definitions matching backend schema
export interface User {
  id: number;
  email: string;
  role: 'admin' | 'faculty' | 'student';
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser extends User {
  token?: string;
}

export interface Certificate {
  id: number;
  user_id: number;
  object_key: string;
  title: string;
  issued_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id?: number;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  category?: string;
  start_datetime: string;
  end_datetime: string;
  registration_deadline?: string;
  location?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Workshop {
  id: number;
  event_id?: number;
  title: string;
  description?: string;
  presenter?: string;
  capacity?: number;
  start_datetime: string;
  end_datetime: string;
  registration_deadline?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: number;
  user_id: number;
  event_id?: number;
  workshop_id?: number;
  registered_at: string;
}

export interface PointsEntry {
  id: number;
  user_id: number;
  source_type: 'certificate' | 'event' | 'workshop' | 'manual';
  source_id?: number;
  points: number;
  reason?: string;
  created_at: string;
}

export interface UserPoints {
  user_id: number;
  total_points: number;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'system' | 'event' | 'workshop' | 'certificate' | 'points' | 'success' | 'error' | 'warning' | 'deadline' | 'info';
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  related_type?: string;
  related_id?: number;
  is_read: boolean;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'student' | 'faculty' | 'admin';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UploadCertificateData {
  user_id: number;
  title: string;
  issued_date: string;
  file: File;
}