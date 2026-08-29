import { describe, expect, it, vi } from 'vitest';
import { LlmClient } from './llm.client.js';

describe('LLM failure mapping', () => {
  it('reports missing key without fabricating a vote', async () => {
    vi.stubEnv('LLM_API_KEY', '');
    await expect(new LlmClient().vote({ story: 'x', role: 'IA_Agente', deck: [1] })).rejects.toThrow('AI_UNAVAILABLE');
    vi.unstubAllEnvs();
  });

  it('maps aborted provider request to AI_TIMEOUT', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    await expect(new LlmClient().vote({ story: 'x', role: 'IA_Agente', deck: [1] })).rejects.toThrow('AI_TIMEOUT');
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});
