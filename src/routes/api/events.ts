import { AuthContext } from '../../middleware/auth';
import { readJson } from '../../utils/validation';
import { json, badRequest } from '../../utils/errors';
import { z } from 'zod';

const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  start_datetime: z.string(),
  end_datetime: z.string(),
  location: z.string().optional(),
  category: z.string().optional()
});

const CreateWorkshopSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  presenter: z.string().optional(),
  capacity: z.number().optional(),
  start_datetime: z.string(),
  end_datetime: z.string(),
  registration_deadline: z.string().optional(),
  points_awarded: z.number().min(0)
});

export async function createEvent(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const body: z.infer<typeof CreateEventSchema> = await readJson(request, CreateEventSchema);
  
  // Insert event into database
  const result = await env.DB.prepare(`
    INSERT INTO events (title, description, start_datetime, end_datetime, location, category, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.title,
    body.description,
    body.start_datetime,
    body.end_datetime,
    body.location || null,
    body.category || null,
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
}

export async function createWorkshop(request: Request, env: Env, authContext: AuthContext): Promise<Response> {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  if (!eventId) {
    return badRequest('Event ID is required');
  }
  
  const body: z.infer<typeof CreateWorkshopSchema> = await readJson(request, CreateWorkshopSchema);
  
  // Verify event exists
  const event = await env.DB.prepare(`
    SELECT id FROM events WHERE id = ?
  `).bind(eventId).first();
  
  if (!event) {
    return badRequest('Event not found');
  }
  
  // Insert workshop into database
  const result = await env.DB.prepare(`
    INSERT INTO workshops (event_id, title, description, presenter, capacity, start_datetime, end_datetime, registration_deadline, points_awarded, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    eventId,
    body.title,
    body.description,
    body.presenter || null,
    body.capacity || null,
    body.start_datetime,
    body.end_datetime,
    body.registration_deadline || null,
    body.points_awarded,
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
