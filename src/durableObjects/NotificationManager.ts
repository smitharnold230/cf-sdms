

// Durable Object types (Cloudflare Workers specific)
interface DurableObjectState {
  storage: DurableObjectStorage;
  id: DurableObjectId;
  waitUntil(promise: Promise<any>): void;
}

interface DurableObjectStorage {
  get(key: string): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: any): Promise<Map<string, any>>;
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

// WebSocket constants
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CONNECTING = 0;
const WS_READY_STATE_CLOSING = 2;
const WS_READY_STATE_CLOSED = 3;

export interface NotificationMessage {
  id: string;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  readAt?: string;
  deliveredAt?: string;
  channels: NotificationChannel[];
}

export type NotificationType = 
  | 'certificate_submitted'
  | 'certificate_approved' 
  | 'certificate_rejected'
  | 'deadline_reminder'
  | 'workshop_created'
  | 'system_announcement'
  | 'points_awarded'
  | 'file_virus_detected'
  | 'bulk_message';

export type NotificationChannel = 'websocket' | 'email' | 'database';

interface WebSocketConnection {
  userId: number;
  connectionId: string;
  socket: any; // WebSocket type from Cloudflare Workers
  connectedAt: string;
  lastActivity: string;
  userAgent?: string;
  ipAddress?: string;
}

interface ScheduledNotification {
  id: string;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  scheduledFor: string;
  recurring?: {
    interval: 'daily' | 'weekly' | 'monthly';
    endDate?: string;
  };
  channels: NotificationChannel[];
}

