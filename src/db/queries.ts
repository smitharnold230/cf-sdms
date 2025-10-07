

export interface UserRecord {
  id: number; email: string; role: string; full_name: string; created_at: string; updated_at: string;
}

export async function findUserByEmail(env: Env, email: string): Promise<(UserRecord & { password_hash: string }) | null> {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE email = ?');
  const row = await stmt.bind(email).first<UserRecord & { password_hash: string }>();
  return row || null;
}

export async function createUser(env: Env, data: { email: string; password_hash: string; role: string; full_name: string }): Promise<UserRecord> {
  const stmt = env.DB.prepare('INSERT INTO users (email,password_hash,role,full_name) VALUES (?,?,?,?) RETURNING id,email,role,full_name,created_at,updated_at');
  const row = await stmt.bind(data.email, data.password_hash, data.role, data.full_name).first<UserRecord>();
  if (!row) throw new Error('Failed to insert user');
  return row;
}

export async function getUser(env: Env, id: number): Promise<UserRecord | null> {
  const row = await env.DB.prepare('SELECT id,email,role,full_name,created_at,updated_at FROM users WHERE id = ?').bind(id).first<UserRecord>();
  return row || null;
}

export async function listUsers(env: Env): Promise<UserRecord[]> {
  const { results } = await env.DB.prepare('SELECT id,email,role,full_name,created_at,updated_at FROM users ORDER BY id DESC').all<UserRecord>();
  return results || [];
}

export async function updateUser(env: Env, id: number, fields: Partial<Pick<UserRecord,'full_name'|'role'>>): Promise<UserRecord | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (fields.full_name) { sets.push('full_name = ?'); vals.push(fields.full_name); }
  if (fields.role) { sets.push('role = ?'); vals.push(fields.role); }
  if (!sets.length) return getUser(env, id);
  const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ? RETURNING id,email,role,full_name,created_at,updated_at`;
  vals.push(id);
  const row = await env.DB.prepare(sql).bind(...vals).first<UserRecord>();
  return row || null;
}

export async function deleteUser(env: Env, id: number): Promise<boolean> {
  const { success } = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return success; 
}

export interface CertificateRecord { id: number; user_id: number; object_key: string; title: string; issued_date: string; created_at: string; }

export async function createCertificate(env: Env, data: { user_id: number; object_key: string; title: string; issued_date: string }): Promise<CertificateRecord> {
  const stmt = env.DB.prepare('INSERT INTO certificates (user_id,object_key,title,issued_date) VALUES (?,?,?,?) RETURNING id,user_id,object_key,title,issued_date,created_at');
  const row = await stmt.bind(data.user_id, data.object_key, data.title, data.issued_date).first<CertificateRecord>();
  if (!row) throw new Error('Failed to insert certificate');
  return row;
}

export async function listCertificatesForUser(env: Env, userId: number): Promise<CertificateRecord[]> {
  const { results } = await env.DB.prepare('SELECT id,user_id,object_key,title,issued_date,created_at FROM certificates WHERE user_id = ? ORDER BY id DESC').bind(userId).all<CertificateRecord>();
  return results || [];
}

export async function getCertificate(env: Env, id: number): Promise<CertificateRecord | null> {
  const row = await env.DB.prepare('SELECT id,user_id,object_key,title,issued_date,created_at FROM certificates WHERE id = ?').bind(id).first<CertificateRecord>();
  return row || null;
}

export async function deleteCertificate(env: Env, id: number): Promise<boolean> {
  const cert = await getCertificate(env, id);
  if (!cert) return false;
  const { success } = await env.DB.prepare('DELETE FROM certificates WHERE id = ?').bind(id).run();
  if (success) {
    await env.CERT_BUCKET.delete(cert.object_key);
  }
  return success;
}
