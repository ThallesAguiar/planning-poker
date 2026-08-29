import { describe, expect, it, vi } from 'vitest';
import { LlmClient } from './llm.client.js';

describe('LlmClient', () => {
  it('supports OpenAI-compatible providers with configurable endpoint and model', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key'); vi.stubEnv('LLM_BASE_URL', 'https://api.example.test/v1'); vi.stubEnv('LLM_MODEL', 'provider/model');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"vote": 5, "justification": "complexity moderate"}' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await new LlmClient().vote({ story: 'Implement login', role: 'Dev', deck: [1, 3, 5] });
    expect(result).toEqual({ vote: 5, justification: 'complexity moderate' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/v1/chat/completions');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('provider/model');
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it('rejects provider output outside allowed deck', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"vote": 99, "justification": "bad"}' } }] }) }));
    await expect(new LlmClient().vote({ story: 'x', role: 'Dev', deck: [1, 3, 5] })).rejects.toThrow('AI_INVALID_OUTPUT');
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});
