
import { readJson } from '../../utils/validation';
import { findUserByEmail } from '../../db/queries';
import { verifyPassword } from '../../utils/hash';
import { signJWT } from '../../utils/jwt';
import { json, unauthorized } from '../../utils/errors';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request, LoginSchema);
  
  // Find user by email
  const user = await findUserByEmail(env, body.email);
  if (!user) {
    return unauthorized('Invalid credentials');
  }
  
  // Verify password
  const isValidPassword = await verifyPassword(body.password, user.password_hash);
  if (!isValidPassword) {
    return unauthorized('Invalid credentials');
  }
  
  // Generate JWT token
  const token = await signJWT(
    { 
      sub: user.id, 
      role: user.role, 
      email: user.email,
      iat: Math.floor(Date.now() / 1000)
    }, 
    env
  );
  
  // Return user data without password hash
  const userData = {
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
  
  return json({
    success: true,
    message: 'Login successful',
    token,
    user: userData
  });
}
