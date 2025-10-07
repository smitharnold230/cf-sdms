
import { AuthContext } from '../../middleware/auth';
import { json, badRequest, notFound } from '../../utils/errors';

export async function approveCertificate(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const certificateId = url.pathname.split('/').pop();
  
  if (!certificateId) {
    return badRequest('Certificate ID is required');
  }
  
  // Get certificate details with file information
  const certificate = await env.DB.prepare(`
    SELECT 
      c.id, 
      c.user_id, 
      c.title, 
      c.status,
      c.file_id,
      f.virus_scan_status
    FROM certificates c
    LEFT JOIN files f ON c.file_id = f.id
    WHERE c.id = ?
  `).bind(certificateId).first();
  
  if (!certificate) {
    return notFound('Certificate not found');
  }
  
  if (certificate.status !== 'pending') {
    return badRequest('Certificate is not in pending status');
  }

  // Check if file has been scanned and is clean
  if (certificate.file_id && certificate.virus_scan_status !== 'clean') {
    return badRequest('Certificate file must be virus-free before approval');
  }
  
  // Approve certificate
  const updateResult = await env.DB.prepare(`
    UPDATE certificates 
    SET status = 'approved', 
        reviewed_by = ?, 
        review_date = datetime('now'),
        review_feedback = 'Approved by faculty'
    WHERE id = ?
  `).bind(authContext.userId, certificateId).run();
  
  if (!updateResult.success) {
    return badRequest('Failed to approve certificate');
  }
  
  // Award points to the user
  const pointsResult = await env.DB.prepare(`
    INSERT INTO points (user_id, certificate_id, points, earned_date)
    SELECT c.user_id, c.id, w.points_awarded, datetime('now')
    FROM certificates c
    JOIN workshops w ON c.workshop_id = w.id
    WHERE c.id = ?
  `).bind(certificateId).run();
  
  // Create notification for the user
  await env.DB.prepare(`
    INSERT INTO notifications (user_id, type, title, message, read_status)
    VALUES (?, 'certificate_approved', 'Certificate Approved', 
            'Your certificate has been approved and points have been awarded.', false)
  `).bind(certificate.user_id).run();
  
  return json({
    success: true,
    message: 'Certificate approved successfully'
  });
}

export async function rejectCertificate(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const certificateId = url.pathname.split('/').pop();
  
  if (!certificateId) {
    return badRequest('Certificate ID is required');
  }
  
  // Parse request body for feedback
  let feedback = 'Certificate rejected by faculty';
  try {
    const body = await request.json() as { feedback?: string };
    if (body.feedback) {
      feedback = body.feedback;
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
        reviewed_by = ?, 
        review_date = datetime('now'),
        review_feedback = ?
    WHERE id = ?
  `).bind(authContext.userId, feedback, certificateId).run();
  
  if (!updateResult.success) {
    return badRequest('Failed to reject certificate');
  }
  
  // Create notification for the user
  await env.DB.prepare(`
    INSERT INTO notifications (user_id, type, title, message, read_status)
    VALUES (?, 'certificate_rejected', 'Certificate Rejected', 
            'Your certificate has been rejected. Please check the feedback and resubmit if needed.', false)
  `).bind(certificate.user_id).run();
  
  return json({
    success: true,
    message: 'Certificate rejected successfully'
  });
}

export async function getPendingCertificates(request: Request, env: Env): Promise<Response> {
  const certificates = await env.DB.prepare(`
    SELECT 
      c.id,
      c.title,
      c.description,
      c.submission_date,
      u.full_name as student_name,
      u.email as student_email,
      w.title as workshop_title,
      w.points_awarded,
      e.title as event_title,
      f.id as file_id,
      f.original_name as file_name,
      f.file_size,
      f.mime_type,
      f.virus_scan_status,
      f.upload_date
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN workshops w ON c.workshop_id = w.id
    LEFT JOIN events e ON w.event_id = e.id
    LEFT JOIN files f ON c.file_id = f.id AND f.is_deleted = FALSE
    WHERE c.status = 'pending'
    ORDER BY c.submission_date ASC
  `).all();
  
  return json({
    success: true,
    data: certificates.results
  });
}
