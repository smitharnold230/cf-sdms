/**
 * Production Error Handling and Logging Utilities
 */

import { smartErrorResponse, generateJsonError } from './errorPages';

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: number;
  metadata?: Record<string, any>;
}

export class ProductionErrorHandler {
  private env: Env;
  private requestId: string;

  constructor(env: Env, requestId?: string) {
    this.env = env;
    this.requestId = requestId || this.generateRequestId();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(
    error: string,
    message: string,
    details?: Record<string, any>,
    statusCode: number = 500
  ): Response {
    const errorResponse: ErrorResponse = {
      error,
      message,
      details: this.env.ENVIRONMENT === 'production' ? undefined : details,
      timestamp: new Date().toISOString(),
      requestId: this.requestId
    };

    // Log error
    this.logError(error, message, details);

    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': this.requestId
      }
    });
  }

  /**
   * Handle and log errors consistently
   */
  async handleError(error: unknown, context: string): Promise<Response> {
    let errorMessage = 'An unexpected error occurred';
    let errorCode = 'INTERNAL_ERROR';
    let statusCode = 500;
    let details: Record<string, any> | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      details = { stack: error.stack };

      // Categorize common errors
      if (error.message.includes('database')) {
        errorCode = 'DATABASE_ERROR';
        errorMessage = 'Database operation failed';
      } else if (error.message.includes('unauthorized')) {
        errorCode = 'UNAUTHORIZED';
        statusCode = 401;
        errorMessage = 'Authentication required';
      } else if (error.message.includes('forbidden')) {
        errorCode = 'FORBIDDEN';
        statusCode = 403;
        errorMessage = 'Access denied';
      } else if (error.message.includes('not found')) {
        errorCode = 'NOT_FOUND';
        statusCode = 404;
        errorMessage = 'Resource not found';
      } else if (error.message.includes('validation')) {
        errorCode = 'VALIDATION_ERROR';
        statusCode = 400;
        errorMessage = 'Invalid input data';
      }
    }

    // Send alert for critical errors
    if (statusCode >= 500) {
      await this.sendAlert('high', `${errorCode}: ${errorMessage}`, {
        context,
        error: error instanceof Error ? error.stack : String(error),
        requestId: this.requestId
      });
    }

    return this.createErrorResponse(errorCode, errorMessage, details, statusCode);
  }

  /**
   * Log messages with structured format
   */
  log(level: LogEntry['level'], message: string, metadata?: Record<string, any>, userId?: number): void {
    // Only log based on configured level
    const logLevel = this.env.LOG_LEVEL || 'info';
    const levels = ['debug', 'info', 'warn', 'error'];
    
    if (levels.indexOf(level) < levels.indexOf(logLevel)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      userId,
      metadata: this.env.ENVIRONMENT === 'production' ? undefined : metadata
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log error messages
   */
  logError(error: string, message: string, details?: Record<string, any>): void {
    this.log('error', message, { error, details });
  }

  /**
   * Send alerts for critical issues
   */
  async sendAlert(severity: 'low' | 'medium' | 'high', message: string, details?: Record<string, any>): Promise<void> {
    if (!this.env.ALERT_WEBHOOK_URL) {
      return;
    }

    try {
      const alertPayload = {
        severity,
        message,
        details,
        timestamp: new Date().toISOString(),
        service: 'SDMS',
        environment: this.env.ENVIRONMENT,
        requestId: this.requestId
      };

      await fetch(this.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }
}

/**
 * Middleware for request logging and error handling
 */
export function withErrorHandling(handler: (request: Request, env: Env, ctx: any) => Promise<Response>) {
  return async (request: Request, env: Env, ctx: any): Promise<Response> => {
    const requestId = request.headers.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errorHandler = new ProductionErrorHandler(env, requestId);
    
    // Log request
    errorHandler.log('info', `${request.method} ${new URL(request.url).pathname}`, {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP')
    });

    try {
      const response = await handler(request, env, { ...ctx, requestId, errorHandler });
      
      // Log response
      errorHandler.log('info', `Response ${response.status}`, {
        status: response.status,
        contentType: response.headers.get('Content-Type')
      });

      // Add request ID to response headers
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      return errorHandler.handleError(error, `${request.method} ${new URL(request.url).pathname}`);
    }
  };
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS for HTTPS
  if (new URL(response.url || '').protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * CORS middleware with production settings
 */
export function addCORSHeaders(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);
  
  // In production, be more restrictive with CORS
  const allowedOrigins = [
    'https://sdms.workers.dev',
    'https://your-frontend-domain.com'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Input validation helpers
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting helpers
 */
export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number = 100,
  windowMs: number = 900000 // 15 minutes
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  if (!env.RATE_LIMIT_ENABLED || env.RATE_LIMIT_ENABLED !== 'true') {
    return { allowed: true, remaining: limit, resetTime: Date.now() + windowMs };
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const rateLimitKey = `rate_limit:${key}:${windowStart}`;

    const current = await env.RATE_LIMIT_KV.get(rateLimitKey);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + windowMs
      };
    }

    // Increment counter
    await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), {
      expirationTtl: Math.ceil(windowMs / 1000)
    });

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetTime: windowStart + windowMs
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open on errors
    return { allowed: true, remaining: limit, resetTime: Date.now() + windowMs };
  }
}