export class NotificationManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<number, Set<string>> = new Map();
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private notificationQueue: NotificationMessage[] = [];
  private env: Env;
  private storage: DurableObjectStorage;

  constructor(private state: DurableObjectState, env: Env) {
    this.env = env;
    this.storage = state.storage;
    
    // Initialize from storage
    this.initializeFromStorage();
    
    // Set up periodic cleanup and processing
    this.setupPeriodicTasks();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // WebSocket upgrade for real-time notifications
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request);
      }

      // HTTP API endpoints
      switch (path) {
        case '/connect':
          return this.handleConnect(request);
        case '/send':
          return this.handleSendNotification(request);
        case '/schedule':
          return this.handleScheduleNotification(request);
        case '/bulk':
          return this.handleBulkNotification(request);
        case '/status':
          return this.handleStatus(request);
        case '/cleanup':
          return this.handleCleanup(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('NotificationManager error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      // Load scheduled notifications
      const scheduledData = await this.storage.get('scheduledNotifications');
      if (scheduledData) {
        this.scheduledNotifications = new Map(scheduledData as any);
      }

      // Load pending notifications
      const queueData = await this.storage.get('notificationQueue');
      if (queueData) {
        this.notificationQueue = queueData as NotificationMessage[];
      }

      console.log(`Initialized with ${this.scheduledNotifications.size} scheduled notifications and ${this.notificationQueue.length} queued notifications`);
    } catch (error) {
      console.error('Failed to initialize from storage:', error);
    }
  }

  private setupPeriodicTasks(): void {
    // Process scheduled notifications every minute
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60000);

    // Process notification queue every 10 seconds
    setInterval(() => {
      this.processNotificationQueue();
    }, 10000);

    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);

    // Persist state every 30 seconds
    setInterval(() => {
      this.persistState();
    }, 30000);
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const token = url.searchParams.get('token');

    if (!userId || !token) {
      return new Response('Missing userId or token', { status: 400 });
    }

    // Verify JWT token
    try {
      const { verifyJWT } = await import('../utils/jwt');
      const { payload } = await verifyJWT(token, this.env);
      
      if (!payload || payload.sub !== userId) {
        return new Response('Invalid token', { status: 401 });
      }
    } catch (error) {
      return new Response('Token verification failed', { status: 401 });
    }

    // Upgrade to WebSocket
    const { 0: client, 1: server } = new (globalThis as any).WebSocketPair();

    const connectionId = this.generateConnectionId();
    const connection: WebSocketConnection = {
      userId,
      connectionId,
      socket: server,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent') || undefined,
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined
    };

    // Store connection
    this.connections.set(connectionId, connection);
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Set up WebSocket handlers
    server.accept();
    this.setupWebSocketHandlers(connection);

    // Send any pending notifications for this user
    await this.sendPendingNotifications(userId);

    console.log(`WebSocket connected for user ${userId}, connection ${connectionId}`);

    return new Response(null, {
      status: 101,
      // @ts-ignore - Cloudflare Workers WebSocket response
      webSocket: client,
    });
  }

  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    connection.socket.addEventListener('message', async (event: any) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(connection, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    connection.socket.addEventListener('close', () => {
      this.removeConnection(connection.connectionId);
    });

    connection.socket.addEventListener('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.removeConnection(connection.connectionId);
    });
  }

  private async handleWebSocketMessage(connection: WebSocketConnection, data: any): Promise<void> {
    connection.lastActivity = new Date().toISOString();

    switch (data.type) {
      case 'ping':
        connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      
      case 'mark_read':
        if (data.notificationId) {
          await this.markNotificationAsRead(connection.userId, data.notificationId);
        }
        break;
      
      case 'get_notifications':
        await this.sendUserNotifications(connection.userId, connection.socket);
        break;
      
      case 'subscribe':
        // Handle subscription to specific notification types
        if (data.types && Array.isArray(data.types)) {
          // Store subscription preferences (could be extended)
          console.log(`User ${connection.userId} subscribed to:`, data.types);
        }
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private async handleSendNotification(request: Request): Promise<Response> {
    try {
      const notification: Omit<NotificationMessage, 'id' | 'createdAt'> = await request.json();
      
      const fullNotification: NotificationMessage = {
        ...notification,
        id: this.generateNotificationId(),
        createdAt: new Date().toISOString()
      };

      await this.sendNotification(fullNotification);
      
      return new Response(JSON.stringify({ 
        success: true, 
        notificationId: fullNotification.id 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Send notification error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to send notification' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleScheduleNotification(request: Request): Promise<Response> {
    try {
      const scheduledNotification: Omit<ScheduledNotification, 'id'> = await request.json();
      
      const notification: ScheduledNotification = {
        ...scheduledNotification,
        id: this.generateNotificationId()
      };

      this.scheduledNotifications.set(notification.id, notification);
      await this.persistState();

      return new Response(JSON.stringify({ 
        success: true, 
        scheduledId: notification.id 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Schedule notification error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to schedule notification' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleBulkNotification(request: Request): Promise<Response> {
    try {
      const { userIds, notification }: { 
        userIds: number[], 
        notification: Omit<NotificationMessage, 'id' | 'userId' | 'createdAt'> 
      } = await request.json();

      const results = [];
      
      for (const userId of userIds) {
        const fullNotification: NotificationMessage = {
          ...notification,
          id: this.generateNotificationId(),
          userId,
          createdAt: new Date().toISOString()
        };
        
        try {
          await this.sendNotification(fullNotification);
          results.push({ userId, success: true });
        } catch (error) {
          results.push({ userId, success: false, error: (error as Error).message });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        results 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Bulk notification error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to send bulk notifications' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleStatus(request: Request): Promise<Response> {
    const status = {
      activeConnections: this.connections.size,
      connectedUsers: this.userConnections.size,
      scheduledNotifications: this.scheduledNotifications.size,
      queuedNotifications: this.notificationQueue.length,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleCleanup(request: Request): Promise<Response> {
    const cleaned = await this.cleanupInactiveConnections();
    
    return new Response(JSON.stringify({ 
      success: true, 
      cleanedConnections: cleaned 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async sendNotification(notification: NotificationMessage): Promise<void> {
    // Send via WebSocket if user is connected
    if (notification.channels.includes('websocket')) {
      await this.sendWebSocketNotification(notification);
    }

    // Store in database if specified
    if (notification.channels.includes('database')) {
      await this.storeNotificationInDatabase(notification);
    }

    // Send email if specified
    if (notification.channels.includes('email')) {
      await this.sendEmailNotification(notification);
    }

    // Mark as delivered
    notification.deliveredAt = new Date().toISOString();
  }

  private async sendWebSocketNotification(notification: NotificationMessage): Promise<void> {
    const userConnections = this.userConnections.get(notification.userId);
    
    if (!userConnections || userConnections.size === 0) {
      // User not connected, queue for later
      this.notificationQueue.push(notification);
      return;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    // Send to all active connections for this user
    for (const connectionId of userConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(message);
          console.log(`Sent notification ${notification.id} to user ${notification.userId}`);
        } catch (error) {
          console.error(`Failed to send notification to connection ${connectionId}:`, error);
          this.removeConnection(connectionId);
        }
      }
    }
  }

  private async storeNotificationInDatabase(notification: NotificationMessage): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO notifications (
          id, user_id, type, title, message, data, priority, 
          created_at, delivered_at, read_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        notification.id,
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        JSON.stringify(notification.data || {}),
        notification.priority,
        notification.createdAt,
        notification.deliveredAt || null,
        false
      ).run();
    } catch (error) {
      console.error('Failed to store notification in database:', error);
    }
  }

  private async sendEmailNotification(notification: NotificationMessage): Promise<void> {
    // This would integrate with an email service like SendGrid, Mailgun, or Cloudflare Email Workers
    // For now, we'll simulate the email sending
    console.log(`Would send email notification to user ${notification.userId}: ${notification.title}`);
    
    // In a real implementation:
    // 1. Get user's email address from database
    // 2. Check user's email notification preferences
    // 3. Format email using template
    // 4. Send via email service
    // 5. Log delivery status
  }

  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const toProcess: ScheduledNotification[] = [];

    for (const [id, scheduled] of this.scheduledNotifications) {
      if (new Date(scheduled.scheduledFor) <= now) {
        toProcess.push(scheduled);
      }
    }

    for (const scheduled of toProcess) {
      try {
        const notification: NotificationMessage = {
          id: this.generateNotificationId(),
          userId: scheduled.userId,
          type: scheduled.type,
          title: scheduled.title,
          message: scheduled.message,
          data: scheduled.data,
          priority: 'normal',
          createdAt: new Date().toISOString(),
          channels: scheduled.channels
        };

        await this.sendNotification(notification);

        // Handle recurring notifications
        if (scheduled.recurring) {
          const nextDate = this.calculateNextRecurrence(scheduled);
          if (nextDate) {
            scheduled.scheduledFor = nextDate.toISOString();
          } else {
            this.scheduledNotifications.delete(scheduled.id);
          }
        } else {
          this.scheduledNotifications.delete(scheduled.id);
        }
      } catch (error) {
        console.error(`Failed to process scheduled notification ${scheduled.id}:`, error);
      }
    }

    if (toProcess.length > 0) {
      await this.persistState();
    }
  }

  private async processNotificationQueue(): Promise<void> {
    const processedIndices: number[] = [];

    for (let i = 0; i < this.notificationQueue.length; i++) {
      const notification = this.notificationQueue[i];
      const userConnections = this.userConnections.get(notification.userId);

      if (userConnections && userConnections.size > 0) {
        try {
          await this.sendWebSocketNotification(notification);
          processedIndices.push(i);
        } catch (error) {
          console.error(`Failed to send queued notification ${notification.id}:`, error);
        }
      }
    }

    // Remove processed notifications from queue (in reverse order to maintain indices)
    for (let i = processedIndices.length - 1; i >= 0; i--) {
      this.notificationQueue.splice(processedIndices[i], 1);
    }
  }

  private async cleanupInactiveConnections(): Promise<number> {
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const toRemove: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const lastActivity = new Date(connection.lastActivity);
      const inactive = now.getTime() - lastActivity.getTime() > inactiveThreshold;
      const socketClosed = connection.socket.readyState !== WebSocket.OPEN;

      if (inactive || socketClosed) {
        toRemove.push(connectionId);
      }
    }

    toRemove.forEach(connectionId => this.removeConnection(connectionId));
    
    return toRemove.length;
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
      
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close();
      }
      
      this.connections.delete(connectionId);
      console.log(`Removed connection ${connectionId} for user ${connection.userId}`);
    }
  }

  private async persistState(): Promise<void> {
    try {
      await this.storage.put('scheduledNotifications', Array.from(this.scheduledNotifications.entries()));
      await this.storage.put('notificationQueue', this.notificationQueue);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateNextRecurrence(scheduled: ScheduledNotification): Date | null {
    if (!scheduled.recurring) return null;

    const current = new Date(scheduled.scheduledFor);
    let next: Date;

    switch (scheduled.recurring.interval) {
      case 'daily':
        next = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        next = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        return null;
    }

    if (scheduled.recurring.endDate && next > new Date(scheduled.recurring.endDate)) {
      return null;
    }

    return next;
  }

  private async sendPendingNotifications(userId: number): Promise<void> {
    const pendingNotifications = this.notificationQueue.filter(n => n.userId === userId);
    
    for (const notification of pendingNotifications) {
      await this.sendWebSocketNotification(notification);
    }
  }

  private async sendUserNotifications(userId: number, socket: WebSocket): Promise<void> {
    try {
      // Get recent notifications from database
      const notifications = await this.env.DB.prepare(`
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `).bind(userId).all();

      socket.send(JSON.stringify({
        type: 'notifications_list',
        data: notifications.results
      }));
    } catch (error) {
      console.error('Failed to send user notifications:', error);
    }
  }

  private async markNotificationAsRead(userId: number, notificationId: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE notifications 
        SET read_status = true, read_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(notificationId, userId).run();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  private async handleConnect(request: Request): Promise<Response> {
    // Handle connection status endpoint
    return new Response(JSON.stringify({ status: 'ready' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
