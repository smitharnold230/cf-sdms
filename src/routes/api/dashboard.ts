
import { AuthContext } from '../../middleware/auth';
import { json } from '../../utils/errors';

export async function getStudentDashboard(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const userId = authContext.userId;
  
  try {
    // Simplified dashboard - just return basic user info for now
    const user = await env.DB.prepare(`
      SELECT id, email, full_name, role, created_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    // Get user points safely
    const userPoints = await env.DB.prepare(`
      SELECT total_points
      FROM user_points
      WHERE user_id = ?
    `).bind(userId).first();

    // Get certificate counts by status
    const certificateStats = await env.DB.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(*) as total
      FROM certificates
      WHERE user_id = ?
    `).bind(userId).first();

    // Get upcoming events/workshops
    const upcomingWorkshops = await env.DB.prepare(`
      SELECT id, title, description, registration_deadline
      FROM workshops
      WHERE registration_deadline > datetime('now')
      ORDER BY registration_deadline
      LIMIT 5
    `).bind().all();

    return json({
      success: true,
      data: {
        user,
        totalPoints: userPoints?.total_points || 0,
        approvedCertificates: certificateStats?.approved || 0,
        pendingCertificates: certificateStats?.pending || 0,
        rejectedCertificates: certificateStats?.rejected || 0,
        certificateCount: certificateStats?.total || 0,
        upcomingWorkshops: upcomingWorkshops?.results || [],
        message: 'Dashboard data retrieved successfully'
      }
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return json({ error: 'Failed to load dashboard', details: error.message }, 500);
  }
}
