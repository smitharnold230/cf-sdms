/**
 * Enhanced notification API routes with rate limiting and monitoring
 */


import { RateLimiter, RATE_LIMITS, IDENTIFIERS } from '../middleware/rateLimiter';
import { NotificationMonitor } from '../monitoring/notificationMonitor';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  createNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  createBulkNotifications
} from '../utils/notifications';
import { authenticateRequest } from '../utils/auth';

export class NotificationAPIHandler {
  private rateLimiters: Map<string, RateLimiter>;
  private monitor: NotificationMonitor;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.monitor = new NotificationMonitor(env);
    this.rateLimiters = new Map();

    // Initialize rate limiters
    Object.entries(RATE_LIMITS).forEach(([name, config]) => {
      this.rateLimiters.set(name, new RateLimiter(env.RATE_LIMIT_KV, config));
    });
  }

  /**
   * Get user notifications with rate limiting
   */
  async getUserNotifications(request: Request): Promise<Response> {
    const startTime = Date.now();

    try {
      // Apply rate limiting
      const rateLimiter = this.rateLimiters.get('READ_NOTIFICATIONS')!;
      const rateLimit = await rateLimiter.checkLimit(IDENTIFIERS.byAuthUser(request));
      
      if (!rateLimit.success) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimit.retryAfter?.toString() || '60'
          }
        });
      }

      // Authenticate request
      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get notifications
      const notifications = await getUserNotifications(this.env, authResult.user.userId);

      // Record metrics
      await this.monitor.recordMetric({
        timestamp: Date.now(),
        userId: authResult.user.userId,
        notificationType: 'get_notifications',
        deliveryChannel: 'push',
        status: 'delivered',
        latency: Date.now() - startTime
      });

      return new Response(JSON.stringify({ notifications }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMITS.READ_NOTIFICATIONS.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString()
        }
      });

    } catch (error) {
      await this.monitor.recordMetric({
        timestamp: Date.now(),
        userId: 0,
        notificationType: 'get_notifications',
        deliveryChannel: 'push',
        status: 'failed',
        latency: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(request: Request): Promise<Response> {
    const startTime = Date.now();

    try {
      // Rate limiting
      const rateLimiter = this.rateLimiters.get('READ_NOTIFICATIONS')!;
      const rateLimit = await rateLimiter.checkLimit(IDENTIFIERS.byAuthUser(request));
      
      if (!rateLimit.success) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      // Authenticate
      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get notification ID from URL
      const url = new URL(request.url);
      const notificationId = parseInt(url.pathname.split('/').slice(-2)[0]);
      
      if (!notificationId) {
        return new Response(JSON.stringify({ error: 'Invalid notification ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mark as read
      const success = await markNotificationAsRead(this.env, notificationId, authResult.user.userId);

      // Record metrics
      await this.monitor.recordMetric({
        timestamp: Date.now(),
        userId: authResult.user.userId,
        notificationType: 'mark_as_read',
        deliveryChannel: 'push',
        status: success ? 'delivered' : 'failed',
        latency: Date.now() - startTime
      });

      return new Response(JSON.stringify({ success }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Send notification with strict rate limiting
   */
  async sendNotification(request: Request): Promise<Response> {
    const startTime = Date.now();

    try {
      // Strict rate limiting for sending notifications
      const rateLimiter = this.rateLimiters.get('SEND_NOTIFICATION')!;
      const rateLimit = await rateLimiter.checkLimit(IDENTIFIERS.byAuthUser(request));
      
      if (!rateLimit.success) {
        await this.monitor.createAlert('medium', 'Rate limit exceeded for notification sending', {
          identifier: IDENTIFIERS.byAuthUser(request),
          retryAfter: rateLimit.retryAfter
        });

        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      // Authenticate
      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse request body
      const notificationData = await request.json() as any;

      // Validate required fields
      if (!notificationData.userId || !notificationData.title || !notificationData.message) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: userId, title, message'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create notification
      const notificationId = await createNotification(this.env, {
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        priority: notificationData.priority || 'medium',
        createdBy: authResult.user.userId,
        metadata: notificationData.metadata
      });

      // Record metrics
      await this.monitor.recordMetric({
        timestamp: Date.now(),
        userId: authResult.user.userId,
        notificationType: notificationData.type || 'info',
        deliveryChannel: 'push',
        status: 'sent',
        latency: Date.now() - startTime,
        priority: notificationData.priority
      });

      return new Response(JSON.stringify({
        success: true,
        notificationId
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.monitor.recordMetric({
        timestamp: Date.now(),
        userId: 0,
        notificationType: 'send_notification',
        deliveryChannel: 'push',
        status: 'failed',
        latency: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.monitor.createAlert('high', 'Failed to send notification', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get notification preferences
   */
  async getPreferences(request: Request): Promise<Response> {
    try {
      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const preferences = await getUserNotificationPreferences(this.env, authResult.user.userId);

      return new Response(JSON.stringify({ preferences }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Update notification preferences with rate limiting
   */
  async updatePreferences(request: Request): Promise<Response> {
    try {
      // Rate limiting for preference updates
      const rateLimiter = this.rateLimiters.get('UPDATE_PREFERENCES')!;
      const rateLimit = await rateLimiter.checkLimit(IDENTIFIERS.byAuthUser(request));
      
      if (!rateLimit.success) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const preferences = await request.json();
      
      const success = await updateUserNotificationPreferences(
        this.env, 
        authResult.user.userId, 
        preferences
      );

      return new Response(JSON.stringify({ success }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get system health metrics
   */
  async getHealthMetrics(request: Request): Promise<Response> {
    try {
      const authResult = await authenticateRequest(request, this.env);
      if (!authResult.success || !authResult.user || authResult.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const health = await this.monitor.checkSystemHealth();
      const summary = await this.monitor.getMetricsSummary(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date()
      );

      return new Response(JSON.stringify({
        health,
        summary,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
