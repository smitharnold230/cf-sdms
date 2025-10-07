

// File metadata interface
export interface FileRecord {
  id: number;
  original_name: string;
  stored_name: string;
  file_size: number;
  mime_type: string;
  category: 'certificate' | 'profile';
  uploaded_by: number;
  upload_date: string;
  virus_scan_status: 'pending' | 'clean' | 'infected' | 'failed';
  virus_scan_id?: string;
  scan_date?: string;
  access_count: number;
  last_accessed?: string;
  is_deleted: boolean;
  deleted_date?: string;
}

export interface FileAccessLog {
  id: number;
  file_id: number;
  accessed_by: number;
  access_date: string;
  access_type: 'view' | 'download' | 'upload';
  ip_address?: string;
  user_agent?: string;
}

export interface DownloadToken {
  id: number;
  token: string;
  file_id: number;
  generated_for: number;
  generated_by: number;
  generated_date: string;
  expires_date: string;
  download_count: number;
  max_downloads: number;
  is_used: boolean;
  ip_restriction?: string;
}

// Create file record in database
export async function createFileRecord(
  env: Env,
  fileData: {
    original_name: string;
    stored_name: string;
    file_size: number;
    mime_type: string;
    category: 'certificate' | 'profile';
    uploaded_by: number;
    virus_scan_id?: string;
  }
): Promise<number> {
  const result = await env.DB.prepare(`
    INSERT INTO files (
      original_name, stored_name, file_size, mime_type, 
      category, uploaded_by, virus_scan_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fileData.original_name,
    fileData.stored_name,
    fileData.file_size,
    fileData.mime_type,
    fileData.category,
    fileData.uploaded_by,
    fileData.virus_scan_id || null
  ).run();

  if (!result.success) {
    throw new Error('Failed to create file record');
  }

  return result.meta.last_row_id as number;
}

// Get file by ID
export async function getFileById(env: Env, fileId: number): Promise<FileRecord | null> {
  const file = await env.DB.prepare(`
    SELECT * FROM files WHERE id = ? AND is_deleted = FALSE
  `).bind(fileId).first();

  return file as FileRecord | null;
}

// Get file by stored name
export async function getFileByStoredName(env: Env, storedName: string): Promise<FileRecord | null> {
  const file = await env.DB.prepare(`
    SELECT * FROM files WHERE stored_name = ? AND is_deleted = FALSE
  `).bind(storedName).first();

  return file as FileRecord | null;
}

// Get user's files
export async function getUserFiles(
  env: Env, 
  userId: number, 
  category?: 'certificate' | 'profile'
): Promise<FileRecord[]> {
  let query = `
    SELECT * FROM files 
    WHERE uploaded_by = ? AND is_deleted = FALSE
  `;
  const params: any[] = [userId];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` ORDER BY upload_date DESC`;

  const result = await env.DB.prepare(query).bind(...params).all();
  return (result.results as Record<string, unknown>[]).map(row => ({
    id: row.id as number,
    original_name: row.original_name as string,
    stored_name: row.stored_name as string,
    file_size: row.file_size as number,
    mime_type: row.mime_type as string,
    category: row.category as 'certificate' | 'profile',
    uploaded_by: row.uploaded_by as number,
    upload_date: row.upload_date as string,
    virus_scan_status: row.virus_scan_status as 'pending' | 'clean' | 'infected' | 'failed',
    virus_scan_id: row.virus_scan_id as string | undefined,
    scan_date: row.scan_date as string | undefined,
    access_count: row.access_count as number,
    last_accessed: row.last_accessed as string | undefined,
    is_deleted: row.is_deleted as boolean,
    deleted_date: row.deleted_date as string | undefined,
  }));
}

// Update virus scan status
export async function updateVirusScanStatus(
  env: Env,
  fileId: number,
  status: 'clean' | 'infected' | 'failed',
  scanId?: string
): Promise<void> {
  await env.DB.prepare(`
    UPDATE files 
    SET virus_scan_status = ?, scan_date = datetime('now'), virus_scan_id = ?
    WHERE id = ?
  `).bind(status, scanId || null, fileId).run();
}

// Log file access
export async function logFileAccess(
  env: Env,
  fileId: number,
  accessedBy: number,
  accessType: 'view' | 'download' | 'upload',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO file_access_logs (
      file_id, accessed_by, access_type, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(fileId, accessedBy, accessType, ipAddress || null, userAgent || null).run();
}

// Create download token
export async function createDownloadToken(
  env: Env,
  fileId: number,
  generatedFor: number,
  generatedBy: number,
  expiresIn: number = 3600, // 1 hour default
  maxDownloads: number = 1,
  ipRestriction?: string[]
): Promise<string> {
  const token = generateSecureToken();
  const expiresDate = new Date(Date.now() + expiresIn * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO file_download_tokens (
      token, file_id, generated_for, generated_by, expires_date, max_downloads, ip_restriction
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    token,
    fileId,
    generatedFor,
    generatedBy,
    expiresDate,
    maxDownloads,
    ipRestriction ? JSON.stringify(ipRestriction) : null
  ).run();

  return token;
}

// Validate download token
export async function validateDownloadToken(
  env: Env,
  token: string,
  userId: number,
  ipAddress?: string
): Promise<{ isValid: boolean; fileId?: number; reason?: string }> {
  const tokenRecord = await env.DB.prepare(`
    SELECT * FROM file_download_tokens 
    WHERE token = ? AND expires_date > datetime('now')
  `).bind(token).first() as DownloadToken | null;

  if (!tokenRecord) {
    return { isValid: false, reason: 'Invalid or expired token' };
  }

  if (tokenRecord.generated_for !== userId) {
    return { isValid: false, reason: 'Token not valid for this user' };
  }

  if (tokenRecord.is_used && tokenRecord.download_count >= tokenRecord.max_downloads) {
    return { isValid: false, reason: 'Token usage limit exceeded' };
  }

  // Check IP restriction if set
  if (tokenRecord.ip_restriction && ipAddress) {
    const allowedIPs = JSON.parse(tokenRecord.ip_restriction);
    if (!allowedIPs.includes(ipAddress)) {
      return { isValid: false, reason: 'Access denied from this IP address' };
    }
  }

  return { isValid: true, fileId: tokenRecord.file_id };
}

// Use download token
export async function useDownloadToken(env: Env, token: string): Promise<void> {
  await env.DB.prepare(`
    UPDATE file_download_tokens 
    SET download_count = download_count + 1, is_used = TRUE
    WHERE token = ?
  `).bind(token).run();
}

// Check file permissions
export async function checkFilePermission(
  env: Env,
  fileId: number,
  userId: number,
  userRole: string,
  permission: 'read' | 'write' | 'delete'
): Promise<boolean> {
  // Check if user owns the file
  const file = await getFileById(env, fileId);
  if (!file) return false;

  if (file.uploaded_by === userId) return true;

  // Check admin permissions
  if (userRole === 'admin') return true;

  // Check faculty permissions for certificates
  if (userRole === 'faculty' && file.category === 'certificate' && permission === 'read') {
    return true;
  }

  // Check explicit permissions
  const explicitPermission = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM file_permissions 
    WHERE file_id = ? 
    AND ((user_id = ?) OR (role = ?))
    AND permission_type = ?
    AND is_active = TRUE
    AND (expires_date IS NULL OR expires_date > datetime('now'))
  `).bind(fileId, userId, userRole, permission).first();

  return (explicitPermission as any)?.count > 0;
}

