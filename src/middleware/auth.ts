import { verifyJWT } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/errors';

export interface AuthContext {
  userId: number;
  role: 'admin' | 'faculty' | 'student';
  email: string;
}

export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) unauthorized('Missing bearer token');
  const token = auth.slice('Bearer '.length).trim();
  const { payload } = await verifyJWT(token, env);
  if (!payload || typeof payload.sub !== 'number') unauthorized('Invalid token payload');
  return { userId: payload.sub, role: payload.role, email: payload.email } as AuthContext;
}

export function requireRole(ctx: AuthContext, roles: AuthContext['role'][]): void {
  if (!roles.includes(ctx.role)) forbidden('Insufficient role');
}
