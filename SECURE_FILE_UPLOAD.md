# Secure File Upload System Documentation

## Overview

The SDMS now includes a comprehensive secure file upload system using Cloudflare R2 for storing PDF certificates and profile photos. The system provides virus scanning, file validation, secure downloads with signed URLs, and complete audit trails.

## Features

### 🔒 Security Features
- **File Type Validation**: Strict MIME type and extension checking
- **Virus Scanning**: Integrated malware detection with quarantine
- **Content Validation**: Deep inspection of PDF and image files
- **Access Controls**: Role-based permissions with audit logging
- **Signed URLs**: Temporary, secure download links with expiration
- **IP Restrictions**: Optional IP-based access control

### 📁 File Types Supported
- **PDF Certificates**: Up to 10MB, virus scanned, approval workflow
- **Profile Photos**: JPEG, PNG, WebP up to 5MB, automatic optimization

### 🗄️ Database Integration
- **File Metadata**: Complete file information and tracking
- **Access Logs**: Detailed audit trail of all file operations
- **Download Tokens**: Secure temporary access tokens
- **Permissions**: Granular file-level access control

## API Endpoints

### File Upload

#### POST /api/files/upload/certificate
Upload a PDF certificate for submission and approval.

**Authentication**: Required (Student, Faculty, Admin)
**Content-Type**: multipart/form-data

**Form Fields**:
- `file`: PDF file (required, max 10MB)
- `title`: Certificate title (required)
- `description`: Certificate description (required)
- `workshopId`: Associated workshop ID (optional)

**Example**:
```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('title', 'Data Science Workshop Certificate');
formData.append('description', 'Certificate of completion for advanced data science workshop');
formData.append('workshopId', '5');

const response = await fetch('/api/files/upload/certificate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "message": "Certificate uploaded successfully",
  "data": {
    "fileId": 123,
    "certificateId": 456,
    "fileName": "certificate.pdf",
    "secureFileName": "certificate/1/1730000000_certificate.pdf",
    "size": 245760,
    "virusScanStatus": "pending"
  }
}
```

#### POST /api/files/upload/profile
Upload a profile photo.

**Authentication**: Required (All roles)
**Content-Type**: multipart/form-data

**Form Fields**:
- `file`: Image file (required, max 5MB, JPEG/PNG/WebP)

**Example**:
```javascript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('/api/files/upload/profile', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### File Download

#### GET /api/files/:id/download-url
Generate a secure download URL for a file.

**Authentication**: Required
**Parameters**: 
- `id`: File ID
- `expires`: Expiration time in seconds (optional, default 3600)

**Response**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://bucket.r2.dev/path/to/file?expires=...",
    "token": "secure_download_token",
    "fileName": "original_file_name.pdf",
    "fileSize": 245760,
    "mimeType": "application/pdf",
    "expiresIn": 3600,
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

#### GET /api/files/:id/download?token=TOKEN
Download a file using a secure token.

**Authentication**: Required
**Parameters**:
- `id`: File ID
- `token`: Download token from download-url endpoint

**Response**: File stream with appropriate headers

### File Management

#### GET /api/files/list
Get user's uploaded files.

**Authentication**: Required
**Query Parameters**:
- `category`: Filter by category ('certificate' or 'profile')
- `userId`: Target user ID (Admin/Faculty only)

**Response**:
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 123,
        "originalName": "certificate.pdf",
        "fileSize": 245760,
        "mimeType": "application/pdf",
        "category": "certificate",
        "uploadDate": "2024-01-01T10:00:00Z",
        "virusScanStatus": "clean",
        "accessCount": 5,
        "lastAccessed": "2024-01-02T15:30:00Z"
      }
    ],
    "totalCount": 1,
    "totalSize": 245760
  }
}
```

#### DELETE /api/files/:id
Soft delete a file.

**Authentication**: Required (File owner, Admin, or with delete permission)
**Response**:
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Admin Endpoints

#### PUT /api/files/:id/virus-scan
Update virus scan status (Admin only).

**Authentication**: Required (Admin)
**Request Body**:
```json
{
  "fileId": 123,
  "status": "clean",
  "scanId": "scan_12345"
}
```

## File Validation Rules

### PDF Certificates
- **Size**: Maximum 10MB
- **MIME Types**: `application/pdf`
- **Extensions**: `.pdf`
- **Content Checks**:
  - Valid PDF header (`%PDF`)
  - Proper EOF marker
  - No dangerous JavaScript content
  - No embedded executables

### Profile Photos
- **Size**: Maximum 5MB
- **MIME Types**: `image/jpeg`, `image/png`, `image/webp`
- **Extensions**: `.jpg`, `.jpeg`, `.png`, `.webp`
- **Content Checks**:
  - Valid image headers
  - No embedded executable content
  - No suspicious file signatures

