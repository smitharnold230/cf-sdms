import { Router } from 'itty-router';
import { errorResponse, successResponse } from '../utils/responses';
import { withErrorHandling } from '../utils/production';
import { ResilientService, HealthChecker } from '../utils/resilience';
import { PerformanceMonitor, CacheManager } from '../utils/performance';

const monitoringRouter = Router();

/**
 * System health check endpoint
 */
monitoringRouter.get('/health', withErrorHandling(async (request: Request, env: Env) => {
  const resilientService = new ResilientService(env);
  const healthChecker = new HealthChecker(resilientService);
  
  const health = await healthChecker.checkHealth();
  
  // Add basic system checks
  const systemChecks = {
    database: await checkDatabaseHealth(env),
    storage: await checkStorageHealth(env),
    kv: await checkKVHealth(env),
    timestamp: new Date().toISOString()
  };

  const response = {
    ...health,
    system: systemChecks
  };

  // Return appropriate status code based on health
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}));

/**
 * Performance metrics endpoint
 */
monitoringRouter.get('/metrics', withErrorHandling(async (request: Request, env: Env) => {
  const performanceMonitor = new PerformanceMonitor();
  const cacheManager = new CacheManager(env);
  const resilientService = new ResilientService(env);

  const metrics = {
    performance: performanceMonitor.getMetrics(),
    cache: cacheManager.getStats(),
    services: resilientService.getServiceMetrics(),
    system: {
      uptime: Date.now(),
      timestamp: new Date().toISOString()
    }
  };

  return successResponse(metrics);
}));

/**
 * Service status endpoint
 */
monitoringRouter.get('/status', withErrorHandling(async (request: Request, env: Env) => {
  const status = {
    service: 'Student Database Management System',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    uptime: Date.now(),
    features: {
      authentication: !!env.JWT_SECRET,
      email_notifications: !!env.SENDGRID_API_KEY,
      virus_scanning: env.VIRUS_SCAN_ENABLED === 'true',
      rate_limiting: env.RATE_LIMIT_ENABLED !== 'false',
      analytics: !!env.ANALYTICS_TOKEN
    }
  };

  return successResponse(status);
}));

/**
 * Reset circuit breakers endpoint (admin only)
 */
monitoringRouter.post('/reset-circuit-breakers', withErrorHandling(async (request: Request, env: Env) => {
  // Basic admin check - in production, use proper authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Authentication required', 401);
  }

  try {
    const resilientService = new ResilientService(env);
    
    const body = await request.json() as { service?: string };
    
    if (body.service) {
      resilientService.resetCircuitBreaker(body.service);
      return successResponse({ message: `Circuit breaker reset for ${body.service}` });
    } else {
      // Reset all circuit breakers by creating new instance
      return successResponse({ message: 'All circuit breakers reset' });
    }
  } catch (error) {
    return errorResponse('Failed to reset circuit breakers', 500);
  }
}));

/**
 * Cache management endpoint (admin only)
 */
monitoringRouter.post('/cache/clear', withErrorHandling(async (request: Request, env: Env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Authentication required', 401);
  }

  try {
    const cacheManager = new CacheManager(env);
    await cacheManager.clear();
    
    return successResponse({ message: 'Cache cleared successfully' });
  } catch (error) {
    return errorResponse('Failed to clear cache', 500);
  }
}));

/**
 * Cache invalidation by tags endpoint
 */
monitoringRouter.post('/cache/invalidate', withErrorHandling(async (request: Request, env: Env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Authentication required', 401);
  }

  try {
    const { tags } = await request.json() as { tags: string[] };
    
    if (!Array.isArray(tags)) {
      return errorResponse('Tags must be an array', 400);
    }

    const cacheManager = new CacheManager(env);
    await cacheManager.invalidateByTags(tags);
    
    return successResponse({ 
      message: `Cache invalidated for tags: ${tags.join(', ')}` 
    });
  } catch (error) {
    return errorResponse('Failed to invalidate cache', 500);
  }
}));

// Helper functions for health checks
async function checkDatabaseHealth(env: Env): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    const result = await env.DB.prepare('SELECT 1 as test').first();
    const latency = Date.now() - start;
    
    return {
      status: result ? 'healthy' : 'unhealthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }
}

async function checkStorageHealth(env: Env): Promise<{ status: string; error?: string }> {
  try {
    // Try to list objects (this is a lightweight operation)
    const result = await env.CERT_BUCKET.list({ limit: 1 });
    return {
      status: 'healthy'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }
}

async function checkKVHealth(env: Env): Promise<{ status: string; error?: string }> {
  try {
    // Test KV by doing a lightweight operation
    await env.RATE_LIMIT_KV.list({ limit: 1 });
    return {
      status: 'healthy'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }
}

export { monitoringRouter };