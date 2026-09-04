import { z } from 'zod';

// Define environment schema with both required and optional fields
const EnvSchema = z.object({
  // Required environment variables
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters'),
  FB_GRAPH_API_VERSION: z.string().default('v20'),

  // Phase 3: Facebook Integration (Optional in dev, required in production)
  FACEBOOK_PAGE_ID: z.string().min(1, 'FACEBOOK_PAGE_ID must be non-empty').optional(),
  FACEBOOK_ACCESS_TOKEN: z.string().optional(),

  // Phase 3: Pinterest OAuth (Optional in dev, required in production)
  PINTEREST_APP_ID: z.string().optional(),
  PINTEREST_APP_SECRET: z.string().optional(),

  // Phase 3: Token Encryption (Required for production Pinterest token storage)
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

/**
 * Clear the cached environment (for testing only).
 * @internal
 */
export function __clearEnvCache(): void {
  cachedEnv = null;
}

/**
 * Validate and return environment variables.
 * Throws ZodError if required variables are missing or invalid.
 * Never logs secret values.
 */
export function getValidatedEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const missingVars = result.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ');
    throw new Error(
      `Environment validation failed. Missing or invalid: ${missingVars}. ` +
        `See .env.example for required variables.`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Check if all required environment variables are configured.
 * Returns true if env is valid, false otherwise.
 * Does not throw; suitable for health checks.
 */
export function isEnvConfigured(): boolean {
  try {
    getValidatedEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get non-secret environment information for diagnostics.
 * Never returns secret values.
 */
export function getEnvInfo(): {
  supabaseConfigured: boolean;
  facebookConfigured: boolean;
  pinterestConfigured: boolean;
  nodeEnv: string;
} {
  const env = process.env;
  return {
    supabaseConfigured: Boolean(env['SUPABASE_URL'] && env['SUPABASE_SERVICE_ROLE_KEY']),
    facebookConfigured: Boolean(env['FACEBOOK_PAGE_ID'] && env['FACEBOOK_ACCESS_TOKEN']),
    pinterestConfigured: Boolean(env['PINTEREST_APP_ID'] && env['PINTEREST_ACCESS_TOKEN']),
    nodeEnv: env['NODE_ENV'] || 'development',
  };
}
