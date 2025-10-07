
import { AuthContext } from '../../middleware/auth';
import { json, badRequest, unauthorized, forbidden, notFound } from '../../utils/errors';
import { 
  validateFile, 
  generateSecureFileName, 
  uploadToR2, 
  generateSignedUrl,
  deleteFromR2,
  getFileInfo,
  FileValidationResult
} from '../../utils/fileUpload';
import {
  createFileRecord,
  getFileById,
  getUserFiles,
  updateVirusScanStatus,
  logFileAccess,
  createDownloadToken,
  validateDownloadToken,
  useDownloadToken,
  checkFilePermission,
  softDeleteFile
} from '../../db/fileQueries';

// Upload certificate file
export async function uploadCertificate(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workshopId = formData.get('workshopId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    if (!file) {
      return badRequest('No file provided');
    }

    if (!title || !description) {
      return badRequest('Title and description are required');
    }

    // Validate file
    const validation: FileValidationResult = await validateFile(file, 'certificate');
    if (!validation.isValid) {
      return badRequest('File validation failed', validation.errors);
    }

    // Generate secure filename
    const secureFileName = generateSecureFileName(file.name, authContext.userId, 'certificate');

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await uploadToR2(env, fileBuffer, secureFileName, file.type, {
      uploadedBy: authContext.userId.toString(),
      originalName: file.name,
      category: 'certificate',
      workshopId: workshopId || '',
      title,
      description
    });

    // Create file record in database
    const fileId = await createFileRecord(env, {
      original_name: file.name,
      stored_name: secureFileName,
      file_size: file.size,
      mime_type: file.type,
      category: 'certificate',
      uploaded_by: authContext.userId
    });

    // Create certificate record
    const certificateResult = await env.DB.prepare(`
      INSERT INTO certificates (
        user_id, title, description, file_id, workshop_id, submission_date, status
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending')
    `).bind(
      authContext.userId,
      title,
      description,
      fileId,
      workshopId ? parseInt(workshopId) : null
    ).run();

    if (!certificateResult.success) {
      // Clean up uploaded file if certificate creation fails
      await deleteFromR2(env, secureFileName);
      await softDeleteFile(env, fileId);
      return badRequest('Failed to create certificate record');
    }

    // Log file access
    await logFileAccess(env, fileId, authContext.userId, 'upload', 
      request.headers.get('CF-Connecting-IP') || undefined,
      request.headers.get('User-Agent') || undefined
    );

    return json({
      success: true,
      message: 'Certificate uploaded successfully',
      data: {
        fileId,
        certificateId: certificateResult.meta.last_row_id,
        fileName: file.name,
        secureFileName,
        size: file.size,
        virusScanStatus: 'pending'
      }
    });

  } catch (error) {
    console.error('Certificate upload error:', error);
    return json({
      success: false,
      message: 'Internal server error during file upload'
    }, 500);
  }
}

// Upload profile photo
export async function uploadProfilePhoto(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return badRequest('No file provided');
    }

    // Validate image file
    const validation: FileValidationResult = await validateFile(file, 'profile');
    if (!validation.isValid) {
      return badRequest('File validation failed', validation.errors);
    }

    // Check if user already has a profile photo
    const existingFiles = await getUserFiles(env, authContext.userId, 'profile');
    
    // Generate secure filename
    const secureFileName = generateSecureFileName(file.name, authContext.userId, 'profile');

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await uploadToR2(env, fileBuffer, secureFileName, file.type, {
      uploadedBy: authContext.userId.toString(),
      originalName: file.name,
      category: 'profile'
    });

    // Create file record in database
    const fileId = await createFileRecord(env, {
      original_name: file.name,
      stored_name: secureFileName,
      file_size: file.size,
      mime_type: file.type,
      category: 'profile',
      uploaded_by: authContext.userId
    });

    // Update user's profile photo reference
    await env.DB.prepare(`
      UPDATE users SET profile_photo_id = ? WHERE id = ?
    `).bind(fileId, authContext.userId).run();

    // Soft delete previous profile photos
    for (const oldFile of existingFiles) {
      if (oldFile.id !== fileId) {
        await softDeleteFile(env, oldFile.id);
        await deleteFromR2(env, oldFile.stored_name);
      }
    }

    // Log file access
    await logFileAccess(env, fileId, authContext.userId, 'upload',
      request.headers.get('CF-Connecting-IP') || undefined,
      request.headers.get('User-Agent') || undefined
    );

    return json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        fileId,
        fileName: file.name,
        secureFileName,
        size: file.size,
        virusScanStatus: 'pending'
      }
    });

  } catch (error) {
    console.error('Profile photo upload error:', error);
    return json({
      success: false,
      message: 'Internal server error during file upload'
    }, 500);
  }
}

