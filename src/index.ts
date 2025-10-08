import { Router } from 'itty-router';
import { errorResponse, json, notFound } from './utils/errors';
import * as AuthRoutes from './routes/auth';
import * as UserRoutes from './routes/users';
import * as CertRoutes from './routes/certificates';
import { authenticate, requireRole } from './middleware/auth';
import { addCORSHeaders } from './utils/production';

// Import new API route handlers
import * as AuthAPI from './routes/api/auth';
import * as DashboardAPI from './routes/api/dashboard';
import * as EventsAPI from './routes/api/events';
import * as ApprovalAPI from './routes/api/approval';
import * as AnalyticsAPI from './routes/api/analytics';
import * as FilesAPI from './routes/api/files';
import * as NotificationsAPI from './routes/api/notifications';

const router = Router();

router.get('/', () => json({ service: 'Student DB Management System', status: 'ok', version: '2.0.0', deployment: 'production' }));

// API Status endpoint
router.get('/api/status', async (req: Request, env: Env) => {
  try {
    // Test database connection
    const dbTest = await env.DB.prepare('SELECT 1 as test').first();
    
    return json({
      status: 'healthy',
      services: {
        database: dbTest ? 'connected' : 'disconnected',
        kv: env.RATE_LIMIT_KV ? 'available' : 'unavailable',
        cache: env.CACHE_KV ? 'available' : 'unavailable',
        durable_objects: env.NOTIFICATION_MANAGER ? 'available' : 'unavailable'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Auth
router.post('/auth/register', (req: Request, env: Env) => AuthRoutes.register(req, env));
router.post('/auth/login', (req: Request, env: Env) => AuthRoutes.login(req, env));

// Users (admin-only for list/create/delete; self for own detail)
router.get('/users', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['admin']);
  return UserRoutes.list(env);
});

router.get('/users/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  const id = Number(req.params.id);
  if (ctx.userId !== id) requireRole(ctx, ['admin']);
  return UserRoutes.detail(env, id);
});

router.put('/users/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  const id = Number(req.params.id);
  if (ctx.userId !== id) requireRole(ctx, ['admin']);
  return UserRoutes.update(env, id, req);
});

router.delete('/users/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['admin']);
  const id = Number(req.params.id);
  return UserRoutes.remove(env, id);
});

// Certificates
router.post('/certificates/upload', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  // Admin or faculty can upload for any student; student only for themselves (user_id query)
  const url = new URL(req.url);
  const userId = Number(url.searchParams.get('user_id'));
  if (ctx.role === 'student' && ctx.userId !== userId) requireRole(ctx, ['admin']);
  return CertRoutes.upload(env, req);
});

router.get('/users/:id/certificates', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  const id = Number(req.params.id);
  if (ctx.userId !== id) requireRole(ctx, ['admin','faculty']);
  return CertRoutes.list(env, id);
});

router.get('/certificates/:id/download', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  const id = Number(req.params.id);
  // Ensure user has rights: if not admin/faculty must own the cert
  // (Simplified: we fetch cert inside handler; adapt by making certificate fetch here for RBAC if needed)
  return CertRoutes.download(env, id, ctx.userId, ctx.role);
});

router.delete('/certificates/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['admin','faculty']);
  const id = Number(req.params.id);
  return CertRoutes.remove(env, id);
});

// New API endpoints
router.post('/api/auth/login', (req: Request, env: Env) => AuthAPI.login(req, env));

router.get('/api/student/dashboard', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['student']);
  return DashboardAPI.getStudentDashboard(req, env, ctx);
});

// Faculty Dashboard
router.get('/api/faculty/dashboard', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return DashboardAPI.getFacultyDashboard(req, env, ctx);
});

// General Dashboard (role-agnostic)
router.get('/api/dashboard', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  if (ctx.role === 'student') {
    return DashboardAPI.getStudentDashboard(req, env, ctx);
  } else if (ctx.role === 'faculty') {
    return DashboardAPI.getFacultyDashboard(req, env, ctx);
  } else if (ctx.role === 'admin') {
    return DashboardAPI.getFacultyDashboard(req, env, ctx);
  }
  return json({ error: 'Invalid role' }, 400);
});

// Faculty Student Management
router.get('/api/faculty/students', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, email, full_name, created_at, updated_at
      FROM users 
      WHERE role = 'student'
      ORDER BY full_name
    `).all();
    
    return json({
      success: true,
      students: results || [],
      count: results?.length || 0
    });
  } catch (error: any) {
    return json({ error: 'Failed to fetch students', details: error.message }, 500);
  }
});

// Faculty - Get Student Details with Certificates
router.get('/api/faculty/students/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  const studentId = Number(req.params.id);
  
  try {
    // Get student info
    const student = await env.DB.prepare(`
      SELECT id, email, full_name, created_at, updated_at
      FROM users 
      WHERE id = ? AND role = 'student'
    `).bind(studentId).first();
    
    if (!student) {
      return json({ error: 'Student not found' }, 404);
    }
    
    // Get student certificates
    const { results: certificates } = await env.DB.prepare(`
      SELECT id, title, issued_date, status, created_at, reviewed_at, rejection_reason
      FROM certificates 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(studentId).all();
    
    // Get student points
    const points = await env.DB.prepare(`
      SELECT total_points
      FROM user_points
      WHERE user_id = ?
    `).bind(studentId).first();
    
    return json({
      success: true,
      student,
      certificates: certificates || [],
      totalPoints: points?.total_points || 0
    });
  } catch (error: any) {
    return json({ error: 'Failed to fetch student details', details: error.message }, 500);
  }
});

