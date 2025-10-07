

export interface NotificationData {
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'deadline';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: string;
  metadata?: Record<string, any>;
  createdBy?: number;
}

export interface BulkNotificationData {
  userIds: number[];
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'deadline';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: string;
  metadata?: Record<string, any>;
  createdBy?: number;
}

export interface EmailNotificationData {
  to: string;
  subject: string;
  body: string;
  templateType?: 'deadline_reminder' | 'workshop_notification' | 'certificate_update' | 'system_alert';
  templateData?: Record<string, any>;
}

// Database operations for notifications
export async function createNotification(env: Env, data: NotificationData): Promise<number> {
  const result = await env.DB.prepare(`
    INSERT INTO notifications 
    (user_id, title, message, type, priority, scheduled_for, metadata, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.userId,
    data.title,
    data.message,
    data.type,
    data.priority || 'medium',
    data.scheduledFor || null,
    data.metadata ? JSON.stringify(data.metadata) : null,
    data.createdBy || null
  ).run();

  return result.meta.last_row_id as number;
}

export async function createBulkNotifications(env: Env, data: BulkNotificationData): Promise<{ success: number; failed: number; notificationIds: number[] }> {
  const results = { success: 0, failed: 0, notificationIds: [] as number[] };

  for (const userId of data.userIds) {
    try {
      const notificationId = await createNotification(env, {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority,
        scheduledFor: data.scheduledFor,
        metadata: data.metadata,
        createdBy: data.createdBy
      });
      
      results.notificationIds.push(notificationId);
      results.success++;
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
      results.failed++;
    }
  }

  return results;
}

export async function getScheduledNotifications(env: Env, beforeTime?: string): Promise<any[]> {
  const query = beforeTime 
    ? `SELECT * FROM scheduled_notifications WHERE scheduled_for <= ? AND is_sent = FALSE ORDER BY scheduled_for ASC`
    : `SELECT * FROM scheduled_notifications WHERE scheduled_for <= datetime('now') AND is_sent = FALSE ORDER BY scheduled_for ASC`;
  
  const params = beforeTime ? [beforeTime] : [];
  const result = await env.DB.prepare(query).bind(...params).all();
  
  return result.results.map((row: any) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }));
}

export async function markScheduledNotificationSent(env: Env, scheduledId: number): Promise<void> {
  await env.DB.prepare(`
    UPDATE scheduled_notifications 
    SET is_sent = TRUE, sent_at = datetime('now')
    WHERE id = ?
  `).bind(scheduledId).run();
}

export async function getUserNotificationPreferences(env: Env, userId: number): Promise<any> {
  const result = await env.DB.prepare(`
    SELECT * FROM user_notification_preferences WHERE user_id = ?
  `).bind(userId).first();

  if (!result) {
    // Return default preferences
    return {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      deadlineReminders: true,
      workshopUpdates: true,
      systemAlerts: true,
      reminderHours: [24, 72]
    };
  }

  return {
    userId,
    emailNotifications: Boolean(result.email_notifications),
    pushNotifications: Boolean(result.push_notifications),
    deadlineReminders: Boolean(result.deadline_reminders),
    workshopUpdates: Boolean(result.workshop_updates),
    systemAlerts: Boolean(result.system_alerts),
    reminderHours: JSON.parse(result.reminder_hours as string)
  };
}

export async function logNotificationDelivery(
  env: Env, 
  notificationId: number, 
  method: 'websocket' | 'email' | 'push',
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced',
  deliveryAddress?: string,
  errorMessage?: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO notification_delivery_log 
    (notification_id, delivery_method, delivery_status, delivery_address, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    notificationId,
    method,
    status,
    deliveryAddress || null,
    errorMessage || null
  ).run();
}

// Email notification templates
export function generateEmailTemplate(templateType: string, data: Record<string, any>): { subject: string; body: string } {
  switch (templateType) {
    case 'deadline_reminder':
      return {
        subject: `Deadline Reminder: ${data.title}`,
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e74c3c;">⏰ Deadline Reminder</h2>
                <p>Hello ${data.userName || 'there'},</p>
                <p>This is a friendly reminder that you have an upcoming deadline:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${data.title}</h3>
                  <p style="margin: 0;"><strong>Deadline:</strong> ${data.deadline}</p>
                  <p style="margin: 5px 0 0 0;"><strong>Time Remaining:</strong> ${data.timeRemaining}</p>
                </div>
                
                <p>${data.message}</p>
                
                <div style="margin: 30px 0;">
                  <a href="${data.actionUrl || '#'}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Take Action
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
                  This is an automated notification from the Student Development Management System.
                  You can manage your notification preferences in your account settings.
                </p>
              </div>
            </body>
          </html>
        `
      };

    case 'workshop_notification':
      return {
        subject: `Workshop Update: ${data.title}`,
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #27ae60;">🎓 Workshop Notification</h2>
                <p>Hello ${data.userName || 'there'},</p>
                <p>We have an update regarding the following workshop:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${data.title}</h3>
                  <p style="margin: 0;"><strong>Date:</strong> ${data.date}</p>
                  <p style="margin: 5px 0 0 0;"><strong>Location:</strong> ${data.location}</p>
                </div>
                
                <p>${data.message}</p>
                
                <div style="margin: 30px 0;">
                  <a href="${data.actionUrl || '#'}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Workshop
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
                  This is an automated notification from the Student Development Management System.
                  You can manage your notification preferences in your account settings.
                </p>
              </div>
            </body>
          </html>
        `
      };

    case 'certificate_update':
      return {
        subject: `Certificate Update: ${data.title}`,
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #8e44ad;">📜 Certificate Update</h2>
                <p>Hello ${data.userName || 'there'},</p>
                <p>There has been an update to your certificate submission:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${data.title}</h3>
                  <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${data.statusColor || '#333'};">${data.status}</span></p>
                  ${data.points ? `<p style="margin: 5px 0 0 0;"><strong>Points:</strong> ${data.points}</p>` : ''}
                </div>
                
                <p>${data.message}</p>
                
                <div style="margin: 30px 0;">
                  <a href="${data.actionUrl || '#'}" style="background-color: #8e44ad; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Certificate
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
                  This is an automated notification from the Student Development Management System.
                  You can manage your notification preferences in your account settings.
                </p>
              </div>
            </body>
          </html>
        `
      };

    case 'system_alert':
      return {
        subject: `System Alert: ${data.title}`,
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e67e22;">🔔 System Alert</h2>
                <p>Hello ${data.userName || 'there'},</p>
                
                <div style="background-color: ${data.alertColor || '#fff3cd'}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${data.borderColor || '#ffc107'};">
                  <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${data.title}</h3>
                  <p style="margin: 0;">${data.message}</p>
                </div>
                
                ${data.actionUrl ? `
                <div style="margin: 30px 0;">
                  <a href="${data.actionUrl}" style="background-color: #e67e22; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Details
                  </a>
                </div>
                ` : ''}
                
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
                  This is an automated notification from the Student Development Management System.
                  You can manage your notification preferences in your account settings.
                </p>
              </div>
            </body>
          </html>
        `
      };

    default:
      return {
        subject: data.title || 'Notification',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>${data.title || 'Notification'}</h2>
                <p>Hello ${data.userName || 'there'},</p>
                <p>${data.message}</p>
                
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
                  This is an automated notification from the Student Development Management System.
                </p>
              </div>
            </body>
          </html>
        `
      };
  }
}

