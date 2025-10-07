
import { badRequest } from './errors';
import { ResilientService } from './resilience';

// File type configurations
export const FILE_TYPES = {
  PDF: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    category: 'certificate'
  },
  IMAGE: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    category: 'profile'
  }
} as const;

export interface FileValidationResult {
  isValid: boolean;
  fileName: string;
  mimeType: string;
  size: number;
  category: 'certificate' | 'profile';
  errors: string[];
}

export interface VirusScanResult {
  isClean: boolean;
  scanId?: string;
  threats?: string[];
}

// File validation functions
export function validateFileType(file: File, allowedTypes: { 
  mimeTypes: readonly string[], 
  extensions: readonly string[], 
  maxSize: number, 
  category: string 
}): string[] {
  const errors: string[] = [];
  
  // Check MIME type
  if (!allowedTypes.mimeTypes.includes(file.type)) {
    errors.push(`Invalid file type. Allowed types: ${allowedTypes.mimeTypes.join(', ')}`);
  }
  
  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedTypes.extensions.includes(extension)) {
    errors.push(`Invalid file extension. Allowed extensions: ${allowedTypes.extensions.join(', ')}`);
  }
  
  // Check file size
  if (file.size > allowedTypes.maxSize) {
    errors.push(`File too large. Maximum size: ${Math.round(allowedTypes.maxSize / 1024 / 1024)}MB`);
  }
  
  // Check for empty files
  if (file.size === 0) {
    errors.push('File cannot be empty');
  }
  
  return errors;
}

export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and dangerous characters
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limit length
}

export function generateSecureFileName(originalName: string, userId: number, category: string): string {
  const timestamp = Date.now();
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const sanitized = sanitizeFileName(originalName.substring(0, originalName.lastIndexOf('.')));
  
  return `${category}/${userId}/${timestamp}_${sanitized}${extension}`;
}

// PDF-specific validation
export async function validatePDF(fileBuffer: ArrayBuffer): Promise<string[]> {
  const errors: string[] = [];
  const uint8Array = new Uint8Array(fileBuffer);
  
  // Check PDF header
  const pdfHeader = uint8Array.slice(0, 4);
  const headerString = String.fromCharCode(...pdfHeader);
  
  if (headerString !== '%PDF') {
    errors.push('Invalid PDF file: Missing PDF header');
  }
  
  // Check for minimum PDF structure
  const fileString = String.fromCharCode(...uint8Array.slice(0, Math.min(1024, uint8Array.length)));
  
  if (!fileString.includes('%%EOF')) {
    errors.push('Invalid PDF file: Missing EOF marker');
  }
  
  // Basic malware signature check (simplified)
  const suspiciousPatterns = [
    '/JavaScript',
    '/JS',
    '/OpenAction',
    '/Launch',
    'eval(',
    'document.write'
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (fileString.includes(pattern)) {
      errors.push('PDF contains potentially dangerous JavaScript content');
      break;
    }
  }
  
  return errors;
}

// Image-specific validation
export async function validateImage(fileBuffer: ArrayBuffer): Promise<string[]> {
  const errors: string[] = [];
  const uint8Array = new Uint8Array(fileBuffer);
  
  // Check image headers
  const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF;
  const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
  const isWebP = uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50;
  
  if (!isJPEG && !isPNG && !isWebP) {
    errors.push('Invalid image file: Corrupted or unsupported format');
  }
  
  // Check for embedded executable content (basic check)
  const fileString = String.fromCharCode(...uint8Array.slice(0, Math.min(1024, uint8Array.length)));
  const suspiciousPatterns = ['MZ', 'PK', '#!/bin/', 'eval('];
  
  for (const pattern of suspiciousPatterns) {
    if (fileString.includes(pattern)) {
      errors.push('Image contains potentially dangerous embedded content');
      break;
    }
  }
  
  return errors;
}

