/**
 * Host-owned bidirectional model-context relay between ordinary sessions.
 *
 * @module @deepseek-ai/dsh-session-collaboration
 */

import { Context, Service } from '@deepseek-ai/cordis'
import {
  installModelSelection,
  type Agent,
  type AgentHandle,
  type ModelSelection,
  type ModelSelectionRef,
} from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, MessageId } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'
import z from '@deepseek-ai/schemastery'

/** Stable plugin name recorded on delivered relay messages. */
export const SESSION_COLLABORATION_PLUGIN = 'session-collaboration'

/** Durable source attached to every model-visible collaboration relay. */
export interface SessionCollaborationRelaySource {
  readonly kind: 'session-collaboration'
  readonly form: 'relay'
  readonly senderSessionId: SessionId
  readonly targetSessionId: SessionId
  readonly inReplyTo?: MessageId
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'session-collaboration': SessionCollaborationRelaySource
  }
}

/** Configuration for explicit cross-session delivery. */
export interface Config {
  /** Allow a caller with a user- or relay-sourced target id to cross cwd equality. */
  allowCrossWorkspace?: boolean
  /** Maximum time spent waiting for one target reply. */
  waitTimeoutMs?: number
}

/** Schemastery configuration for host composition. */
export const Config: z<Config> = z.object({
  allowCrossWorkspace: z.boolean().default(false),
  waitTimeoutMs: z.number().step(1).min(1).default(120_000),
})

/** Request for one explicitly addressed session relay. */
export interface SessionCollaborationRequest {
  /** The agent making the request. */
  readonly caller: Agent
  /** The user- or prior-relay-supplied target session id. */
  readonly targetSessionId: SessionId
  /** Model-facing relay content delivered to the target as sourced context. */
  readonly content: ContentBlock[]
  /** Cancellation owned by the caller's tool execution. */
  readonly signal: AbortSignal
  /** Whether to wait for the target turn and inject its reply into the caller. */
  readonly wait: boolean
}

/** Result returned to the caller model. */
export interface SessionCollaborationResult {
  /** Session id that initiated the delivery. */
  readonly callerSessionId: SessionId
  /** Target session id. */
  readonly targetSessionId: SessionId
  /** Stable delivered user-message id. */
  readonly messageId: MessageId
  /** Whether a target reply was collected. */
  readonly completed: boolean
  /** Target assistant text when the request completed with a reply. */
  readonly reply?: string
  /** Stable caller-side relay message id when the reply was injected. */
  readonly replyMessageId?: MessageId
}

/** Typed failure from explicit cross-session delivery. */
export class SessionCollaborationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'MISSING_CALLER'
      | 'TARGET_NOT_FOUND'
      | 'SELF_TARGET'
      | 'CROSS_WORKSPACE_DENIED'
      | 'TARGET_AGENT_UNAVAILABLE'
      | 'COLD_TARGET_REQUIRES_WAIT'
      | 'TARGET_BUSY'
      | 'TARGET_REPLY_MISSING'
      | 'CALLER_REPLY_INJECTION_FAILED'
      | 'WAIT_TIMEOUT'
      | 'CANCELLED'
      | 'INVALID_CONFIG',
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SessionCollaborationError'
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionCollaboration: SessionCollaborationRuntime
  }
}

interface ActiveTarget {
  readonly agent: Agent
  readonly handle: AgentHandle | undefined
}

/** Host service that owns target-agent lookup, delivery, waiting, and cleanup. */
export default class SessionCollaborationRuntime extends Service {
  static inject = ['agents', 'sessionQuery']

  static Config = Config

