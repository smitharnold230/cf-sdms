import { z } from 'zod';
import { badRequest } from './errors';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['admin','faculty','student']).optional().default('student')
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const UserUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  role: z.enum(['admin','faculty','student']).optional()
});

export const CertificateCreateSchema = z.object({
  user_id: z.number().int().positive(),
  title: z.string().min(1),
  issued_date: z.string().min(4)
});

export function parseBody<T>(schema: z.ZodType<T>): (body: unknown) => T {
  return (body: unknown) => {
    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues.map((issue: z.ZodIssue) => ({ path: issue.path, message: issue.message }));
      badRequest('Validation failed', issues);
    }
    return result.data as T;
  };
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch {
    badRequest('Invalid JSON');
  }
  return parseBody(schema)(data);
}