// Real virus scanning implementation using VirusTotal API with retry logic
export async function performVirusScan(env: Env, fileBuffer: ArrayBuffer, fileName: string): Promise<VirusScanResult> {
  // Check environment configuration
  const virusScanEnabled = env.VIRUS_SCAN_ENABLED === 'true';
  const apiKey = env.VIRUS_SCAN_API_KEY;
  
  if (!virusScanEnabled) {
    console.log('Virus scanning disabled, marking file as clean');
    return {
      isClean: true,
      scanId: `disabled_${Date.now()}`,
      threats: undefined
    };
  }

  if (!apiKey) {
    console.warn('VirusTotal API key not configured, using heuristic scan');
    return performHeuristicScan(fileBuffer, fileName);
  }

  try {
    const resilientService = new ResilientService(env);
    const uploadResult = await resilientService.scanFile(fileBuffer, fileName);
    
    const scanId = uploadResult.data?.id;
    if (!scanId) {
      console.error('No scan ID returned from VirusTotal');
      return performHeuristicScan(fileBuffer, fileName);
    }

    // Wait for scan to process
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get scan results
    const resultResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${scanId}`, {
      headers: {
        'x-apikey': apiKey
      }
    });

    if (!resultResponse.ok) {
      console.error(`VirusTotal result fetch failed: ${resultResponse.status}`);
      return performHeuristicScan(fileBuffer, fileName);
    }

    const analysisResult = await resultResponse.json() as any;
    const stats = analysisResult.data?.attributes?.stats;

    if (!stats) {
      console.warn('No scan statistics available, using heuristic scan');
      return performHeuristicScan(fileBuffer, fileName);
    }

    const maliciousCount = stats.malicious || 0;
    const suspiciousCount = stats.suspicious || 0;
    const threats: string[] = [];

    if (maliciousCount > 0) {
      threats.push(`${maliciousCount} engines detected malware`);
    }
    if (suspiciousCount > 0) {
      threats.push(`${suspiciousCount} engines flagged as suspicious`);
    }

    const isClean = maliciousCount === 0 && suspiciousCount === 0;

    console.log(`VirusTotal scan completed for ${fileName}: clean=${isClean}`);

    return {
      isClean,
      scanId,
      threats: threats.length > 0 ? threats : undefined
    };

  } catch (error) {
    console.error('VirusTotal scanning error:', error);
    // Fallback to heuristic scan
    return performHeuristicScan(fileBuffer, fileName);
  }
}

// Fallback heuristic virus scanning
function performHeuristicScan(fileBuffer: ArrayBuffer, fileName: string): VirusScanResult {
  // In production, integrate with a virus scanning service like ClamAV API
  // For now, implement basic heuristic checks
  
  const uint8Array = new Uint8Array(fileBuffer);
  const threats: string[] = [];
  
  // Check for known malicious signatures (simplified)
  const maliciousSignatures = [
    [0x4D, 0x5A], // PE header
    [0x50, 0x4B, 0x03, 0x04], // ZIP header (potential archive bomb)
  ];
  
  for (const signature of maliciousSignatures) {
    for (let i = 0; i <= uint8Array.length - signature.length; i++) {
      let match = true;
      for (let j = 0; j < signature.length; j++) {
        if (uint8Array[i + j] !== signature[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        threats.push('Suspicious executable content detected');
        break;
      }
    }
    if (threats.length > 0) break;
  }
  
  // Check file size for potential zip bombs
  if (uint8Array.length > 50 * 1024 * 1024) { // 50MB
    threats.push('File size exceeds safety limits');
  }
  
  return {
    isClean: threats.length === 0,
    scanId: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    threats: threats.length > 0 ? threats : undefined
  };
}

// Complete file validation
export async function validateFile(env: Env, file: File, category: 'certificate' | 'profile'): Promise<FileValidationResult> {
  const allowedTypes = category === 'certificate' ? FILE_TYPES.PDF : FILE_TYPES.IMAGE;
  const errors: string[] = [];
  
  // Basic file type validation
  const typeErrors = validateFileType(file, allowedTypes);
  errors.push(...typeErrors);
  
  if (errors.length > 0) {
    return {
      isValid: false,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      category,
      errors
    };
  }
  
  // Content validation
  const fileBuffer = await file.arrayBuffer();
  
  if (category === 'certificate') {
    const pdfErrors = await validatePDF(fileBuffer);
    errors.push(...pdfErrors);
  } else {
    const imageErrors = await validateImage(fileBuffer);
    errors.push(...imageErrors);
  }
  
  // Virus scanning
  const scanResult = await performVirusScan(env, fileBuffer, file.name);
  if (!scanResult.isClean) {
    errors.push(`Security threat detected: ${scanResult.threats?.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    category,
    errors
  };
}

// R2 upload utilities
export async function uploadToR2(
  env: Env,
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<void> {
  const object = await env.CERT_BUCKET.put(fileName, fileBuffer, {
    httpMetadata: {
      contentType: mimeType,
    },
    customMetadata: metadata
  });
  
  if (!object) {
    throw new Error('Failed to upload file to R2');
  }
}

// Generate signed URLs for secure downloads
export async function generateSignedUrl(
  env: Env,
  fileName: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const object = await env.CERT_BUCKET.get(fileName);
  
  if (!object) {
    throw new Error('File not found');
  }
  
  // Generate signed URL (R2 pre-signed URL)
  const expirationTime = Math.floor(Date.now() / 1000) + expiresIn;
  
  // Note: This is a simplified implementation
  // In production, use proper R2 signed URL generation
  return `https://your-bucket.r2.dev/${fileName}?expires=${expirationTime}`;
}

// File deletion
export async function deleteFromR2(env: Env, fileName: string): Promise<void> {
  await env.CERT_BUCKET.delete(fileName);
}

// Get file info from R2
export async function getFileInfo(env: Env, fileName: string): Promise<{
  size: number;
  etag: string;
  uploaded: Date;
  metadata?: Record<string, string>;
} | null> {
  const object = await env.CERT_BUCKET.head(fileName);
  
  if (!object) {
    return null;
  }
  
  return {
    size: object.size,
    etag: object.etag,
    uploaded: object.uploaded,
    metadata: object.customMetadata
  };
}
