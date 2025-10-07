import { z } from 'zod';
import { readJson } from '../../utils/validation';
import { json, badRequest, notFound, forbidden } from '../../utils/errors';
import { authenticate, requireRole, AuthContext } from '../../middleware/auth';


// Validation schemas
const CreateNotificationSchema = z.object({
  userId: z.number().optional(),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  type: z.enum(['info', 'warning', 'success', 'error', 'deadline']),
  related_type: z.string().optional(),
  related_id: z.number().optional()
});

const UpdatePreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  deadlineReminders: z.boolean().default(true),
  workshopUpdates: z.boolean().default(true),
  systemAlerts: z.boolean().default(true),
  reminderHours: z.array(z.number().min(1).max(168)).default([24, 72]) // hours before deadline
});

// Get user notifications with pagination
export async function getUserNotifications(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const type = url.searchParams.get('type');
  
  const offset = (page - 1) * limit;
  const userId = auth.userId;

  try {
    let query = `
      SELECT 
        id, title, message, type, related_type, related_id, is_read, created_at
      FROM notifications 
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (unreadOnly) {
      query += ` AND is_read = 0`;
    }

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const notifications = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM notifications 
      WHERE user_id = ?
    `;
    const countParams: any[] = [userId];

    if (unreadOnly) {
      countQuery += ` AND is_read = 0`;
    }

    if (type) {
      countQuery += ` AND type = ?`;
      countParams.push(type);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total as number || 0;

    return json({
      success: true,
      notifications: notifications.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Get notifications error:', error);
    return json({ success: false, error: 'Failed to retrieve notifications' }, 500);
  }
}

// Mark notification as read
export async function markNotificationRead(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const url = new URL(request.url);
  const notificationId = parseInt(url.pathname.split('/').pop() || '0');
  const userId = auth.userId;

  try {
    const result = await env.DB.prepare(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(notificationId, userId).run();

    if (!result.success) {
      return notFound('Notification not found');
    }

    return json({ success: true, message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    return json({ success: false, error: 'Failed to update notification' }, 500);
  }
}

// Mark all notifications as read
export async function markAllNotificationsRead(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const userId = auth.userId;

  try {
    const result = await env.DB.prepare(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = datetime('now')
      WHERE user_id = ? AND is_read = FALSE
    `).bind(userId).run();

    return json({ 
      success: true, 
      message: 'All notifications marked as read',
      updatedCount: result.meta.changes || 0
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return json({ success: false, error: 'Failed to update notifications' }, 500);
  }
}

// Delete notification
export async function deleteNotification(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const url = new URL(request.url);
  const notificationId = parseInt(url.pathname.split('/').pop() || '0');
  const userId = auth.userId;

  try {
    const result = await env.DB.prepare(`
      UPDATE notifications 
      SET is_deleted = TRUE, deleted_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(notificationId, userId).run();

    if (!result.success) {
      return notFound('Notification not found');
    }

    return json({ success: true, message: 'Notification deleted' });

  } catch (error) {
    console.error('Delete notification error:', error);
    return json({ success: false, error: 'Failed to delete notification' }, 500);
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const userId = auth.userId;

  try {
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ? AND is_read = FALSE AND is_deleted = FALSE
    `).bind(userId).first();

    return json({
      success: true,
      unreadCount: result?.count as number || 0
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    return json({ success: false, error: 'Failed to get unread count' }, 500);
  }
}

// Create individual notification (faculty/admin only)
export async function createNotification(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  requireRole(auth, ['faculty', 'admin']);
  
  const body = await readJson(request, CreateNotificationSchema);

  try {
    // Simple direct database insert for now
    const result = await env.DB.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.userId || auth.userId,
      body.type,
      body.title,
      body.message,
      body.related_type || null,
      body.related_id || null
    ).run();

    if (!result.success) {
      return json({ success: false, error: 'Failed to create notification' }, 500);
    }

    return json({
      success: true,
      message: 'Notification created successfully',
      notificationId: result.meta.last_row_id
    });

  } catch (error: any) {
    console.error('Create notification error:', error);
    return json({ success: false, error: 'Failed to create notification' }, 500);
  }
}

// Create individual notification with auth context (faculty/admin only)
export async function createNotificationWithAuth(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  requireRole(authContext, ['faculty', 'admin']);
  
  const body = await readJson(request, CreateNotificationSchema);

  try {
    // Simple direct database insert for now
    const result = await env.DB.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.userId || authContext.userId,
      body.type,
      body.title,
      body.message,
      body.related_type || null,
      body.related_id || null
    ).run();

    if (!result.success) {
      return json({ success: false, error: 'Failed to create notification' }, 500);
    }

    return json({
      success: true,
      message: 'Notification created successfully',
      notificationId: result.meta.last_row_id
    });

  } catch (error: any) {
    console.error('Create notification error:', error);
    return json({ success: false, error: 'Failed to create notification' }, 500);
  }
}

// Get user notification preferences
export async function getNotificationPreferences(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const userId = auth.userId;

  try {
    const preferences = await env.DB.prepare(`
      SELECT * FROM user_notification_preferences WHERE user_id = ?
    `).bind(userId).first();

    if (!preferences) {
      // Return default preferences
      return json({
        success: true,
        preferences: {
          emailNotifications: true,
          pushNotifications: true,
          deadlineReminders: true,
          workshopUpdates: true,
          systemAlerts: true,
          reminderHours: [24, 72]
        }
      });
    }

    return json({
      success: true,
      preferences: {
        emailNotifications: Boolean(preferences.email_notifications),
        pushNotifications: Boolean(preferences.push_notifications),
        deadlineReminders: Boolean(preferences.deadline_reminders),
        workshopUpdates: Boolean(preferences.workshop_updates),
        systemAlerts: Boolean(preferences.system_alerts),
        reminderHours: JSON.parse(preferences.reminder_hours as string)
      }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return json({ success: false, error: 'Failed to get notification preferences' }, 500);
  }
}

// Update user notification preferences
export async function updateNotificationPreferences(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const body = await readJson(request, UpdatePreferencesSchema);
  const userId = auth.userId;

  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO user_notification_preferences 
      (user_id, email_notifications, push_notifications, deadline_reminders, 
       workshop_updates, system_alerts, reminder_hours, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      userId,
      body.emailNotifications,
      body.pushNotifications,
      body.deadlineReminders,
      body.workshopUpdates,
      body.systemAlerts,
      JSON.stringify(body.reminderHours)
    ).run();

    return json({
      success: true,
      message: 'Notification preferences updated',
      preferences: body
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    return json({ success: false, error: 'Failed to update notification preferences' }, 500);
  }
}

// WebSocket connection endpoint for real-time notifications
export async function connectWebSocket(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  const userId = auth.userId;

  try {
    // Get the NotificationManager Durable Object
    const id = env.NOTIFICATION_MANAGER.idFromName('global');
    const notificationManager = env.NOTIFICATION_MANAGER.get(id);

    // Forward the WebSocket upgrade request to the Durable Object
    const headers: Record<string, string> = {};
    
    // Manually iterate over headers since entries() might not be available
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const wsRequest = new Request(request.url.replace('/api/notifications/ws', '/ws'), {
      method: 'GET',
      headers: {
        ...headers,
        'X-User-ID': userId.toString(),
        'X-User-Role': auth.role
      }
    });

    return await notificationManager.fetch(wsRequest);

  } catch (error) {
    console.error('WebSocket connection error:', error);
    return new Response('WebSocket connection failed', { status: 500 });
  }
}
