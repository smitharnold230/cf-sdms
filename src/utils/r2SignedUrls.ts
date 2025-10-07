

interface SignedUrlOptions {
  method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
  expiresIn?: number; // seconds
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

// Generate R2 pre-signed URL for secure file operations
export async function generateR2SignedUrl(
  env: Env,
  objectKey: string,
  options: SignedUrlOptions = {}
): Promise<string> {
  const {
    method = 'GET',
    expiresIn = 3600,
    contentType,
    contentLength,
    metadata
  } = options;

  try {
    // For Cloudflare R2, generate a simple access URL
    // In production, implement proper R2 presigned URL generation
    const baseUrl = `https://r2.dev/${objectKey}`;
    const signedUrl = new URL(baseUrl);
    
    // Add query parameters for access control
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    signedUrl.searchParams.set('expires', expires.toString());
    signedUrl.searchParams.set('timestamp', Date.now().toString());
    
    // In a real implementation, you would:
    // 1. Generate AWS Signature Version 4
    // 2. Add proper authentication headers
    // 3. Use the R2 API credentials
    
    // For now, return a simplified URL structure
    return signedUrl.toString();
    
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
}

// Generate upload pre-signed URL for direct client uploads
export async function generateUploadSignedUrl(
  env: Env,
  objectKey: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = 900 // 15 minutes default for uploads
): Promise<{
  uploadUrl: string;
  fields: Record<string, string>;
}> {
  try {
    // Generate pre-signed POST URL for direct upload
    const uploadUrl = await generateR2SignedUrl(env, objectKey, {
      method: 'PUT',
      expiresIn,
      contentType,
      contentLength
    });

    // Additional fields for secure upload
    const fields = {
      'Content-Type': contentType,
      'Content-Length': contentLength.toString(),
      'x-amz-meta-upload-timestamp': Date.now().toString(),
    };

    return {
      uploadUrl,
      fields
    };

  } catch (error) {
    console.error('Error generating upload signed URL:', error);
    throw new Error('Failed to generate upload signed URL');
  }
}

// Generate download pre-signed URL with access controls
export async function generateSecureDownloadUrl(
  env: Env,
  objectKey: string,
  fileName: string,
  options: {
    expiresIn?: number;
    forceDownload?: boolean;
    ipRestriction?: string[];
    userAgent?: string;
  } = {}
): Promise<string> {
  const {
    expiresIn = 3600,
    forceDownload = true,
    ipRestriction,
    userAgent
  } = options;

  try {
    const signedUrl = await generateR2SignedUrl(env, objectKey, {
      method: 'GET',
      expiresIn
    });

    const url = new URL(signedUrl);
    
    // Add download-specific parameters
    if (forceDownload) {
      url.searchParams.set('response-content-disposition', `attachment; filename="${fileName}"`);
    }
    
    // Add cache control
    url.searchParams.set('response-cache-control', 'private, no-cache');
    
    // Note: IP restriction and user agent validation would need to be
    // implemented at the application level or using Cloudflare Workers
    
    return url.toString();

  } catch (error) {
    console.error('Error generating secure download URL:', error);
    throw new Error('Failed to generate secure download URL');
  }
}

// Verify signed URL signature (for webhook/callback verification)
export async function verifySignedUrlSignature(
  url: string,
  expectedSignature: string,
  secretKey: string
): Promise<boolean> {
  try {
    // Extract URL components for signature verification
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    // Create signature string from URL parameters
    const stringToSign = createSignatureString(params);
    
    // Generate expected signature
    const signature = await generateSignature(stringToSign, secretKey);
    
    return signature === expectedSignature;

  } catch (error) {
    console.error('Error verifying signed URL signature:', error);
    return false;
  }
}

// Helper function to create signature string
function createSignatureString(params: URLSearchParams): string {
  const paramEntries: [string, string][] = [];
  
  // Manually iterate over URLSearchParams since entries() might not be available
  params.forEach((value, key) => {
    paramEntries.push([key, value]);
  });
  
  const sortedParams = paramEntries
    .filter(([key]: [string, string]) => !key.startsWith('X-Amz-Signature'))
    .sort(([a]: [string, string], [b]: [string, string]) => a.localeCompare(b))
    .map(([key, value]: [string, string]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
    
  return sortedParams;
}

// Helper function to generate HMAC signature
async function generateSignature(stringToSign: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const dataToSign = encoder.encode(stringToSign);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
  const signatureArray = new Uint8Array(signature);
  
  return Array.from(signatureArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Get object metadata from R2
export async function getR2ObjectMetadata(
  env: Env,
  objectKey: string
): Promise<{
  size: number;
  etag: string;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
} | null> {
  try {
    const object = await env.CERT_BUCKET.head(objectKey);
    
    if (!object) {
      return null;
    }

    return {
      size: object.size,
      etag: object.etag,
      lastModified: object.uploaded,
      contentType: object.httpMetadata?.contentType,
      metadata: object.customMetadata
    };

  } catch (error) {
    console.error('Error getting R2 object metadata:', error);
    return null;
  }
}

// Stream file from R2 with range support
export async function streamFileFromR2(
  env: Env,
  objectKey: string,
  range?: string
): Promise<Response | null> {
  try {
    let object;
    
    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : undefined;
        
        object = await env.CERT_BUCKET.get(objectKey, {
          range: { offset: start, length: end ? end - start + 1 : undefined }
        });
      }
    } else {
      object = await env.CERT_BUCKET.get(objectKey);
    }

    if (!object) {
      return null;
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Content-Length', object.size.toString());
    headers.set('ETag', object.etag);
    headers.set('Last-Modified', object.uploaded.toUTCString());
    
    // Add custom metadata as headers
    if (object.customMetadata) {
      for (const [key, value] of Object.entries(object.customMetadata)) {
        headers.set(`X-Metadata-${key}`, String(value));
      }
    }

    if (range) {
      headers.set('Content-Range', `bytes ${range}/${object.size}`);
      return new Response(object.body, { status: 206, headers });
    }

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('Error streaming file from R2:', error);
    return null;
  }
}

// Batch delete objects from R2
export async function batchDeleteFromR2(
  env: Env,
  objectKeys: string[]
): Promise<{ successful: string[]; failed: string[] }> {
  const successful: string[] = [];
  const failed: string[] = [];

  // R2 supports batch delete, but for simplicity, we'll delete one by one
  for (const objectKey of objectKeys) {
    try {
      await env.CERT_BUCKET.delete(objectKey);
      successful.push(objectKey);
    } catch (error) {
      console.error(`Failed to delete ${objectKey}:`, error);
      failed.push(objectKey);
    }
  }

  return { successful, failed };
}

// Copy object within R2 bucket
export async function copyR2Object(
  env: Env,
  sourceKey: string,
  destinationKey: string,
  metadata?: Record<string, string>
): Promise<boolean> {
  try {
    // Get source object
    const sourceObject = await env.CERT_BUCKET.get(sourceKey);
    if (!sourceObject) {
      throw new Error('Source object not found');
    }

    // Copy to new location
    await env.CERT_BUCKET.put(destinationKey, sourceObject.body, {
      httpMetadata: sourceObject.httpMetadata,
      customMetadata: metadata || sourceObject.customMetadata
    });

    return true;

  } catch (error) {
    console.error('Error copying R2 object:', error);
    return false;
  }
}

// List objects in R2 bucket with prefix
export async function listR2Objects(
  env: Env,
  prefix?: string,
  limit?: number
): Promise<{
  objects: Array<{
    key: string;
    size: number;
    etag: string;
    lastModified: Date;
  }>;
  truncated: boolean;
}> {
  try {
    const options: any = {};
    if (prefix) options.prefix = prefix;
    if (limit) options.limit = limit;

    const result = await env.CERT_BUCKET.list(options);

    return {
      objects: result.objects.map((obj: any) => ({
        key: obj.key,
        size: obj.size,
        etag: obj.etag,
        lastModified: obj.uploaded
      })),
      truncated: result.truncated
    };

  } catch (error) {
    console.error('Error listing R2 objects:', error);
    return { objects: [], truncated: false };
  }
}
