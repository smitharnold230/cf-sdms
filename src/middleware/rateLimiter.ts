/**
 * Rate Limiting Middleware for Cloudflare Workers
 * Uses Cloudflare KV for distributed rate limiting across edge locations
 */

export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  keyPrefix?: string;      // Prefix for KV keys
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private kv: KVNamespace;
  private config: RateLimitConfig;

  constructor(kv: KVNamespace, config: RateLimitConfig) {
    this.kv = kv;
    this.config = {
      keyPrefix: 'ratelimit',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get current request count
      const currentData = await this.kv.get(key, 'json') as {
        count: number;
        windowStart: number;
      } | null;

      let count = 0;
      let resetTime = now + this.config.windowMs;

      if (currentData && currentData.windowStart > windowStart) {
        // Within current window
        count = currentData.count;
        resetTime = currentData.windowStart + this.config.windowMs;
      }

      // Check if limit exceeded
      if (count >= this.config.maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }

      // Increment counter
      await this.kv.put(key, JSON.stringify({
        count: count + 1,
        windowStart: currentData && currentData.windowStart > windowStart ? currentData.windowStart : now
      }), {
        expirationTtl: Math.ceil(this.config.windowMs / 1000) + 10 // Add buffer
      });

      return {
        success: true,
        remaining: this.config.maxRequests - count - 1,
        resetTime
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      return {
        success: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }
  }

  /**
   * Create rate limiting middleware
   */
  middleware(identifier: (request: Request) => string) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
      const id = identifier(request);
      const result = await this.checkLimit(id);

      if (!result.success) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': result.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString()
          }
        });
      }

      const response = await next();

      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

      return response;
    };
  }
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Strict limits for sending notifications
  SEND_NOTIFICATION: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 10,        // 10 notifications per minute per user
    keyPrefix: 'send-notif'
  },
  
  // Moderate limits for reading notifications
  READ_NOTIFICATIONS: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 60,        // 60 reads per minute per user
    keyPrefix: 'read-notif'
  },
  
  // Lenient limits for preference updates
  UPDATE_PREFERENCES: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 5,         // 5 updates per minute per user
    keyPrefix: 'update-pref'
  },
  
  // WebSocket connection limits
  WEBSOCKET_CONNECT: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 5,         // 5 connection attempts per minute per IP
    keyPrefix: 'ws-connect'
  },

  // Global API limits
  GLOBAL_API: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 100,       // 100 requests per minute per user
    keyPrefix: 'global-api'
  }
} as const;

/**
 * Identifier extractors for different rate limiting strategies
 */
export const IDENTIFIERS = {
  // Rate limit by user ID
  byUserId: (request: Request): string => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 
                   request.headers.get('x-user-id') || 
                   'anonymous';
    return `user:${userId}`;
  },

  // Rate limit by IP address
  byIP: (request: Request): string => {
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               'unknown';
    return `ip:${ip}`;
  },

  // Rate limit by authenticated user
  byAuthUser: (request: Request): string => {
    // Extract user ID from JWT token or auth header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // In a real implementation, decode JWT to get user ID
        // For now, use a hash of the token
        const token = authHeader.slice(7);
        return `auth:${token.slice(0, 10)}`;
      } catch {
        return 'anonymous';
      }
    }
    return 'anonymous';
  },

  // Combined user + IP rate limiting
  byUserAndIP: (request: Request): string => {
    const userId = IDENTIFIERS.byUserId(request);
    const ip = IDENTIFIERS.byIP(request);
    return `${userId}:${ip}`;
  }
};
