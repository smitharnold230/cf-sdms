export function json(body: unknown, status = 200, headers: Record<string,string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers }});
}

export function noContent(): Response { return new Response(null, { status: 204 }); }

export function successResponse(data: any, status = 200): Response {
  return json({ success: true, data }, status);
}

export function errorResponse(message: string, status = 500, code?: string): Response {
  return json({ success: false, error: { message, code } }, status);
}
