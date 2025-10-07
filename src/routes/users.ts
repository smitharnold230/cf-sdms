
import { listUsers, getUser, updateUser, deleteUser } from '../db/queries';
import { UserUpdateSchema, readJson } from '../utils/validation';
import { json, notFound } from '../utils/errors';

export async function list(env: Env): Promise<Response> {
  const users = await listUsers(env);
  return json({ users });
}

export async function detail(env: Env, id: number): Promise<Response> {
  const user = await getUser(env, id);
  if (!user) notFound('User not found');
  return json({ user });
}

export async function update(env: Env, id: number, request: Request): Promise<Response> {
  const body = await readJson(request, UserUpdateSchema);
  const user = await updateUser(env, id, body as any);
  if (!user) notFound('User not found');
  return json({ user });
}

export async function remove(env: Env, id: number): Promise<Response> {
  const ok = await deleteUser(env, id);
  return json({ deleted: ok });
}
