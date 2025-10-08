import { AuthContext } from '../../middleware/auth';
import { readJson } from '../../utils/validation';
import { json, badRequest } from '../../utils/errors';
import { z } from 'zod';

// Cloudflare Workers Environment
interface Env {
  DB: any;
  [key: string]: any;
}

const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  event_date: z.string(),
  location: z.string(),
  max_participants: z.number().optional()
});

const CreateWorkshopSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  workshop_date: z.string(),
  location: z.string(),
  duration_hours: z.number().min(1),
  max_participants: z.number().optional()
});

export async function createEvent(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  try {
    const body: z.infer<typeof CreateEventSchema> = await readJson(request, CreateEventSchema);
    
    // Use event_date as both start and end time for now (can be enhanced later)
    const eventDate = new Date(body.event_date);
    const endDate = new Date(eventDate.getTime() + (2 * 60 * 60 * 1000)); // Default 2 hours duration
    
    // Insert event into database
    const result = await env.DB.prepare(`
      INSERT INTO events (title, description, start_datetime, end_datetime, location, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.title,
      body.description,
      body.event_date,
      endDate.toISOString(),
      body.location,
      authContext.userId
    ).run();
    
    if (!result.success) {
      return badRequest('Failed to create event');
    }
    
    return json({
      success: true,
      message: 'Event created successfully',
      eventId: result.meta.last_row_id
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return badRequest('Failed to create event');
  }
}

export async function createWorkshop(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  try {
    const body: z.infer<typeof CreateWorkshopSchema> = await readJson(request, CreateWorkshopSchema);
    
    // Calculate end datetime based on duration
    const startDate = new Date(body.workshop_date);
    const endDate = new Date(startDate.getTime() + (body.duration_hours * 60 * 60 * 1000));
    
    // Insert workshop into database (standalone workshop, no event_id required)
    const result = await env.DB.prepare(`
      INSERT INTO workshops (title, description, start_datetime, end_datetime, capacity, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.title,
      body.description,
      body.workshop_date,
      endDate.toISOString(),
      body.max_participants || null,
      authContext.userId
    ).run();
    
    if (!result.success) {
      return badRequest('Failed to create workshop');
    }
    
    return json({
      success: true,
      message: 'Workshop created successfully',
      workshopId: result.meta.last_row_id
    });
  } catch (error) {
    console.error('Error creating workshop:', error);
    return badRequest('Failed to create workshop');
  }
}

export async function getEvents(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare(`
    SELECT 
      e.id,
      e.title,
      e.description,
      e.start_datetime,
      e.end_datetime,
      e.location,
      e.category,
      e.created_at,
      u.full_name as created_by_name,
      COUNT(w.id) as workshop_count
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN workshops w ON e.id = w.event_id
    GROUP BY e.id
    ORDER BY e.start_datetime DESC
  `).all();
  
  return json({
    success: true,
    data: events.results
  });
}
