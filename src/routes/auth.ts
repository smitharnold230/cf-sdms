
import { readJson, RegisterSchema, LoginSchema } from '../utils/validation';
import { findUserByEmail, createUser } from '../db/queries';
import { hashPassword, verifyPassword } from '../utils/hash';
import { signJWT } from '../utils/jwt';
import { badRequest, json, unauthorized } from '../utils/errors';

export async function register(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request, RegisterSchema);
  const existing = await findUserByEmail(env, body.email);
  if (existing) badRequest('Email already registered');
  const password_hash = await hashPassword(body.password);
  const user = await createUser(env, { email: body.email, password_hash, role: body.role || 'student', full_name: body.full_name });
  return json({ user });
}

export async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request, LoginSchema);
  const user = await findUserByEmail(env, body.email);
  if (!user) unauthorized('Invalid credentials');
  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) unauthorized('Invalid credentials');
  const token = await signJWT({ sub: user.id, role: user.role, email: user.email }, env);
  return json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
}
