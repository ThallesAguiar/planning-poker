import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type LlmVoteRequest = { story: string; role: string; context?: string; deck: Array<number | string> };
export type LlmVoteResponse = { vote: number | string; justification: string };
export type LlmSummarizeRequest = { stories: string[]; context?: string };
export type LlmSummarizeResponse = { overallSummary: string; perStory: { title: string; summary: string; suggestedTasks: string[] }[] };

@Injectable()
export class LlmClient {
  private readonly apiKey = process.env.LLM_API_KEY;
  private readonly baseUrl = (process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  private readonly model = process.env.LLM_MODEL ?? 'openai/gpt-4o-mini';
  private readonly timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 10_000);

  async vote(input: LlmVoteRequest): Promise<LlmVoteResponse> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const prompt = JSON.stringify({ story: input.story.slice(0, 2_000), role: input.role.slice(0, 120), context: (input.context ?? '').slice(-4_000), deck: input.deck });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, temperature: 0.2, max_tokens: 300, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return only JSON: {"vote": <deck value>, "justification": "short reason"}.' }, { role: 'user', content: prompt }] }), signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
      const body = await response.json() as any;
      const text = body?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      if (!Object.hasOwn(parsed, 'vote') || !input.deck.some((value) => String(value) === String(parsed.vote)) || typeof parsed.justification !== 'string') throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
      return { vote: input.deck.find((value) => String(value) === String(parsed.vote))!, justification: parsed.justification.slice(0, 500) };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if ((error as Error)?.name === 'AbortError') throw new ServiceUnavailableException('AI_TIMEOUT');
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    } finally { clearTimeout(timeout); }
  }

  async summarize(input: LlmSummarizeRequest): Promise<LlmSummarizeResponse> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const prompt = JSON.stringify({ stories: (input.stories ?? []).slice(0, 40), context: (input.context ?? '').slice(-4000) });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, temperature: 0.3, max_tokens: 1400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return only JSON: {"overallSummary": "one short paragraph", "perStory": [{"title": "story title", "summary": "what this story concluded", "suggestedTasks": ["next step]", "another next step"]}]}.' }, { role: 'user', content: prompt }] }), signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
      const body = await response.json() as any;
      const text = body?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      if (typeof parsed?.overallSummary !== 'string' || !Array.isArray(parsed?.perStory)) throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
      return {
        overallSummary: parsed.overallSummary.slice(0, 1200),
        perStory: parsed.perStory.slice(0, 40).map((item: any) => ({
          title: String(item?.title ?? '').slice(0, 160),
          summary: String(item?.summary ?? '').slice(0, 600),
          suggestedTasks: (Array.isArray(item?.suggestedTasks) ? item.suggestedTasks : []).slice(0, 8).map((task: any) => String(task).slice(0, 200)),
        })),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if ((error as Error)?.name === 'AbortError') throw new ServiceUnavailableException('AI_TIMEOUT');
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    } finally { clearTimeout(timeout); }
  }
}
