/**
 * session_delegate target extraction: parse the tool call's raw arguments for
 * the required `session_id` and the delivered `prompt`, across the running and
 * settled block forms.
 */
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** The collaboration target one session_delegate call addresses. */
export interface SessionDelegateTarget {
  readonly sessionId: SessionId
  readonly prompt?: string
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

/**
 * Extract the delegation target from a session_delegate call block.
 * @param block - the running or settled tool call.
 * @returns the target session id and prompt, or undefined when absent/malformed.
 */
export function sessionDelegateTarget(block: ToolCallBlock): SessionDelegateTarget | undefined {
  const raw = 'call' in block ? (block.call?.argsRaw ?? undefined) : block.argsRaw
  const args = parseArgs(raw)
  const sessionId = args['session_id']
  const prompt = args['prompt']
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  return {
    sessionId: sessionId as SessionId,
    ...(typeof prompt === 'string' && prompt !== '' ? { prompt } : {}),
  }
}
