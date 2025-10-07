
import { 
  getScheduledNotifications, 
  markScheduledNotificationSent, 
  createNotification,
  getUserNotificationPreferences,
  generateEmailTemplate,
  sendEmailNotification,
  logNotificationDelivery,
  calculateTimeRemaining
} from '../utils/notifications';

export interface DeadlineSchedulerOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class DeadlineScheduler {
  private env: Env;
  private options: DeadlineSchedulerOptions;

  constructor(env: Env, options: DeadlineSchedulerOptions = {}) {
    this.env = env;
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 5000,
      ...options
    };
  }

  // Process all scheduled notifications that are due
  async processScheduledNotifications(): Promise<{ processed: number; failed: number; errors: string[] }> {
    const results = { processed: 0, failed: 0, errors: [] as string[] };

    try {
      // Get all scheduled notifications that are due
      const scheduledNotifications = await getScheduledNotifications(this.env);
      
      console.log(`Found ${scheduledNotifications.length} scheduled notifications to process`);

      // Process in batches
      const batches = this.chunkArray(scheduledNotifications, this.options.batchSize!);

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(async (notification) => {
            try {
              await this.processScheduledNotification(notification);
              results.processed++;
            } catch (error) {
              const errorMessage = `Failed to process notification ${notification.id}: ${error}`;
              console.error(errorMessage);
              results.errors.push(errorMessage);
              results.failed++;
            }
          })
        );
      }

      return results;
    } catch (error) {
      const errorMessage = `Failed to process scheduled notifications: ${error}`;
      console.error(errorMessage);
      results.errors.push(errorMessage);
      return results;
    }
  }

  // Process a single scheduled notification
  private async processScheduledNotification(scheduledNotification: any): Promise<void> {
    const {
      id: scheduledId,
      user_id: userId,
      related_type: relatedType,
      related_id: relatedId,
      notification_type: notificationType,
      title,
      message,
      metadata
    } = scheduledNotification;

    // Get user preferences
    const userPreferences = await getUserNotificationPreferences(this.env, userId);
    
    // Check if user wants this type of notification
    if (!this.shouldSendNotification(notificationType, userPreferences)) {
      console.log(`User ${userId} has disabled ${notificationType} notifications`);
      await markScheduledNotificationSent(this.env, scheduledId);
      return;
    }

    // Get user details for personalization
    const user = await this.env.DB.prepare(`
      SELECT id, email, full_name FROM users WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get related item details for context
    const relatedItemDetails = await this.getRelatedItemDetails(relatedType, relatedId);

    // Create the notification in the database
    const enhancedMetadata = {
      ...metadata,
      relatedType,
      relatedId,
      scheduledId,
      userEmail: user.email,
      userName: user.full_name
    };

    const notificationId = await createNotification(this.env, {
      userId,
      title,
      message,
      type: this.getNotificationTypeFromScheduledType(notificationType),
      priority: 'medium',
      metadata: enhancedMetadata
    });

    // Send real-time notification via WebSocket if user is connected
    await this.sendRealtimeNotification(userId, {
      id: notificationId,
      title,
      message,
      type: this.getNotificationTypeFromScheduledType(notificationType),
      metadata: enhancedMetadata
    });

    // Send email notification if enabled
    if (userPreferences.emailNotifications) {
      await this.sendEmailNotification(user, {
        title,
        message,
        notificationType,
        relatedItemDetails,
        metadata: enhancedMetadata,
        notificationId
      });
    }

    // Mark scheduled notification as sent
    await markScheduledNotificationSent(this.env, scheduledId);
    
    console.log(`Processed scheduled notification ${scheduledId} for user ${userId}`);
  }

  // Send real-time notification via WebSocket
  private async sendRealtimeNotification(userId: number, notification: any): Promise<void> {
    try {
      // Get the NotificationManager Durable Object
      const id = this.env.NOTIFICATION_MANAGER.idFromName('global');
      const notificationManager = this.env.NOTIFICATION_MANAGER.get(id);

      // Send notification to connected users
      await notificationManager.fetch(new Request('https://dummy/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          notification
        })
      }));

      await logNotificationDelivery(this.env, notification.id, 'websocket', 'sent');
    } catch (error) {
      console.error(`Failed to send real-time notification:`, error);
      await logNotificationDelivery(this.env, notification.id, 'websocket', 'failed', undefined, String(error));
    }
  }

  // Send email notification
  private async sendEmailNotification(user: any, notificationData: any): Promise<void> {
    try {
      const { title, message, notificationType, relatedItemDetails, metadata, notificationId } = notificationData;

      // Determine email template type
      let templateType = 'system_alert';
      if (notificationType.includes('deadline')) {
        templateType = 'deadline_reminder';
      } else if (notificationType.includes('workshop')) {
        templateType = 'workshop_notification';
      } else if (notificationType.includes('certificate')) {
        templateType = 'certificate_update';
      }

      // Prepare template data
      const templateData = {
        userName: user.full_name,
        title,
        message,
        ...relatedItemDetails,
        ...metadata
      };

      // Add time remaining for deadline reminders
      if (templateType === 'deadline_reminder' && metadata.deadline) {
        templateData.timeRemaining = calculateTimeRemaining(metadata.deadline);
      }

      // Generate email content
      const emailContent = generateEmailTemplate(templateType, templateData);

      // Send email
      const emailSent = await sendEmailNotification(this.env, {
        to: user.email,
        subject: emailContent.subject,
        body: emailContent.body,
        templateType: templateType as 'deadline_reminder' | 'workshop_notification' | 'certificate_update' | 'system_alert',
        templateData
      });

      const status = emailSent ? 'sent' : 'failed';
      await logNotificationDelivery(this.env, notificationId, 'email', status, user.email);

    } catch (error) {
      console.error(`Failed to send email notification to ${user.email}:`, error);
      await logNotificationDelivery(this.env, notificationData.notificationId, 'email', 'failed', user.email, String(error));
    }
  }

  // Get details of related items (certificates, workshops, events)
  private async getRelatedItemDetails(relatedType: string, relatedId: number): Promise<any> {
    try {
      switch (relatedType) {
        case 'certificate':
          const certificate = await this.env.DB.prepare(`
            SELECT id, title, submission_deadline, status 
            FROM certificate_submissions 
            WHERE id = ?
          `).bind(relatedId).first();
          
          return {
            deadline: certificate?.submission_deadline,
            status: certificate?.status,
            actionUrl: `${this.getBaseUrl()}/certificates/${relatedId}`
          };

        case 'workshop':
          const workshop = await this.env.DB.prepare(`
            SELECT id, title, start_date, location, registration_deadline 
            FROM workshops 
            WHERE id = ?
          `).bind(relatedId).first();
          
          return {
            date: workshop?.start_date,
            location: workshop?.location,
            deadline: workshop?.registration_deadline,
            actionUrl: `${this.getBaseUrl()}/workshops/${relatedId}`
          };

        case 'event':
          const event = await this.env.DB.prepare(`
            SELECT id, title, event_date, location 
            FROM events 
            WHERE id = ?
          `).bind(relatedId).first();
          
          return {
            date: event?.event_date,
            location: event?.location,
            actionUrl: `${this.getBaseUrl()}/events/${relatedId}`
          };

        default:
          return {};
      }
    } catch (error) {
      console.error(`Failed to get details for ${relatedType} ${relatedId}:`, error);
      return {};
    }
  }

  // Check if notification should be sent based on user preferences
  private shouldSendNotification(notificationType: string, preferences: any): boolean {
    switch (notificationType) {
      case 'deadline_reminder':
        return preferences.deadlineReminders;
      case 'workshop_reminder':
        return preferences.workshopUpdates;
      case 'event_reminder':
        return preferences.systemAlerts;
      default:
        return true;
    }
  }

  // Convert scheduled notification type to notification type
  private getNotificationTypeFromScheduledType(scheduledType: string): 'info' | 'warning' | 'success' | 'error' | 'deadline' {
    if (scheduledType.includes('deadline')) {
      return 'deadline';
    } else if (scheduledType.includes('workshop')) {
      return 'info';
    } else if (scheduledType.includes('event')) {
      return 'info';
    }
    return 'info';
  }

  // Get base URL for action links
  private getBaseUrl(): string {
    // In a real implementation, this would be configurable
    return 'https://sdms.example.com';
  }

  // Utility function to chunk array into batches
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Schedule deadline reminders for a certificate
  async scheduleDeadlineReminders(certificateId: number, userId: number, deadline: string, title: string): Promise<void> {
    const userPreferences = await getUserNotificationPreferences(this.env, userId);
    
    if (!userPreferences.deadlineReminders) {
      return; // User has disabled deadline reminders
    }

    const deadlineDate = new Date(deadline);
    const now = new Date();

    for (const hoursBeforeDeadline of userPreferences.reminderHours) {
      const reminderTime = new Date(deadlineDate.getTime() - (hoursBeforeDeadline * 60 * 60 * 1000));
      
      // Only schedule if reminder time is in the future
      if (reminderTime > now) {
        await this.env.DB.prepare(`
          INSERT INTO scheduled_notifications 
          (user_id, related_type, related_id, notification_type, title, message, scheduled_for, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          'certificate',
          certificateId,
          'deadline_reminder',
          'Certificate Submission Deadline Reminder',
          `Your certificate submission "${title}" is due in ${hoursBeforeDeadline} hours. Please submit before the deadline.`,
          reminderTime.toISOString(),
          JSON.stringify({
            hours_before: hoursBeforeDeadline,
            certificate_id: certificateId,
            deadline: deadline
          })
        ).run();
      }
    }
  }

  // Schedule workshop reminders for all eligible users
  async scheduleWorkshopReminders(workshopId: number, deadline: string, title: string): Promise<void> {
    // Get all users who want workshop updates
    const users = await this.env.DB.prepare(`
      SELECT u.id, unp.reminder_hours
      FROM users u
      JOIN user_notification_preferences unp ON u.id = unp.user_id
      WHERE u.is_active = TRUE AND unp.workshop_updates = TRUE
    `).all();

    const deadlineDate = new Date(deadline);
    const now = new Date();

    for (const userRow of users.results) {
      const user = userRow as any;
      const reminderHours = JSON.parse(user.reminder_hours);

      for (const hoursBeforeDeadline of reminderHours) {
        const reminderTime = new Date(deadlineDate.getTime() - (hoursBeforeDeadline * 60 * 60 * 1000));
        
        // Only schedule if reminder time is in the future
        if (reminderTime > now) {
          await this.env.DB.prepare(`
            INSERT INTO scheduled_notifications 
            (user_id, related_type, related_id, notification_type, title, message, scheduled_for, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            user.id,
            'workshop',
            workshopId,
            'workshop_reminder',
            'Workshop Registration Deadline Reminder',
            `Registration for workshop "${title}" closes in ${hoursBeforeDeadline} hours. Register now to secure your spot.`,
            reminderTime.toISOString(),
            JSON.stringify({
              hours_before: hoursBeforeDeadline,
              workshop_id: workshopId,
              deadline: deadline
            })
          ).run();
        }
      }
    }
  }
}
