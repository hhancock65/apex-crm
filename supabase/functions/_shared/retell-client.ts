import type { RetellAgentTool } from "./types.ts"

const RETELL_API_BASE = "https://api.retellai.com"

export class RetellApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "RetellApiError"
    this.status = status
    this.details = details
  }
}

function getRetellApiKey(): string {
  const key = Deno.env.get("RETELL_API_KEY")
  if (!key) {
    throw new Error("Missing RETELL_API_KEY secret (set via `supabase secrets set RETELL_API_KEY=...`)")
  }
  return key
}

interface RetryOptions {
  retries?: number
  baseDelayMs?: number
}

/**
 * Retries on network failure and 429/5xx (transient) responses with
 * exponential backoff + jitter. Does not retry 4xx — a bad request or auth
 * failure will fail identically on every attempt, so retrying just burns
 * time against Retell's rate limits for no benefit.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 500 }: RetryOptions = {}
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init)
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response
      }
      lastError = new Error(`Retell API responded ${response.status}`)
    } catch (err) {
      lastError = err
    }

    if (attempt < retries) {
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retell API request failed after retries")
}

async function retellRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetchWithRetry(`${RETELL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getRetellApiKey()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message =
      typeof json?.message === "string" ? json.message : `Retell API error (${response.status})`
    throw new RetellApiError(message, response.status, json)
  }

  return json as T
}

export interface CreateRetellLlmInput {
  generalPrompt: string
  beginMessage: string
  model?: string
  generalTools?: RetellAgentTool[]
}

export interface RetellLlmResult {
  llm_id: string
}

export function createRetellLlm(input: CreateRetellLlmInput): Promise<RetellLlmResult> {
  return retellRequest<RetellLlmResult>("/create-retell-llm", "POST", {
    general_prompt: input.generalPrompt,
    begin_message: input.beginMessage,
    model: input.model ?? "gpt-4.1",
    general_tools: input.generalTools ?? [],
  })
}

export function updateRetellLlm(
  llmId: string,
  input: Omit<CreateRetellLlmInput, "model">
): Promise<RetellLlmResult> {
  return retellRequest<RetellLlmResult>(`/update-retell-llm/${llmId}`, "PATCH", {
    general_prompt: input.generalPrompt,
    begin_message: input.beginMessage,
    general_tools: input.generalTools ?? [],
  })
}

export interface CreateRetellAgentInput {
  llmId: string
  voiceId: string
  agentName: string
  language: string
}

export interface RetellAgentResult {
  agent_id: string
}

export function createRetellAgent(input: CreateRetellAgentInput): Promise<RetellAgentResult> {
  return retellRequest<RetellAgentResult>("/create-agent", "POST", {
    response_engine: { type: "retell-llm", llm_id: input.llmId },
    voice_id: input.voiceId,
    agent_name: input.agentName,
    language: input.language,
  })
}

export function updateRetellAgent(
  agentId: string,
  input: Omit<CreateRetellAgentInput, "llmId">
): Promise<RetellAgentResult> {
  return retellRequest<RetellAgentResult>(`/update-agent/${agentId}`, "PATCH", {
    voice_id: input.voiceId,
    agent_name: input.agentName,
    language: input.language,
  })
}

export interface CreatePhoneCallInput {
  fromNumber: string
  toNumber: string
  /** The AI Employee's own retell_agent_id — explicit rather than relying
   *  on fromNumber's number-to-agent mapping in Retell's dashboard, since
   *  that mapping is for inbound routing and may not exist/match for a
   *  number used to place outbound calls. */
  overrideAgentId: string
  /** Interpolated into the agent's prompt via {{variable}} placeholders —
   *  only takes effect if the underlying Retell LLM prompt actually
   *  references them. Apex's own prompt-builder.ts doesn't insert
   *  campaign-specific placeholders today, so a campaign's custom
   *  instructions influence the call only if the org's agent prompt was
   *  edited to reference {{campaign_instructions}} — this is a known gap,
   *  not a bug: solving it properly means teaching prompt-builder.ts about
   *  per-call dynamic context, a larger change than this feature needs. */
  dynamicVariables?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface CreatePhoneCallResult {
  call_id: string
}

/**
 * NOTE: unlike every other function in this file, this endpoint has never
 * been exercised against Retell's real API from this environment — verify
 * the request shape against Retell's current /v2/create-phone-call docs
 * before relying on it in production, the same caveat already attached to
 * the native transfer_call tool.
 */
export function createPhoneCall(input: CreatePhoneCallInput): Promise<CreatePhoneCallResult> {
  return retellRequest<CreatePhoneCallResult>("/v2/create-phone-call", "POST", {
    from_number: input.fromNumber,
    to_number: input.toNumber,
    override_agent_id: input.overrideAgentId,
    ...(input.dynamicVariables ? { retell_llm_dynamic_variables: input.dynamicVariables } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  })
}