import { ResilientService } from './resilience';

// Real email notification implementation using SendGrid with retry logic
export async function sendEmailNotification(env: Env, emailData: EmailNotificationData): Promise<boolean> {
  // Check if email is enabled and API key is available
  if (!env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, skipping email notification');
    return false;
  }

  try {
    const resilientService = new ResilientService(env);
    
    const emailPayload = {
      personalizations: [{
        to: [{ email: emailData.to }],
        subject: emailData.subject
      }],
      from: {
        email: env.SENDGRID_FROM_EMAIL || 'noreply@sdms.workers.dev',
        name: env.SENDGRID_FROM_NAME || 'Student Development Management System'
      },
      content: [{
        type: 'text/html',
        value: emailData.body
      }]
    };

    const success = await resilientService.sendEmail(emailPayload);
    if (success) {
      console.log(`Email sent successfully to ${emailData.to}`);
    }
    return success;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Calculate time remaining until deadline
export function calculateTimeRemaining(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Deadline has passed';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

// Additional notification management functions

export async function getUserNotifications(env: Env, userId: number, limit = 50): Promise<any[]> {
  const result = await env.DB.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).bind(userId, limit).all();

  return result.results;
}

export async function markNotificationAsRead(env: Env, notificationId: number, userId: number): Promise<boolean> {
  try {
    const result = await env.DB.prepare(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).bind(notificationId, userId).run();

    return result.meta.changes > 0;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

export async function markAllNotificationsAsRead(env: Env, userId: number): Promise<boolean> {
  try {
    const result = await env.DB.prepare(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND is_read = false
    `).bind(userId).run();

    return result.success;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
}

export async function updateUserNotificationPreferences(
  env: Env, 
  userId: number, 
  preferences: any
): Promise<boolean> {
  try {
    // Check if preferences exist
    const existing = await env.DB.prepare(`
      SELECT id FROM user_notification_preferences WHERE user_id = ?
    `).bind(userId).first();

    if (existing) {
      // Update existing preferences
      const result = await env.DB.prepare(`
        UPDATE user_notification_preferences 
        SET email_enabled = ?, push_enabled = ?, sms_enabled = ?,
            quiet_hours_start = ?, quiet_hours_end = ?,
            categories = ?, priority_filters = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(
        preferences.email_enabled,
        preferences.push_enabled,
        preferences.sms_enabled,
        preferences.quiet_hours_start,
        preferences.quiet_hours_end,
        preferences.categories,
        preferences.priority_filters,
        userId
      ).run();

      return result.success;
    } else {
      // Create new preferences
      const result = await env.DB.prepare(`
        INSERT INTO user_notification_preferences 
        (user_id, email_enabled, push_enabled, sms_enabled, 
         quiet_hours_start, quiet_hours_end, categories, priority_filters)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        preferences.email_enabled,
        preferences.push_enabled,
        preferences.sms_enabled,
        preferences.quiet_hours_start,
        preferences.quiet_hours_end,
        preferences.categories,
        preferences.priority_filters
      ).run();

      return result.success;
    }
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return false;
  }
}
