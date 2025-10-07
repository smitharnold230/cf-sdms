/**
 * Enhanced Error Handling with Retry Logic and Circuit Breaker
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Circuit Breaker implementation for external service calls
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.options.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    ...options
  };

  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );

      // Add jitter to prevent thundering herd
      if (config.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms:`, (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Enhanced service wrapper with circuit breaker and retry logic
 */
export class ResilientService {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private env: Env) {}

  private getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 10000  // 10 seconds
      }));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Send email with retry and circuit breaker
   */
  async sendEmail(emailData: any): Promise<boolean> {
    const circuitBreaker = this.getCircuitBreaker('sendgrid');

    return await withRetry(async () => {
      return await circuitBreaker.execute(async () => {
        if (!this.env.SENDGRID_API_KEY) {
          throw new Error('SendGrid API key not configured');
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
        }

        return true;
      });
    }, { maxAttempts: 3, baseDelay: 1000 });
  }

  /**
   * Scan file with retry and circuit breaker
   */
  async scanFile(fileBuffer: ArrayBuffer, fileName: string): Promise<any> {
    const circuitBreaker = this.getCircuitBreaker('virustotal');

    return await withRetry(async () => {
      return await circuitBreaker.execute(async () => {
        if (!this.env.VIRUS_SCAN_API_KEY) {
          throw new Error('VirusTotal API key not configured');
        }

        const formData = new FormData();
        formData.append('file', new Blob([fileBuffer]), fileName);

        const response = await fetch('https://www.virustotal.com/api/v3/files', {
          method: 'POST',
          headers: {
            'x-apikey': this.env.VIRUS_SCAN_API_KEY
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`VirusTotal API error: ${response.status}`);
        }

        return await response.json();
      });
    }, { maxAttempts: 2, baseDelay: 2000 });
  }

  /**
   * Database operation with retry
   */
  async executeQuery<T>(query: string, params: any[] = []): Promise<T> {
    return await withRetry(async () => {
      try {
        const stmt = this.env.DB.prepare(query);
        const result = await stmt.bind(...params).run();
        
        if (!result.success) {
          throw new Error(`Database query failed: ${result.error || 'Unknown error'}`);
        }
        
        return result as T;
      } catch (error) {
        console.error('Database query error:', { query, params, error });
        throw error;
      }
    }, { maxAttempts: 3, baseDelay: 500 });
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getServiceMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      metrics[serviceName] = circuitBreaker.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): void {
    this.circuitBreakers.delete(serviceName);
  }
}

/**
 * Health check for external services
 */
export class HealthChecker {
  constructor(private resilientService: ResilientService) {}

  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, any>;
    timestamp: string;
  }> {
    const services: Record<string, any> = {};
    const metrics = this.resilientService.getServiceMetrics();
    
    let unhealthyCount = 0;
    let degradedCount = 0;

    // Check each service circuit breaker
    for (const [serviceName, metric] of Object.entries(metrics)) {
      const service = {
        name: serviceName,
        state: metric.state,
        failures: metric.failures,
        lastFailureTime: metric.lastFailureTime,
        status: 'healthy'
      };

      if (metric.state === 'OPEN') {
        service.status = 'unhealthy';
        unhealthyCount++;
      } else if (metric.state === 'HALF_OPEN' || metric.failures > 0) {
        service.status = 'degraded';
        degradedCount++;
      }

      services[serviceName] = service;
    }

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced error types for better error handling
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public statusCode?: number,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Global error handler with enhanced categorization
 */
export function categorizeError(error: unknown): {
  type: string;
  message: string;
  statusCode: number;
  retryable: boolean;
} {
  if (error instanceof ServiceError) {
    return {
      type: 'SERVICE_ERROR',
      message: error.message,
      statusCode: error.statusCode || 500,
      retryable: error.retryable
    };
  }

  if (error instanceof ValidationError) {
    return {
      type: 'VALIDATION_ERROR',
      message: error.message,
      statusCode: 400,
      retryable: false
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      type: 'AUTHENTICATION_ERROR',
      message: error.message,
      statusCode: 401,
      retryable: false
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      type: 'AUTHORIZATION_ERROR',
      message: error.message,
      statusCode: 403,
      retryable: false
    };
  }

  if (error instanceof Error) {
    // Categorize by error message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network operation failed',
        statusCode: 502,
        retryable: true
      };
    }

    if (message.includes('timeout')) {
      return {
        type: 'TIMEOUT_ERROR',
        message: 'Operation timed out',
        statusCode: 504,
        retryable: true
      };
    }

    if (message.includes('database') || message.includes('d1')) {
      return {
        type: 'DATABASE_ERROR',
        message: 'Database operation failed',
        statusCode: 500,
        retryable: true
      };
    }
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
    retryable: false
  };
}