router.post('/api/faculty/events', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return EventsAPI.createEvent(req, env, ctx);
});

router.post('/api/faculty/workshops', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return EventsAPI.createWorkshop(req, env, ctx);
});

router.get('/api/events', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  return EventsAPI.getEvents(req, env);
});

router.put('/api/faculty/approve/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return ApprovalAPI.approveCertificate(req, env, ctx);
});

router.put('/api/faculty/reject/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return ApprovalAPI.rejectCertificate(req, env, ctx);
});

router.get('/api/faculty/pending', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['faculty', 'admin']);
  return ApprovalAPI.getPendingCertificates(req, env);
});

router.get('/api/admin/analytics', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['admin']);
  return AnalyticsAPI.getSystemAnalytics(req, env, ctx);
});

router.get('/api/analytics/user', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  return AnalyticsAPI.getUserAnalytics(req, env, ctx);
});

// Secure File Upload System
router.post('/api/files/upload/certificate', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['student', 'faculty', 'admin']);
  return FilesAPI.uploadCertificate(req, env, ctx);
});

router.post('/api/files/upload/profile', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  return FilesAPI.uploadProfilePhoto(req, env, ctx);
});

router.get('/api/files/:id/download-url', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  return FilesAPI.getSecureDownloadUrl(req, env, ctx);
});

router.get('/api/files/:id/download', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  return FilesAPI.downloadFile(req, env, ctx);
});

router.get('/api/files/list', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  return FilesAPI.getUserFileList(req, env, ctx);
});

router.delete('/api/files/:id', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  return FilesAPI.deleteFile(req, env, ctx);
});

router.put('/api/files/:id/virus-scan', async (req: any, env: Env) => {
  const ctx = await authenticate(req, env);
  requireRole(ctx, ['admin']);
  return FilesAPI.updateFileVirusScanStatus(req, env, ctx);
});

// Notification System API
router.get('/api/notifications', (req: Request, env: Env) => NotificationsAPI.getUserNotifications(req, env));

router.get('/api/notifications/unread-count', (req: Request, env: Env) => NotificationsAPI.getUnreadNotificationCount(req, env));

router.patch('/api/notifications/:id/read', (req: Request, env: Env) => NotificationsAPI.markNotificationRead(req, env));

router.patch('/api/notifications/read-all', (req: Request, env: Env) => NotificationsAPI.markAllNotificationsRead(req, env));

router.delete('/api/notifications/:id', (req: Request, env: Env) => NotificationsAPI.deleteNotification(req, env));

router.post('/api/notifications', async (req: Request, env: Env) => {
  const ctx = await authenticate(req, env);
  return NotificationsAPI.createNotificationWithAuth(req, env, ctx);
});

router.get('/api/notifications/preferences', (req: Request, env: Env) => NotificationsAPI.getNotificationPreferences(req, env));

router.put('/api/notifications/preferences', (req: Request, env: Env) => NotificationsAPI.updateNotificationPreferences(req, env));

router.get('/api/notifications/ws', (req: Request, env: Env) => NotificationsAPI.connectWebSocket(req, env));

// Monitoring and health check routes
router.get('/monitoring/health', async (req: Request, env: Env, ctx: ExecutionContext) => {
  const { ResilientService, HealthChecker } = await import('./utils/resilience');
  const resilientService = new ResilientService(env);
  const healthChecker = new HealthChecker(resilientService);
  const health = await healthChecker.checkHealth();
  return new Response(JSON.stringify(health, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/monitoring/metrics', async (req: Request, env: Env, ctx: ExecutionContext) => {
  const { ResilientService } = await import('./utils/resilience');
  const { PerformanceMonitor, CacheManager } = await import('./utils/performance');
  
  const resilientService = new ResilientService(env);
  const performanceMonitor = new PerformanceMonitor();
  const cacheManager = new CacheManager(env);
  
  const metrics = {
    performance: performanceMonitor.getMetrics(),
    cache: cacheManager.getStats(),
    services: resilientService.getServiceMetrics(),
    system: {
      uptime: Date.now(),
      timestamp: new Date().toISOString()
    }
  };
  
  return new Response(JSON.stringify(metrics, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.all('*', () => notFound());

// Handle CORS preflight requests
router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400'
    }
  });
});

// Export Durable Objects
export { NotificationManager } from './durableObjects/NotificationManager';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
            'Access-Control-Max-Age': '86400'
          }
        });
      }

      // itty router passes env as second arg
      const response = await router.handle(request, env);
      
      // Add CORS headers to all responses
      return addCORSHeaders(response, request.headers.get('Origin') || undefined);
    } catch (err) {
      const errorResp = errorResponse(err);
      return addCORSHeaders(errorResp, request.headers.get('Origin') || undefined);
    }
  }
};
