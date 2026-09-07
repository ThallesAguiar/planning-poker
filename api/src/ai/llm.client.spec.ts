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

  it('discuss pull returns a short question to dissenting voters', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"message": "Voce votou 8, a maioria votou 3. Pode explicar?"}' } }] }) }));
    const result = await new LlmClient().discuss({ action: 'pull', story: 'Login', votes: [{ participantName: 'Ana', value: '8' }], deck: [1, 3, 5, 8] });
    expect(result.message).toContain('explicar');
    expect(result.suggestedNextStep).toBeUndefined();
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it('discuss summarize returns a summary and suggested next step', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"message": "A equipe debateu o escopo.", "suggestedNextStep": "revotar"}' } }] }) }));
    const result = await new LlmClient().discuss({ action: 'summarize', story: 'Login', votes: [{ participantName: 'Ana', value: '3' }], context: 'debate', deck: [1, 3, 5, 8] });
    expect(result.message).toContain('escopo');
    expect(result.suggestedNextStep).toBe('revotar');
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it('discuss rejects output without a message', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"message": ""}' } }] }) }));
    await expect(new LlmClient().discuss({ action: 'pull', story: 'x', votes: [], deck: [1, 3] })).rejects.toThrow('AI_INVALID_OUTPUT');
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});
