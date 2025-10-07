
import { json, notFound, forbidden, badRequest } from '../utils/errors';
import { getFileById, logFileAccess, checkFilePermission } from '../db/fileQueries';
import { generateSecureDownloadUrl } from '../utils/r2SignedUrls';

// Legacy upload endpoint - deprecated in favor of new file upload system
export async function upload(env: Env, request: Request): Promise<Response> {
  return json({
    success: false,
    message: 'This endpoint is deprecated. Please use /api/files/upload/certificate instead.',
    newEndpoint: '/api/files/upload/certificate'
  }, 410);
}

export async function list(env: Env, userId: number): Promise<Response> {
  try {
    // Get certificates with simplified query based on actual schema
    const certificates = await env.DB.prepare(`
      SELECT 
        c.id,
        c.title,
        c.object_key,
        c.issued_date,
        c.created_at,
        c.status,
        c.reviewer_id,
        c.reviewed_at,
        c.rejection_reason,
        c.file_id,
        f.original_name as file_name,
        f.file_size,
        f.mime_type,
        f.virus_scan_status,
        u.full_name as reviewer_name
      FROM certificates c
      LEFT JOIN files f ON c.file_id = f.id AND f.is_deleted = FALSE
      LEFT JOIN users u ON c.reviewer_id = u.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).bind(userId).all();

    return json({ 
      success: true,
      certificates: certificates.results || []
    });
  } catch (error: any) {
    console.error('Certificate list error:', error);
    return json({
      success: false,
      message: 'Failed to retrieve certificates',
      error: error.message
    }, 500);
  }
}

export async function download(env: Env, id: number, userId: number, userRole: string): Promise<Response> {
  // Get certificate with file information
  const certificate = await env.DB.prepare(`
    SELECT 
      c.id,
      c.user_id,
      c.title,
      c.status,
      f.id as file_id,
      f.stored_name,
      f.original_name,
      f.mime_type,
      f.virus_scan_status
    FROM certificates c
    LEFT JOIN files f ON c.file_id = f.id AND f.is_deleted = FALSE
    WHERE c.id = ?
  `).bind(id).first();

  if (!certificate) {
    return notFound('Certificate not found');
  }

  if (!certificate.file_id) {
    return notFound('Certificate file not found');
  }

  // Check file permissions
  const hasPermission = await checkFilePermission(
    env, certificate.file_id as number, userId, userRole, 'read'
  );

  if (!hasPermission) {
    return forbidden('Access denied to this certificate file');
  }

  // Check virus scan status
  if (certificate.virus_scan_status === 'infected') {
    return forbidden('Certificate file contains malicious content and cannot be downloaded');
  }

  if (certificate.virus_scan_status === 'pending') {
    return json({
      success: false,
      message: 'Certificate file is still being scanned for viruses. Please try again later.',
      status: 'scanning'
    }, 202);
  }

  try {
    // Generate secure download URL
    const downloadUrl = await generateSecureDownloadUrl(
      env, 
      certificate.stored_name as string, 
      certificate.original_name as string,
      { expiresIn: 300, forceDownload: true } // 5 minutes
    );

    // Log file access
    await logFileAccess(env, certificate.file_id as number, userId, 'download');

    return json({
      success: true,
      downloadUrl,
      fileName: certificate.original_name,
      mimeType: certificate.mime_type,
      expiresIn: 300
    });

  } catch (error) {
    console.error('Certificate download error:', error);
    return json({
      success: false,
      message: 'Failed to generate download URL'
    }, 500);
  }
}

export async function remove(env: Env, id: number): Promise<Response> {
  // Get certificate with file information
  const certificate = await env.DB.prepare(`
    SELECT c.id, c.file_id, f.stored_name
    FROM certificates c
    LEFT JOIN files f ON c.file_id = f.id
    WHERE c.id = ?
  `).bind(id).first();

  if (!certificate) {
    return notFound('Certificate not found');
  }

  try {
    // Delete certificate record
    const deleteResult = await env.DB.prepare(`
      DELETE FROM certificates WHERE id = ?
    `).bind(id).run();

    // If certificate has an associated file, soft delete it
    if (certificate.file_id) {
      await env.DB.prepare(`
        UPDATE files SET is_deleted = TRUE, deleted_date = datetime('now')
        WHERE id = ?
      `).bind(certificate.file_id).run();

      // Optionally delete from R2 (or mark for cleanup)
      if (certificate.stored_name) {
        try {
          await env.CERT_BUCKET.delete(certificate.stored_name as string);
        } catch (error) {
          console.error('Failed to delete file from R2:', error);
          // Continue with certificate deletion even if R2 delete fails
        }
      }
    }

    return json({ 
      success: true,
      message: 'Certificate deleted successfully',
      deleted: deleteResult.success 
    });

  } catch (error) {
    console.error('Certificate deletion error:', error);
    return json({
      success: false,
      message: 'Failed to delete certificate'
    }, 500);
  }
}