// Grant file permission
export async function grantFilePermission(
  env: Env,
  fileId: number,
  targetUserId: number | null,
  targetRole: string | null,
  permission: 'read' | 'write' | 'delete',
  grantedBy: number,
  expiresDate?: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO file_permissions (
      file_id, user_id, role, permission_type, granted_by, expires_date
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    fileId,
    targetUserId,
    targetRole,
    permission,
    grantedBy,
    expiresDate || null
  ).run();
}

// Soft delete file
export async function softDeleteFile(env: Env, fileId: number): Promise<void> {
  await env.DB.prepare(`
    UPDATE files 
    SET is_deleted = TRUE, deleted_date = datetime('now')
    WHERE id = ?
  `).bind(fileId).run();
}

// Get file statistics
export async function getFileStatistics(env: Env): Promise<any> {
  const stats = await env.DB.prepare(`
    SELECT * FROM file_statistics
  `).all();

  return stats.results;
}

// Get user file usage
export async function getUserFileUsage(env: Env, userId?: number): Promise<any> {
  let query = `SELECT * FROM user_file_usage`;
  let params: any[] = [];

  if (userId) {
    query += ` WHERE user_id = ?`;
    params.push(userId);
  }

  query += ` ORDER BY total_storage_used DESC`;

  const result = await env.DB.prepare(query).bind(...params).all();
  return result.results;
}

// Helper function to generate secure tokens
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Clean up expired tokens (maintenance function)
export async function cleanupExpiredTokens(env: Env): Promise<number> {
  const result = await env.DB.prepare(`
    DELETE FROM file_download_tokens 
    WHERE expires_date < datetime('now')
  `).run();

  return result.meta.changes as number;
}

// Get recent file activities for audit
export async function getRecentFileActivities(
  env: Env, 
  limit: number = 50,
  userId?: number
): Promise<any[]> {
  let query = `
    SELECT 
      fal.*,
      f.original_name,
      f.category,
      u.full_name as user_name,
      u.email as user_email
    FROM file_access_logs fal
    JOIN files f ON fal.file_id = f.id
    JOIN users u ON fal.accessed_by = u.id
  `;
  
  let params: any[] = [];

  if (userId) {
    query += ` WHERE fal.accessed_by = ?`;
    params.push(userId);
  }

  query += ` ORDER BY fal.access_date DESC LIMIT ?`;
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all();
  return result.results;
}
