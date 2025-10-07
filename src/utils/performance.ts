/**
 * Performance Optimization Utilities
 */

/**
 * Response compression utilities
 */
export class CompressionHandler {
  static shouldCompress(contentType: string, size: number): boolean {
    // Only compress text-based content over 1KB
    const compressibleTypes = [
      'application/json',
      'application/javascript',
      'text/html',
      'text/css',
      'text/plain',
      'text/csv',
      'application/xml'
    ];
    
    return size > 1024 && compressibleTypes.some(type => contentType.includes(type));
  }

  static async compressResponse(response: Response): Promise<Response> {
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    if (!this.shouldCompress(contentType, contentLength)) {
      return response;
    }

    try {
      const text = await response.text();
      const compressed = new CompressionStream('gzip');
      const stream = new ReadableStream({
        start(controller) {
          const writer = compressed.writable.getWriter();
          writer.write(new TextEncoder().encode(text));
          writer.close();
        }
      });

      const reader = compressed.readable.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const compressedBuffer = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      );
      
      let offset = 0;
      for (const chunk of chunks) {
        compressedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const headers = new Headers(response.headers);
      headers.set('content-encoding', 'gzip');
      headers.set('content-length', compressedBuffer.length.toString());

      return new Response(compressedBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn('Compression failed:', error);
      return response;
    }
  }
}

/**
 * Caching utilities with TTL and invalidation
 */
export class CacheManager {
  private cache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
    tags: string[];
  }>();

  constructor(private env: Env) {}

  /**
   * Generate cache key with consistent hashing
   */
  private generateKey(prefix: string, params: any): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return `${prefix}:${this.hash(normalized)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached data with TTL check
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.cache.get(key);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
        return memoryEntry.data as T;
      }

      // Check KV cache
      const kvData = await this.env.CACHE_KV?.get(key);
      if (kvData) {
        const parsed = JSON.parse(kvData);
        if (Date.now() - parsed.timestamp < parsed.ttl) {
          // Update memory cache
          this.cache.set(key, parsed);
          return parsed.data as T;
        } else {
          // Expired, remove from KV
          await this.env.CACHE_KV?.delete(key);
        }
      }

      return null;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL and tags
   */
  async set(
    key: string, 
    data: any, 
    ttlMs: number = 300000, // 5 minutes default
    tags: string[] = []
  ): Promise<void> {
    try {
      const entry = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
        tags
      };

      // Set in memory cache
      this.cache.set(key, entry);

      // Set in KV cache with expiration
      if (this.env.CACHE_KV) {
        await this.env.CACHE_KV.put(
          key, 
          JSON.stringify(entry),
          { expirationTtl: Math.ceil(ttlMs / 1000) }
        );
      }
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      // Invalidate memory cache
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.cache.delete(key);
        }
      }

      // For KV cache, we'd need to maintain a tag index
      // This is a simplified version - in production, consider using separate tag indexing
      if (this.env.CACHE_KV) {
        const list = await this.env.CACHE_KV.list();
        for (const key of list.keys) {
          const data = await this.env.CACHE_KV.get(key.name);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.tags && parsed.tags.some((tag: string) => tags.includes(tag))) {
                await this.env.CACHE_KV.delete(key.name);
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    // Note: KV doesn't have a clear all method, would need to list and delete
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp < entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: validEntries / (validEntries + expiredEntries) || 0
    };
  }
}

/**
 * Database query optimization
 */
export class QueryOptimizer {
  private queryCache = new Map<string, string>();

  constructor(private cacheManager: CacheManager) {}

  /**
   * Execute query with caching
   */
  async executeWithCache<T>(
    db: D1Database,
    query: string,
    params: any[] = [],
    cacheKeyPrefix: string = 'query',
    ttlMs: number = 300000
  ): Promise<T> {
    const cacheKey = this.generateQueryCacheKey(cacheKeyPrefix, query, params);
    
    // Try to get from cache first
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute query
    const stmt = db.prepare(query);
    const result = await stmt.bind(...params).all();
    
    // Cache the result
    await this.cacheManager.set(cacheKey, result, ttlMs, ['database', cacheKeyPrefix]);
    
    return result as T;
  }

  /**
   * Batch queries for better performance
   */
  async executeBatch(
    db: D1Database,
    queries: Array<{ query: string; params: any[] }>
  ): Promise<any[]> {
    const statements = queries.map(({ query, params }) => 
      db.prepare(query).bind(...params)
    );
    
    return await db.batch(statements);
  }

  /**
   * Generate consistent cache key for queries
   */
  private generateQueryCacheKey(prefix: string, query: string, params: any[]): string {
    const normalized = `${query}:${JSON.stringify(params)}`;
    return `${prefix}:${this.hash(normalized)}`;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
  }>();

  /**
   * Measure execution time of async operations
   */
  async measure<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      this.recordMetric(operationName, Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordMetric(operationName, Date.now() - startTime, true);
      throw error;
    }
  }

  /**
   * Record performance metric
   */
  private recordMetric(operationName: string, duration: number, isError = false): void {
    const existing = this.metrics.get(operationName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.minTime = Math.min(existing.minTime, duration);
    existing.maxTime = Math.max(existing.maxTime, duration);

    this.metrics.set(operationName, existing);

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow operation detected: ${operationName} took ${duration}ms`);
    }

    if (isError) {
      console.error(`Operation failed: ${operationName} after ${duration}ms`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        ...metrics,
        minTime: metrics.minTime === Infinity ? 0 : metrics.minTime
      };
    }
    
    return result;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.clear();
  }
}

/**
 * CDN and static asset optimization
 */
export class AssetOptimizer {
  /**
   * Generate optimized response headers for static assets
   */
  static getStaticAssetHeaders(filePath: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      'js': 'application/javascript',
      'css': 'text/css',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip'
    };
    
    if (extension && contentTypes[extension]) {
      headers['Content-Type'] = contentTypes[extension];
    }
    
    // Set caching headers based on file type
    if (['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension || '')) {
      // Static assets - cache for 1 year
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (['pdf', 'zip'].includes(extension || '')) {
      // Documents - cache for 1 day
      headers['Cache-Control'] = 'public, max-age=86400';
    } else {
      // Default - no cache
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    
    return headers;
  }

  /**
   * Generate ETag for content
   */
  static generateETag(content: string | ArrayBuffer): string {
    const hash = content instanceof ArrayBuffer 
      ? this.hashBuffer(content)
      : this.hashString(content);
    return `"${hash}"`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private static hashBuffer(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash) + view[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if content matches ETag
   */
  static isNotModified(request: Request, etag: string): boolean {
    const ifNoneMatch = request.headers.get('if-none-match');
    return ifNoneMatch === etag;
  }
}

/**
 * Performance optimization middleware
 */
export function withPerformanceOptimizations() {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    const performanceMonitor = new PerformanceMonitor();
    const cacheManager = new CacheManager(env);
    
    // Add to request context
    (request as any).performanceMonitor = performanceMonitor;
    (request as any).cacheManager = cacheManager;
    
    return { performanceMonitor, cacheManager };
  };
}