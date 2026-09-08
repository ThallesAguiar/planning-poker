import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { buildGuardedSystemMessage, checkInput, hasRoleMarkerKeys, wrapUserData, type GuardrailLevel } from './guardrails.js';

export type LlmVoteRequest = { story: string; role: string; context?: string; deck: Array<number | string> };
export type LlmVoteResponse = { vote: number | string; justification: string };
export type LlmSummarizeRequest = { stories: string[]; context?: string };
export type LlmSummarizeResponse = { overallSummary: string; perStory: { title: string; summary: string; suggestedTasks: string[] }[] };
export type LlmDiscussRequest = {
  action: 'pull' | 'summarize';
  story: string;
  votes: { participantName: string; value: string; justification?: string | null }[];
  context?: string;
  deck: Array<number | string>;
};
export type LlmDiscussResponse = { message: string; suggestedNextStep?: string };

/** Config de conexão resolvida em runtime (proveniente do Studio da conta), com fallback nas variáveis de ambiente. */
export type RuntimeLlmOptions = { baseUrl?: string; apiKey?: string; model?: string; timeoutMs?: number };

/** Config extra por chamada: credenciais/provider + persona + regras de negócio + nível de guardrail. */
export type LlmRunConfig = {
  options?: RuntimeLlmOptions;
  systemPrompt?: string;
  businessRules?: string[];
  guardrailLevel?: GuardrailLevel;
};

const SYSTEM_VOTE = 'Return only JSON: {"vote": <deck value>, "justification": "short reason"}.';
const SYSTEM_NEAR_SUMMARY = 'Return only JSON: {"overallSummary": "one short paragraph", "perStory": [{"title": "story title", "summary": "what this story concluded", "suggestedTasks": ["next step", "another next step"]}]}.';
const SYSTEM_DISCUSS_PULL = 'You facilitate a planning-poker discussion. Return only JSON: {"message": "one short question (max ~200 tokens) addressed to the dissenting voter(s), naming who voted what and asking them to explain their higher/lower estimate."}';
const SYSTEM_DISCUSS_SUMMARIZE = 'You facilitate a planning-poker discussion. Return only JSON: {"message": "a concise summary of the discussion (max ~250 tokens)", "suggestedNextStep": "one of: revotar or finalizar com <value>"}';

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly envConfig = {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL ?? 'openai/gpt-4o-mini',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 10_000),
  };

  private resolveConfig(options?: RuntimeLlmOptions) {
    return Object.assign({}, this.envConfig, options);
  }

  /** Monta o system message: defesa + persona + regras de negócio + instrução JSON (guardrails sempre ativos). */
  private buildSystem(instruction: string, run: LlmRunConfig): string {
    const level = run.guardrailLevel ?? 'moderate';
    return buildGuardedSystemMessage(run.systemPrompt ?? '', run.businessRules ?? [], level, instruction);
  }

  /** Sanitiza um campo de entrada livre do usuário. Lança se bloqueado, senão retorna o texto seguro. */
  private sanitize(value: string, run: LlmRunConfig): string {
    const level = run.guardrailLevel ?? 'moderate';
    const result = checkInput(value, level);
    if (result.blocked) throw new ServiceUnavailableException('AI_GUARDRAIL_BLOCKED');
    if (result.flags.length > 0) {
      this.logger.warn(`Guardrail sanitized input (flags=${result.flags.join(',')})`);
    }
    return result.modified;
  }

  private validateNoRoleMarkerKeys(parsed: unknown) {
    if (hasRoleMarkerKeys(parsed)) throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
  }

  async vote(input: LlmVoteRequest, run: LlmRunConfig = {}): Promise<LlmVoteResponse> {
    const { apiKey, baseUrl, model, timeoutMs } = this.resolveConfig(run.options);
    if (!apiKey) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const prompt = JSON.stringify({
      story: this.sanitize(input.story.slice(0, 2_000), run),
      role: input.role.slice(0, 120),
      context: this.sanitize((input.context ?? '').slice(-4_000), run),
      deck: input.deck,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 300, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: this.buildSystem(SYSTEM_VOTE, run) }, { role: 'user', content: wrapUserData(prompt) }] }), signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
      const body = await response.json() as any;
      const text = body?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      this.validateNoRoleMarkerKeys(parsed);
      if (!Object.hasOwn(parsed, 'vote') || !input.deck.some((value) => String(value) === String(parsed.vote)) || typeof parsed.justification !== 'string') throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
      return { vote: input.deck.find((value) => String(value) === String(parsed.vote))!, justification: parsed.justification.slice(0, 500) };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if ((error as Error)?.name === 'AbortError') throw new ServiceUnavailableException('AI_TIMEOUT');
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    } finally { clearTimeout(timeout); }
  }

  async summarize(input: LlmSummarizeRequest, run: LlmRunConfig = {}): Promise<LlmSummarizeResponse> {
    const { apiKey, baseUrl, model, timeoutMs } = this.resolveConfig(run.options);
    if (!apiKey) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const prompt = JSON.stringify({
      stories: (input.stories ?? []).slice(0, 40).map((story) => this.sanitize(story, run)),
      context: this.sanitize((input.context ?? '').slice(-4000), run),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.3, max_tokens: 1400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: this.buildSystem(SYSTEM_NEAR_SUMMARY, run) }, { role: 'user', content: wrapUserData(prompt) }] }), signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
      const body = await response.json() as any;
      const text = body?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      this.validateNoRoleMarkerKeys(parsed);
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

  async discuss(input: LlmDiscussRequest, run: LlmRunConfig = {}): Promise<LlmDiscussResponse> {
    const { apiKey, baseUrl, model, timeoutMs } = this.resolveConfig(run.options);
    if (!apiKey) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const system =
      input.action === 'pull' ? this.buildSystem(SYSTEM_DISCUSS_PULL, run) : this.buildSystem(SYSTEM_DISCUSS_SUMMARIZE, run);
    const prompt = JSON.stringify({
      action: input.action,
      story: this.sanitize(input.story.slice(0, 2_000), run),
      votes: input.votes.slice(0, 20).map((vote) => ({ ...vote, participantName: this.sanitize(vote.participantName, run) })),
      context: this.sanitize((input.context ?? '').slice(-4_000), run),
      deck: input.deck,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.3, max_tokens: 500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: wrapUserData(prompt) }] }), signal: controller.signal });
      if (!response.ok) throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
      const body = await response.json() as any;
      const text = body?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      this.validateNoRoleMarkerKeys(parsed);
      if (typeof parsed?.message !== 'string' || !parsed.message.trim()) throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
      return { message: parsed.message.slice(0, 1_000), suggestedNextStep: typeof parsed?.suggestedNextStep === 'string' ? parsed.suggestedNextStep.slice(0, 120) : undefined };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if ((error as Error)?.name === 'AbortError') throw new ServiceUnavailableException('AI_TIMEOUT');
      throw new ServiceUnavailableException('AI_PROVIDER_ERROR');
    } finally { clearTimeout(timeout); }
  }
}