// Get secure download URL
export async function getSecureDownloadUrl(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  const url = new URL(request.url);
  const fileId = parseInt(url.pathname.split('/').pop() || '0');
  const expiresIn = parseInt(url.searchParams.get('expires') || '3600');

  if (!fileId) {
    return badRequest('Invalid file ID');
  }

  // Get file record
  const file = await getFileById(env, fileId);
  if (!file) {
    return notFound('File not found');
  }

  // Check permissions
  const hasPermission = await checkFilePermission(
    env, fileId, authContext.userId, authContext.role, 'read'
  );

  if (!hasPermission) {
    return forbidden('Access denied to this file');
  }

  // Check virus scan status
  if (file.virus_scan_status === 'infected') {
    return forbidden('File contains malicious content and cannot be downloaded');
  }

  if (file.virus_scan_status === 'pending') {
    return json({
      success: false,
      message: 'File is still being scanned for viruses. Please try again later.',
      status: 'scanning'
    }, 202);
  }

  try {
    // Create download token
    const token = await createDownloadToken(
      env, fileId, authContext.userId, authContext.userId, expiresIn
    );

    // Generate signed URL (simplified - in production use proper R2 signed URLs)
    const signedUrl = await generateSignedUrl(env, file.stored_name, expiresIn);

    // Log file access
    await logFileAccess(env, fileId, authContext.userId, 'view',
      request.headers.get('CF-Connecting-IP') || undefined,
      request.headers.get('User-Agent') || undefined
    );

    return json({
      success: true,
      data: {
        downloadUrl: signedUrl,
        token,
        fileName: file.original_name,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating download URL:', error);
    return json({
      success: false,
      message: 'Failed to generate download URL'
    }, 500);
  }
}

// Download file with token
export async function downloadFile(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const fileId = parseInt(url.pathname.split('/').pop() || '0');

  if (!token || !fileId) {
    return badRequest('Token and file ID are required');
  }

  // Validate token
  const tokenValidation = await validateDownloadToken(
    env, token, authContext.userId, 
    request.headers.get('CF-Connecting-IP') || undefined
  );

  if (!tokenValidation.isValid) {
    return unauthorized(tokenValidation.reason || 'Invalid download token');
  }

  if (tokenValidation.fileId !== fileId) {
    return badRequest('Token does not match file ID');
  }

  // Get file record
  const file = await getFileById(env, fileId);
  if (!file) {
    return notFound('File not found');
  }

  try {
    // Get file from R2
    const object = await env.CERT_BUCKET.get(file.stored_name);
    if (!object) {
      return notFound('File not found in storage');
    }

    // Use download token
    await useDownloadToken(env, token);

    // Log file access
    await logFileAccess(env, fileId, authContext.userId, 'download',
      request.headers.get('CF-Connecting-IP') || undefined,
      request.headers.get('User-Agent') || undefined
    );

    // Return file
    return new Response(object.body, {
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename="${file.original_name}"`,
        'Content-Length': file.file_size.toString(),
        'Cache-Control': 'private, no-cache'
      }
    });

  } catch (error) {
    console.error('File download error:', error);
    return json({
      success: false,
      message: 'Failed to download file'
    }, 500);
  }
}

// Get user's files
export async function getUserFileList(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') as 'certificate' | 'profile' | null;
  const targetUserId = url.searchParams.get('userId');

  let userId = authContext.userId;

  // Check if requesting another user's files
  if (targetUserId && parseInt(targetUserId) !== authContext.userId) {
    if (authContext.role !== 'admin' && authContext.role !== 'faculty') {
      return forbidden('Access denied to other user files');
    }
    userId = parseInt(targetUserId);
  }

  try {
    const files = await getUserFiles(env, userId, category || undefined);

    const fileList = files.map(file => ({
      id: file.id,
      originalName: file.original_name,
      fileSize: file.file_size,
      mimeType: file.mime_type,
      category: file.category,
      uploadDate: file.upload_date,
      virusScanStatus: file.virus_scan_status,
      accessCount: file.access_count,
      lastAccessed: file.last_accessed
    }));

    return json({
      success: true,
      data: {
        files: fileList,
        totalCount: fileList.length,
        totalSize: files.reduce((sum, file) => sum + file.file_size, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching user files:', error);
    return json({
      success: false,
      message: 'Failed to fetch files'
    }, 500);
  }
}

// Delete file
export async function deleteFile(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  const url = new URL(request.url);
  const fileId = parseInt(url.pathname.split('/').pop() || '0');

  if (!fileId) {
    return badRequest('Invalid file ID');
  }

  // Get file record
  const file = await getFileById(env, fileId);
  if (!file) {
    return notFound('File not found');
  }

  // Check permissions
  const hasPermission = await checkFilePermission(
    env, fileId, authContext.userId, authContext.role, 'delete'
  );

  if (!hasPermission) {
    return forbidden('Access denied to delete this file');
  }

  try {
    // Soft delete file record
    await softDeleteFile(env, fileId);

    // Delete from R2
    await deleteFromR2(env, file.stored_name);

    // If it's a profile photo, update user record
    if (file.category === 'profile') {
      await env.DB.prepare(`
        UPDATE users SET profile_photo_id = NULL 
        WHERE profile_photo_id = ?
      `).bind(fileId).run();
    }

    // Update associated certificates
    if (file.category === 'certificate') {
      await env.DB.prepare(`
        UPDATE certificates SET file_id = NULL 
        WHERE file_id = ?
      `).bind(fileId).run();
    }

    return json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('File deletion error:', error);
    return json({
      success: false,
      message: 'Failed to delete file'
    }, 500);
  }
}

// Update virus scan status (internal endpoint)
export async function updateFileVirusScanStatus(
  request: Request, 
  env: Env, 
  authContext: AuthContext
): Promise<Response> {
  // This should only be called by admin or system processes
  if (authContext.role !== 'admin') {
    return forbidden('Access denied');
  }

  try {
    const body = await request.json() as {
      fileId: number;
      status: 'clean' | 'infected' | 'failed';
      scanId?: string;
    };

    await updateVirusScanStatus(env, body.fileId, body.status, body.scanId);

    // If infected, create notification
    if (body.status === 'infected') {
      const file = await getFileById(env, body.fileId);
      if (file) {
        await env.DB.prepare(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES (?, 'file_virus_detected', 'Virus Detected', 
                  'A virus was detected in your uploaded file and it has been quarantined.')
        `).bind(file.uploaded_by).run();
      }
    }

    return json({
      success: true,
      message: 'Virus scan status updated'
    });

  } catch (error) {
    console.error('Error updating virus scan status:', error);
    return json({
      success: false,
      message: 'Failed to update virus scan status'
    }, 500);
  }
}
