
import { AuthContext } from '../../middleware/auth';
import { json } from '../../utils/errors';
import { 
  getSystemHealthMetrics, 
  getMonthlyTrends, 
  getTopPerformers, 
  getFacultyWorkload,
  getWorkshopParticipation,
  calculateUserPoints
} from '../../utils/analytics';

export async function getSystemAnalytics(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  // Get system health metrics
  const systemHealth = await getSystemHealthMetrics(env);
  
  // Get monthly trends
  const monthlyTrends = await getMonthlyTrends(env, 12);
  
  // Get top performing students
  const topStudents = await getTopPerformers(env, 10);
  
  // Get faculty workload statistics
  const facultyWorkload = await getFacultyWorkload(env);
  
  // Get workshop participation data
  const workshopParticipation = await getWorkshopParticipation(env);
  
  // User distribution by role
  const userDistribution = await env.DB.prepare(`
    SELECT 
      role,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) as percentage
    FROM users
    GROUP BY role
  `).all();
  
  // Recent system activity
  const recentActivity = await env.DB.prepare(`
    SELECT 
      'certificate_submission' as activity_type,
      c.title as title,
      u.full_name as user_name,
      u.role as user_role,
      c.created_at as activity_date
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    WHERE c.created_at > datetime('now', '-7 days')
    
    UNION ALL
    
    SELECT 
      'certificate_review' as activity_type,
      c.title as title,
      u.full_name as user_name,
      'reviewer' as user_role,
      c.reviewed_at as activity_date
    FROM certificates c
    JOIN users u ON c.reviewer_id = u.id
    WHERE c.reviewed_at > datetime('now', '-7 days')
    
    ORDER BY activity_date DESC
    LIMIT 50
  `).all();
  
  return json({
    success: true,
    data: {
      systemHealth,
      monthlyTrends,
      topStudents,
      facultyWorkload,
      workshopParticipation,
      userDistribution: userDistribution.results,
      recentActivity: recentActivity.results
    }
  });
}

export async function getUserAnalytics(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  try {
    if (!userId) {
      // Return analytics for the authenticated user
      const userStats = await calculateUserPoints(env, authContext.userId);
      
      const userActivity = await env.DB.prepare(`
        SELECT 
          c.title,
          c.created_at,
          c.status,
          c.rejection_reason as review_feedback
        FROM certificates c
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).bind(authContext.userId).all();
      
      const pointsHistory = await env.DB.prepare(`
        SELECT 
          strftime('%Y-%m', p.created_at) as month,
          SUM(p.points) as points_earned,
          COUNT(p.id) as certificates_approved
        FROM points_ledger p
        WHERE p.user_id = ?
        GROUP BY strftime('%Y-%m', p.created_at)
        ORDER BY month DESC
        LIMIT 12
      `).bind(authContext.userId).all();
      
      return json({
        success: true,
        data: {
          ...userStats,
          activity: userActivity.results || [],
          pointsHistory: pointsHistory.results || []
        }
      });
    }
  
    // Admin can view any user's analytics
    if (authContext.role !== 'admin') {
      return json({
        success: false,
        message: 'Insufficient permissions'
      }, 403);
    }
    
    // Get analytics for specified user
    const userDetails = await env.DB.prepare(`
      SELECT id, email, full_name, role, created_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();
    
    if (!userDetails) {
      return json({
        success: false,
        message: 'User not found'
      }, 404);
    }
    
    const userStats = await calculateUserPoints(env, Number(userId));
    
    const userActivity = await env.DB.prepare(`
      SELECT 
        c.title,
        c.submission_date,
        c.status,
        c.review_feedback,
        w.points_awarded,
        w.title as workshop_title,
        e.title as event_title
      FROM certificates c
      LEFT JOIN workshops w ON c.workshop_id = w.id
      LEFT JOIN events e ON w.event_id = e.id
      WHERE c.user_id = ?
      ORDER BY c.submission_date DESC
    `).bind(userId).all();
    
    const pointsHistory = await env.DB.prepare(`
      SELECT 
        strftime('%Y-%m', p.created_at) as month,
        SUM(p.points) as points_earned,
        COUNT(p.id) as certificates_approved
      FROM points_ledger p
      WHERE p.user_id = ?
      GROUP BY strftime('%Y-%m', p.created_at)
      ORDER BY month DESC
      LIMIT 12
    `).bind(userId).all();
    
    return json({
      success: true,
      data: {
        user: userDetails,
        ...userStats,
        activity: userActivity.results || [],
        pointsHistory: pointsHistory.results || []
      }
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return json({
      success: false,
      message: 'Failed to retrieve analytics',
      error: error.message
    }, 500);
  }
}