  private readonly allowCrossWorkspace: boolean
  private readonly waitTimeoutMs: number
  private readonly pendingReplies = new Set<SessionId>()
  private readonly relaySelections = new WeakSet<Agent>()

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'sessionCollaboration')
    this.allowCrossWorkspace = config.allowCrossWorkspace ?? false
    this.waitTimeoutMs = config.waitTimeoutMs ?? 120_000
    if (!Number.isSafeInteger(this.waitTimeoutMs) || this.waitTimeoutMs <= 0) {
      throw new SessionCollaborationError(
        'session-collaboration: waitTimeoutMs must be a positive safe integer',
        'INVALID_CONFIG',
      )
    }
  }

  /**
   * Deliver one relay to an explicit target session and optionally inject its reply.
   * @param request - caller, target, content, cancellation, and wait policy.
   * @returns delivery state, target text, and the caller-side reply relay id when awaited.
   */
  async delegate(request: SessionCollaborationRequest): Promise<SessionCollaborationResult> {
    const caller = request.caller
    if (caller.id === request.targetSessionId) {
      throw new SessionCollaborationError('a session cannot delegate to itself', 'SELF_TARGET')
    }
    throwIfCancelled(request.signal)
    if (request.wait && this.pendingReplies.has(request.targetSessionId)) {
      throw new SessionCollaborationError(
        `target session "${request.targetSessionId}" already has a reply-waiting collaboration`,
        'TARGET_BUSY',
      )
    }
    const target = await this.resolveTarget(caller, request.targetSessionId, request.signal)
    const baselineSeq = target.agent.session.events.at(-1)?.seq ?? -1
    const message = createRelayMessage(caller.id, request.targetSessionId, request.content)
    if (!request.wait) {
      if (target.handle !== undefined) {
        await target.handle.dispose()
        throw new SessionCollaborationError(
          'a cold target requires waiting for its reply so its resumed Agent can be released safely',
          'COLD_TARGET_REQUIRES_WAIT',
        )
      }
      target.agent.steer(message)
      return {
        callerSessionId: caller.id,
        targetSessionId: request.targetSessionId,
        messageId: message.id,
        completed: false,
      }
    }
    this.pendingReplies.add(request.targetSessionId)
    try {
      target.agent.steer(message)
      await waitForIdle(target.agent, request.signal, this.waitTimeoutMs)
      const reply = replyAfter(target.agent.session.events, baselineSeq, message.id)
      if (reply === undefined) {
        throw new SessionCollaborationError(
          `target session "${request.targetSessionId}" produced no assistant reply`,
          'TARGET_REPLY_MISSING',
        )
      }
      const replyMessage = createRelayMessage(
        target.agent.id,
        caller.id,
        [{ type: 'text', text: reply }],
        message.id,
      )
      try {
        caller.inject(replyMessage)
      } catch (error: unknown) {
        throw new SessionCollaborationError(
          `caller session "${caller.id}" could not accept the target reply relay`,
          'CALLER_REPLY_INJECTION_FAILED',
          { cause: error },
        )
      }
      return {
        callerSessionId: caller.id,
        targetSessionId: request.targetSessionId,
        messageId: message.id,
        completed: true,
        reply,
        replyMessageId: replyMessage.id,
      }
    } finally {
      this.pendingReplies.delete(request.targetSessionId)
      await target.handle?.dispose()
    }
  }

  private async resolveTarget(
    caller: Agent,
    targetSessionId: SessionId,
    signal: AbortSignal,
  ): Promise<ActiveTarget> {
    const records = await this.ctx.sessionQuery.filterSessions([
      { kind: 'id', values: [targetSessionId] },
    ], signal)
    const record = records[0]
    if (record === undefined) {
      throw new SessionCollaborationError(
        `target session "${targetSessionId}" was not found`,
        'TARGET_NOT_FOUND',
      )
    }
    const crossesWorkspace = record.header.cwd !== caller.session.header.cwd
    if (crossesWorkspace && (!this.allowCrossWorkspace || !callerAuthorizedTarget(caller, targetSessionId))) {
      throw new SessionCollaborationError(
        `target session "${targetSessionId}" requires an explicit user- or relay-provided id and cross-workspace permission`,
        'CROSS_WORKSPACE_DENIED',
      )
    }
    const live = this.ctx.agents.get(targetSessionId)
    if (live !== undefined) {
      this.ensureRelaySelection(live, caller)
      return { agent: live, handle: undefined }
    }
    try {
      const handle = await this.ctx.agents.resume({ resumeSessionId: targetSessionId, signal })
      this.ensureRelaySelection(handle.agent, caller)
      return { agent: handle.agent, handle }
    } catch (error: unknown) {
      throw new SessionCollaborationError(
        `target session "${targetSessionId}" could not be resumed`,
        'TARGET_AGENT_UNAVAILABLE',
        { cause: error },
      )
    }
  }

  /** Ensure a model-less relay target can assemble and route its first turn. */
  private ensureRelaySelection(target: Agent, caller: Agent): void {
    if (hasCompleteRoute(target) || this.relaySelections.has(target)) return
    const fallback = selectionFromAgent(caller) ?? selectionFromSession(caller)
    const logged = selectionFromSession(target)
    const initial = logged ?? fallback
    if (initial === undefined) return
    let selected = initial
    const selection: ModelSelectionRef = {
      get current(): ModelSelection {
        return selectionFromSession(target) ?? selected
      },
      set current(next: ModelSelection) {
        selected = next
      },
      assembled: undefined,
    }
    installModelSelection(target.ctx, selection)
    this.relaySelections.add(target)
  }
}

