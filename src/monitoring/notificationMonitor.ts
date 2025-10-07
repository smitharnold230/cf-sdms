/**
 * Monitoring and Analytics for Notification System
 * Tracks delivery rates, performance metrics, and error rates
 */



export interface NotificationMetric {
  timestamp: number;
  userId: number;
  notificationType: string;
  deliveryChannel: 'email' | 'sms' | 'push' | 'websocket';
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'read';
  latency?: number;        // Time to deliver in ms
  errorCode?: string;      // Error code if failed
  errorMessage?: string;   // Error details
  priority?: string;       // Notification priority
  campaignId?: number;     // Associated campaign
}

export interface MetricsSummary {
  totalNotifications: number;
  deliveryRate: number;
  averageLatency: number;
  errorRate: number;
  channelBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  hourlyVolume: Record<string, number>;
}

export class NotificationMonitor {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Record a notification metric
   */
  async recordMetric(metric: NotificationMetric): Promise<void> {
    try {
      // Store in D1 for detailed analytics
      await this.env.DB.prepare(`
        INSERT INTO notification_delivery_tracking 
        (notification_id, delivery_channel, delivery_status, delivered_at, failure_reason, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        metric.userId, // Using userId as notification_id for now
        metric.deliveryChannel,
        metric.status,
        new Date(metric.timestamp).toISOString(),
        metric.errorMessage || null,
        metric.latency || null
      ).run();

      // Send to Cloudflare Analytics (if available)
      if (this.env.ANALYTICS_TOKEN) {
        await this.sendToAnalytics(metric);
      }

      // Log critical errors
      if (metric.status === 'failed') {
        console.error('Notification delivery failed:', {
          userId: metric.userId,
          type: metric.notificationType,
          channel: metric.deliveryChannel,
          error: metric.errorMessage
        });
      }

    } catch (error) {
      console.error('Failed to record notification metric:', error);
    }
  }

  /**
   * Get metrics summary for dashboard
   */
  async getMetricsSummary(
    startDate: Date, 
    endDate: Date, 
    userId?: number
  ): Promise<MetricsSummary> {
    try {
      const userFilter = userId ? 'AND notification_id = ?' : '';
      const params = [
        startDate.toISOString(),
        endDate.toISOString()
      ];
      if (userId) params.push(userId.toString());

      // Get basic stats
      const statsQuery = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_notifications,
          AVG(CASE WHEN delivery_status = 'delivered' THEN 1.0 ELSE 0.0 END) as delivery_rate,
          AVG(latency_ms) as avg_latency,
          AVG(CASE WHEN delivery_status = 'failed' THEN 1.0 ELSE 0.0 END) as error_rate
        FROM notification_delivery_tracking 
        WHERE delivered_at BETWEEN ? AND ? ${userFilter}
      `).bind(...params).first();

      // Get channel breakdown
      const channelQuery = await this.env.DB.prepare(`
        SELECT delivery_channel, COUNT(*) as count
        FROM notification_delivery_tracking 
        WHERE delivered_at BETWEEN ? AND ? ${userFilter}
        GROUP BY delivery_channel
      `).bind(...params).all();

      // Get hourly volume
      const hourlyQuery = await this.env.DB.prepare(`
        SELECT 
          strftime('%H', delivered_at) as hour,
          COUNT(*) as count
        FROM notification_delivery_tracking 
        WHERE delivered_at BETWEEN ? AND ? ${userFilter}
        GROUP BY strftime('%H', delivered_at)
        ORDER BY hour
      `).bind(...params).all();

      const channelBreakdown: Record<string, number> = {};
      channelQuery.results.forEach((row: any) => {
        channelBreakdown[row.delivery_channel] = row.count;
      });

      const hourlyVolume: Record<string, number> = {};
      hourlyQuery.results.forEach((row: any) => {
        hourlyVolume[row.hour] = row.count;
      });

      return {
        totalNotifications: (statsQuery as any)?.total_notifications || 0,
        deliveryRate: (statsQuery as any)?.delivery_rate || 0,
        averageLatency: (statsQuery as any)?.avg_latency || 0,
        errorRate: (statsQuery as any)?.error_rate || 0,
        channelBreakdown,
        typeBreakdown: {}, // Would need notification type in tracking table
        hourlyVolume
      };

    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      return {
        totalNotifications: 0,
        deliveryRate: 0,
        averageLatency: 0,
        errorRate: 0,
        channelBreakdown: {},
        typeBreakdown: {},
        hourlyVolume: {}
      };
    }
  }

