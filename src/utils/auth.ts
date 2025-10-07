import { authenticate, AuthContext } from '../middleware/auth';


export interface AuthResult {
  success: boolean;
  user?: AuthContext;
  error?: string;
}

export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
  try {
    const user = await authenticate(request, env);
    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}