## Virus Scanning

The system implements multi-layer security:

1. **File Type Validation**: Strict MIME type checking
2. **Content Inspection**: Deep file format validation
3. **Signature Detection**: Known malware signature detection
4. **Heuristic Analysis**: Suspicious pattern detection
5. **Size Limits**: Protection against zip bombs

### Scan Statuses
- `pending`: File uploaded, scan in progress
- `clean`: File passed all security checks
- `infected`: Malware detected, file quarantined
- `failed`: Scan could not be completed

## Access Control

### Permission Levels
- **read**: View and download file
- **write**: Upload and modify file
- **delete**: Remove file from system

### Default Permissions
- **File Owner**: Full access (read, write, delete)
- **Admin**: Full access to all files
- **Faculty**: Read access to certificate files
- **Students**: Access only to own files

### Permission Grants
Administrators can grant specific permissions:
```sql
-- Grant read permission to specific user
INSERT INTO file_permissions (file_id, user_id, permission_type, granted_by)
VALUES (123, 456, 'read', 1);

-- Grant read permission to all faculty
INSERT INTO file_permissions (file_id, role, permission_type, granted_by)
VALUES (123, 'faculty', 'read', 1);
```

## Database Schema

### Files Table
```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('certificate', 'profile')),
    uploaded_by INTEGER NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    virus_scan_status TEXT DEFAULT 'pending',
    virus_scan_id TEXT,
    scan_date TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_date TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

### File Access Logs
```sql
CREATE TABLE file_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    accessed_by INTEGER NOT NULL,
    access_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'upload')),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id),
    FOREIGN KEY (accessed_by) REFERENCES users(id)
);
```

## Security Best Practices

### For Developers
1. **Always validate files** before processing
2. **Use signed URLs** for sensitive downloads
3. **Log all file access** for audit trails
4. **Implement rate limiting** on upload endpoints
5. **Scan files asynchronously** to avoid blocking

### For Administrators
1. **Monitor virus scan status** regularly
2. **Review file access logs** for suspicious activity
3. **Set appropriate permissions** for sensitive files
4. **Clean up expired tokens** periodically
5. **Monitor storage usage** and quotas

## Error Handling

### Common Error Codes
- `400`: Invalid file type, size exceeded, validation failed
- `401`: Authentication required
- `403`: Access denied, virus detected
- `404`: File not found
- `410`: Endpoint deprecated
- `413`: File too large
- `422`: Virus scan pending

### Example Error Response
```json
{
  "success": false,
  "message": "File validation failed",
  "errors": [
    "Invalid file type. Allowed types: application/pdf",
    "File too large. Maximum size: 10MB"
  ]
}
```

## Integration Examples

### Frontend Upload Component
```javascript
class SecureFileUpload {
  async uploadFile(file, category, metadata = {}) {
    // Validate file client-side
    if (!this.validateFile(file, category)) {
      throw new Error('Invalid file');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    for (const [key, value] of Object.entries(metadata)) {
      formData.append(key, value);
    }

    const response = await fetch(`/api/files/upload/${category}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });

    return await response.json();
  }

  async getDownloadUrl(fileId, expiresIn = 3600) {
    const response = await fetch(`/api/files/${fileId}/download-url?expires=${expiresIn}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return await response.json();
  }
}
```

### Certificate Submission Workflow
```javascript
async function submitCertificate(certificateFile, workshopId) {
  try {
    // 1. Upload file
    const uploadResult = await uploader.uploadFile(certificateFile, 'certificate', {
      title: 'Workshop Completion Certificate',
      description: 'Certificate for completing the workshop',
      workshopId: workshopId.toString()
    });

    // 2. Wait for virus scan
    await waitForVirusScan(uploadResult.data.fileId);

    // 3. Submit for approval
    // This is handled automatically by the upload endpoint

    return uploadResult;
  } catch (error) {
    console.error('Certificate submission failed:', error);
    throw error;
  }
}
```

## Monitoring and Maintenance

### Health Checks
- Monitor virus scan queue length
- Check R2 storage usage and costs
- Review failed upload rates
- Audit file access patterns

### Maintenance Tasks
- Clean up expired download tokens
- Archive old file access logs
- Remove deleted files from R2
- Update virus scan definitions

### Performance Optimization
- Use R2 multipart uploads for large files
- Implement client-side compression
- Cache file metadata in D1
- Use CDN for public profile photos

This secure file upload system provides enterprise-grade security and functionality for the SDMS, ensuring that all file operations are secure, auditable, and efficient.