  /**
   * Check system health and alert on issues
   */
  async checkSystemHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      const recentMetrics = await this.getMetricsSummary(oneHourAgo, now);

      // Check delivery rate
      if (recentMetrics.deliveryRate < 0.95) {
        issues.push(`Low delivery rate: ${(recentMetrics.deliveryRate * 100).toFixed(1)}%`);
      }

      // Check error rate
      if (recentMetrics.errorRate > 0.1) {
        issues.push(`High error rate: ${(recentMetrics.errorRate * 100).toFixed(1)}%`);
      }

      // Check average latency
      if (recentMetrics.averageLatency > 5000) {
        issues.push(`High latency: ${recentMetrics.averageLatency.toFixed(0)}ms`);
      }

      // Check if no notifications sent recently (might indicate system issue)
      if (recentMetrics.totalNotifications === 0) {
        issues.push('No notifications sent in the last hour');
      }

      return {
        healthy: issues.length === 0,
        issues,
        metrics: recentMetrics
      };

    } catch (error) {
      return {
        healthy: false,
        issues: ['Failed to check system health'],
        metrics: null
      };
    }
  }

  /**
   * Send metrics to external analytics service
   */
  private async sendToAnalytics(metric: NotificationMetric): Promise<void> {
    try {
      // Example: Send to Cloudflare Analytics or other service
      const analyticsData = {
        timestamp: metric.timestamp,
        event: 'notification_sent',
        properties: {
          user_id: metric.userId,
          type: metric.notificationType,
          channel: metric.deliveryChannel,
          status: metric.status,
          latency: metric.latency,
          priority: metric.priority
        }
      };

      // In a real implementation, you would send this to your analytics service
      console.log('Analytics data:', analyticsData);

    } catch (error) {
      console.error('Failed to send analytics:', error);
    }
  }

  /**
   * Create alert for critical issues
   */
  async createAlert(severity: 'low' | 'medium' | 'high' | 'critical', message: string, details?: any): Promise<void> {
    try {
      console.log(`[${severity.toUpperCase()}] ${message}`, details);

      // For critical alerts, you might want to:
      // 1. Send to PagerDuty/Slack
      // 2. Create incident ticket
      // 3. Send SMS to on-call engineer

      if (severity === 'critical') {
        // Example: Send to webhook
        if (this.env.ALERT_WEBHOOK_URL) {
          await fetch(this.env.ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              severity,
              message,
              details,
              timestamp: new Date().toISOString(),
              service: 'notification-system'
            })
          });
        }
      }

    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }
}

/**
 * Middleware for automatic metric collection
 */
export function metricsMiddleware(monitor: NotificationMonitor) {
  return async (request: Request, response: Response, startTime: number) => {
    const endTime = Date.now();
    const latency = endTime - startTime;

    // Extract metrics from request/response
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id');
    const endpoint = url.pathname;

    if (userId && endpoint.includes('/notifications/')) {
      await monitor.recordMetric({
        timestamp: endTime,
        userId: parseInt(userId),
        notificationType: 'api_call',
        deliveryChannel: 'push', // API calls are push notifications to frontend
        status: response.status < 400 ? 'delivered' : 'failed',
        latency,
        errorCode: response.status >= 400 ? response.status.toString() : undefined
      });
    }
  };
}

/**
 * Performance tracking decorator
 */
export function trackPerformance<T extends any[], R>(
  monitor: NotificationMonitor,
  operationName: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const endTime = Date.now();

        await monitor.recordMetric({
          timestamp: endTime,
          userId: 0, // System operation
          notificationType: operationName,
          deliveryChannel: 'websocket',
          status: 'delivered',
          latency: endTime - startTime
        });

        return result;
      } catch (error) {
        const endTime = Date.now();
        
        await monitor.recordMetric({
          timestamp: endTime,
          userId: 0,
          notificationType: operationName,
          deliveryChannel: 'websocket',
          status: 'failed',
          latency: endTime - startTime,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        throw error;
      }
    };

    return descriptor;
  };
}
