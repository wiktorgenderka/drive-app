import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 characters'),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith('pk.', 'NEXT_PUBLIC_MAPBOX_TOKEN must start with pk.'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

function validateEnv() {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`\n[env] Missing or invalid environment variables:\n${missing}\n`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration. See logs above.');
    }
  }
  return result.data ?? {};
}

if (typeof window === 'undefined') {
  validateEnv();
}