/** Test whether an Agent already has both request-routing fields. */
function hasCompleteRoute(agent: Pick<Agent, 'options'>): boolean {
  return agent.options.provider !== undefined && agent.options.model !== undefined
}

/** Read the last durable model route from a target session. */
function selectionFromSession(agent: Pick<Agent, 'session'>): ModelSelection | undefined {
  const config = agent.session.requestHeader()?.config
  if (config === undefined) return undefined
  return {
    provider: config.provider,
    model: config.model,
    ...config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort },
  }
}

/** Read a complete fallback route from the sender Agent. */
function selectionFromAgent(agent: Pick<Agent, 'options'>): ModelSelection | undefined {
  const { provider, model } = agent.options
  if (provider === undefined || model === undefined) return undefined
  return { provider, model }
}

async function waitForIdle(agent: Agent, signal: AbortSignal, timeoutMs: number): Promise<void> {
  if (agent.status === 'idle' && !agent.inbox.hasPending) return
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      finish(new SessionCollaborationError('target session did not finish before the timeout', 'WAIT_TIMEOUT'))
    }, timeoutMs)
    const onAbort = (): void => {
      finish(new SessionCollaborationError('session collaboration was cancelled', 'CANCELLED', { cause: signal.reason }))
    }
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      if (error === undefined) resolve()
      else reject(error)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void agent.whenIdle().then(
      () => { finish() },
      (error: unknown) => { finish(error instanceof Error ? error : new Error(String(error))) },
    )
    if (signal.aborted) onAbort()
  })
}

function createRelayMessage(
  senderSessionId: SessionId,
  targetSessionId: SessionId,
  content: readonly ContentBlock[],
  inReplyTo?: MessageId,
) {
  const replyLine = inReplyTo === undefined
    ? 'This is model context from another session, not a new human input. Reply in your assistant message; use the sender session id for a separate message back.'
    : `This is a reply relay for message ${inReplyTo}; it is model context from another session, not a new human input.`
  return createUserMessage({
    content: [
      {
        type: 'text',
        text: [
          '[Session collaboration relay]',
          `Sender session id: ${senderSessionId}`,
          `Target session id: ${targetSessionId}`,
          replyLine,
          '',
        ].join('\n'),
      },
      ...structuredClone(content),
    ],
    source: {
      kind: 'session-collaboration',
      form: 'relay',
      senderSessionId,
      targetSessionId,
      ...inReplyTo === undefined ? {} : { inReplyTo },
    },
  })
}

function replyAfter(events: readonly SessionEvent[], baselineSeq: number, messageId: MessageId): string | undefined {
  const delivered = events.find(event =>
    event.seq > baselineSeq && event.type === 'user/message' && event.data.id === messageId)
  if (delivered === undefined) return undefined
  const turnStart = events.findLast((event): event is Extract<SessionEvent, { type: 'turn/start' }> =>
    event.seq < delivered.seq && event.type === 'turn/start')
  if (turnStart === undefined) return undefined
  const replies = events.filter((event): event is Extract<SessionEvent, { type: 'assistant/message' }> =>
    event.seq > delivered.seq && event.type === 'assistant/message' && event.data.turn === turnStart.data.turn)
  const text = replies.flatMap(event => event.data.message.content)
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  return text.length === 0 ? undefined : text
}

function throwIfCancelled(signal: AbortSignal): void {
  if (!signal.aborted) return
  throw new SessionCollaborationError('session collaboration was cancelled', 'CANCELLED', { cause: signal.reason })
}

function callerAuthorizedTarget(caller: Agent, targetSessionId: SessionId): boolean {
  return caller.session.events.some((event) => {
    if (event.type !== 'user/message') return false
    if (event.data.source.kind === 'user') {
      return event.data.content.some(block => block.type === 'text' && block.text.includes(targetSessionId))
    }
    if (event.data.source.kind !== 'session-collaboration') return false
    return event.data.source.senderSessionId === targetSessionId
      && event.data.source.targetSessionId === caller.id
  })
}
