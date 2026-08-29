export function validateEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET === 'change-me')) {
    throw new Error('JWT_SECRET must be configured in production');
  }

  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwtSecret: env.JWT_SECRET ?? 'change-me',
    llmApiKey: env.LLM_API_KEY,
    llmBaseUrl: env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1',
    llmModel: env.LLM_MODEL ?? 'openai/gpt-4o-mini',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS ?? 10000),
    llmMaxRequestsPerRound: Number(env.LLM_MAX_REQUESTS_PER_ROUND ?? 1),
  };
}
