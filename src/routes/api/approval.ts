
import { AuthContext } from '../../middleware/auth';
import { json, badRequest, notFound } from '../../utils/errors';

// Cloudflare Workers Environment
interface Env {
  DB: any;
  [key: string]: any;
}

export async function approveCertificate(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const certificateId = url.pathname.split('/').pop();
  
  if (!certificateId) {
    return badRequest('Certificate ID is required');
  }
  
  try {
    // Get certificate details
    const certificate = await env.DB.prepare(`
      SELECT id, user_id, title, status
      FROM certificates 
      WHERE id = ?
    `).bind(certificateId).first();
    
    if (!certificate) {
      return notFound('Certificate not found');
    }
    
    if (certificate.status !== 'pending') {
      return badRequest('Certificate is not in pending status');
    }
    
    // Approve certificate
    const updateResult = await env.DB.prepare(`
      UPDATE certificates 
      SET status = 'approved', 
          reviewer_id = ?, 
          reviewed_at = datetime('now'),
          rejection_reason = NULL
      WHERE id = ?
    `).bind(authContext.userId, certificateId).run();
    
    if (!updateResult.success) {
      return badRequest('Failed to approve certificate');
    }
    
    return json({
      success: true,
      message: 'Certificate approved successfully'
    });
  } catch (error) {
    console.error('Error approving certificate:', error);
    return badRequest('Failed to approve certificate');
  }
}

export async function rejectCertificate(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const certificateId = url.pathname.split('/').pop();
  
  if (!certificateId) {
    return badRequest('Certificate ID is required');
  }
  
  try {
    // Parse request body for feedback
    let feedback = 'Certificate rejected by faculty';
    try {
      const body = await request.json() as { reason?: string };
      if (body.reason) {
        feedback = body.reason;
      }
    } catch (e) {
      // Use default feedback if body parsing fails
    }
    
    // Get certificate details
    const certificate = await env.DB.prepare(`
      SELECT id, user_id, title, status
      FROM certificates 
      WHERE id = ?
    `).bind(certificateId).first();
    
    if (!certificate) {
      return notFound('Certificate not found');
    }
    
    if (certificate.status !== 'pending') {
      return badRequest('Certificate is not in pending status');
    }
    
    // Reject certificate
    const updateResult = await env.DB.prepare(`
      UPDATE certificates 
      SET status = 'rejected', 
          reviewer_id = ?, 
          reviewed_at = datetime('now'),
          rejection_reason = ?
      WHERE id = ?
    `).bind(authContext.userId, feedback, certificateId).run();
    
    if (!updateResult.success) {
      return badRequest('Failed to reject certificate');
    }
    
    return json({
      success: true,
      message: 'Certificate rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting certificate:', error);
    return badRequest('Failed to reject certificate');
  }
}

export async function getPendingCertificates(request: Request, env: Env): Promise<Response> {
  try {
    const certificates = await env.DB.prepare(`
      SELECT 
        c.id,
        c.title,
        c.issued_date,
        c.status,
        c.created_at,
        c.user_id,
        u.full_name as student_name,
        u.email as student_email
      FROM certificates c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC
    `).all();
    
    return json({
      success: true,
      certificates: certificates.results || []
    });
  } catch (error) {
    console.error('Error fetching pending certificates:', error);
    return json({
      success: false,
      certificates: [],
      error: 'Failed to fetch pending certificates'
    });
  }
}
