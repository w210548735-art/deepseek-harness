import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { LlmCallConfig, UserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import SessionQueryEngine, {
  type SessionEventSearchPage,
  type SessionEventSearchRequest,
  type SessionRecord,
  type SessionResultFilter,
  type SessionSearchPage,
  type SessionSearchRequest,
} from '@deepseek-ai/dsh-session-query'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import SessionCollaborationRuntime from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

class FakeQuery extends SessionQueryEngine {
  static records: SessionRecord[] = []

  override searchSessions(_request: SessionSearchRequest): Promise<SessionSearchPage<never>> {
    return Promise.resolve({ items: [] })
  }

  override searchEvents(_request: SessionEventSearchRequest): Promise<SessionEventSearchPage> {
    return Promise.resolve({
      session: FakeQuery.records[0]?.header ?? { version: 0, id: SessionId('missing'), createdAt: 0 },
      items: [],
    })
  }

  override async filterSessions(filters: readonly SessionResultFilter[]): Promise<SessionRecord[]> {
    const ids = filters.find((filter): filter is Extract<SessionResultFilter, { kind: 'id' }> => filter.kind === 'id')?.values
    return ids === undefined
      ? FakeQuery.records
      : FakeQuery.records.filter(record => ids.includes(record.header.id))
  }
}

function createSession(ctx: Context, id: string, cwd: string): Session {
  return ctx.sessions.create(SessionId(id), { meta: { cwd } })
}

interface FakeAgentOptions {
  readonly idle?: Promise<void>
  readonly appendLaterReply?: string
  readonly agentOptions?: { provider?: string; model?: string }
}

function fakeAgent(ctx: Context, session: Session, reply: string, options: FakeAgentOptions = {}): Agent {
  const steer = vi.fn((message: UserMessage) => {
    const turn = (session.events.findLast(event => event.type === 'turn/start')?.data.turn ?? 0) + 1
    session.append('turn/start', { turn })
    session.append('user/message', message, { surfaceOp: 'append' })
    session.append('step/start', { turn, step: 1 })
    session.append('assistant/message', {
      turn,
      step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: reply }],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn, step: 1 })
    session.append('turn/end', { turn, reason: { kind: 'completed' } })
    if (options.appendLaterReply !== undefined) {
      const laterTurn = turn + 1
      session.append('turn/start', { turn: laterTurn })
      session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'later work' }],
        source: { kind: 'user' },
      }), { surfaceOp: 'append' })
      session.append('step/start', { turn: laterTurn, step: 1 })
      session.append('assistant/message', {
        turn: laterTurn,
        step: 1,
        message: createAssistantMessage({
          content: [{ type: 'text', text: options.appendLaterReply }],
          source: { provider: 'mock', model: 'mock' },
        }),
      }, { surfaceOp: 'append' })
      session.append('step/end', { turn: laterTurn, step: 1 })
      session.append('turn/end', { turn: laterTurn, reason: { kind: 'completed' } })
    }
  })
  const agent: Agent = {
    id: session.id,
    session,
    status: 'idle',
    inbox: { hasPending: false } as never,
    ctx,
    options: options.agentOptions ?? {},
    cancel: vi.fn(),
    inject: vi.fn((message: UserMessage) => {
      session.append('user/message', message, { surfaceOp: 'append' })
    }),
    steer,
    whenIdle: () => options.idle ?? Promise.resolve(),
    runMaintenance: vi.fn(),
    send: vi.fn(),
    followup: vi.fn(),
  }
  return agent
}

async function setup(config: ConstructorParameters<typeof SessionCollaborationRuntime>[1] = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: 'Target route: {{model}}.' })
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(FakeQuery)
  await ctx.plugin(SessionCollaborationRuntime, config)
  return ctx
}

describe('session collaboration runtime', () => {
  it('repairs a cold target without a route from the sender before steering it', async () => {
    const ctx = await setup({ allowCrossWorkspace: true })
    const caller = fakeAgent(ctx, createSession(ctx, 'caller', '/one'), '', {
      agentOptions: { provider: 'caller-provider', model: 'caller-model' },
    })
    const targetSession = createSession(ctx, 'target', '/one')
    FakeQuery.records = [
      { header: caller.session.header, live: true, persisted: false },
      { header: targetSession.header, live: false, persisted: true },
    ]
    const target = fakeAgent(ctx, targetSession, 'target reply')
    const dispose = vi.fn(() => Promise.resolve())
    const resume = vi.spyOn(ctx.agents, 'resume').mockResolvedValue({ agent: target, dispose })

    await expect(ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'first message' }],
      signal: new AbortController().signal,
      wait: true,
    })).resolves.toMatchObject({ completed: true, reply: 'target reply' })

    expect(resume).toHaveBeenCalledOnce()
    const resumeOptions = resume.mock.calls[0]?.[0]
    expect(resumeOptions?.resumeSessionId).toBe(target.id)
    expect(resumeOptions?.signal).toBeInstanceOf(AbortSignal)
    expect((await target.ctx.systemPrompt.assemble({ agent: target })).variables).toMatchObject({
      provider: 'caller-provider',
      model: 'caller-model',
    })
    const inherited: LlmCallConfig = { provider: 'fallback-provider', model: 'fallback-model' }
    await expect(agentEvents(target.ctx, target).waterfall(
      'agent/request', { turn: 1, step: 0, signal: new AbortController().signal }, () => Promise.resolve(inherited),
    )).resolves.toMatchObject({ provider: 'caller-provider', model: 'caller-model' })
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('prefers the target session request header over the sender fallback', async () => {
    const ctx = await setup({ allowCrossWorkspace: true })
    const caller = fakeAgent(ctx, createSession(ctx, 'caller', '/one'), '', {
      agentOptions: { provider: 'caller-provider', model: 'caller-model' },
    })
    const targetSession = createSession(ctx, 'target', '/one')
    targetSession.append('request/header', {
      header: { config: { provider: 'target-provider', model: 'target-model' } },
      reason: 'initial',
    })
    FakeQuery.records = [
      { header: caller.session.header, live: true, persisted: false },
      { header: targetSession.header, live: false, persisted: true },
    ]
    const target = fakeAgent(ctx, targetSession, 'target reply')
    vi.spyOn(ctx.agents, 'resume').mockResolvedValue({ agent: target, dispose: vi.fn(() => Promise.resolve()) })

    await ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'use the target route' }],
      signal: new AbortController().signal,
      wait: true,
    })

    expect((await target.ctx.systemPrompt.assemble({ agent: target })).variables).toMatchObject({
      provider: 'target-provider',
      model: 'target-model',
    })
    const inherited: LlmCallConfig = { provider: 'fallback-provider', model: 'fallback-model' }
    await expect(agentEvents(target.ctx, target).waterfall(
      'agent/request', { turn: 1, step: 0, signal: new AbortController().signal }, () => Promise.resolve(inherited),
    )).resolves.toMatchObject({ provider: 'target-provider', model: 'target-model' })
  })

  it('delivers an explicit target task across workspaces and returns the reply', async () => {
    const ctx = await setup({ allowCrossWorkspace: true })
    const caller = fakeAgent(ctx, createSession(ctx, 'caller', '/one'), '')
    const targetSession = createSession(ctx, 'target', '/two')
    FakeQuery.records = [
      { header: caller.session.header, live: true, persisted: false },
      { header: targetSession.header, live: true, persisted: false },
    ]
    caller.session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: `Please ask session ${targetSession.id}.` }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const target = fakeAgent(ctx, targetSession, 'target reply', { appendLaterReply: 'later reply' })
    vi.spyOn(ctx.agents, 'get').mockImplementation(id => id === target.id ? target : undefined)

    const result = await ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'analyze this' }],
      signal: new AbortController().signal,
      wait: true,
    })

    expect(result).toMatchObject({
      callerSessionId: caller.id,
      targetSessionId: target.id,
      completed: true,
      reply: 'target reply',
    })
    expect(result.replyMessageId).toBeTypeOf('string')
    expect(Reflect.get(target, 'steer') as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()
    expect(Reflect.get(target, 'followup') as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    const relay = targetSession.events.find((event): event is Extract<SessionEvent, { type: 'user/message' }> => event.type === 'user/message')
    expect(relay?.data.source).toEqual({
      kind: 'session-collaboration',
      form: 'relay',
      senderSessionId: caller.id,
      targetSessionId: target.id,
    })
    const relayText = relay?.data.content.find((block): block is Extract<UserMessage['content'][number], { type: 'text' }> => block.type === 'text')
    expect(relayText?.text).toContain(`Sender session id: ${caller.id}`)
    expect(relayText?.text).toContain(`Target session id: ${target.id}`)
    const injectedReply = caller.session.events.find((event): event is Extract<SessionEvent, { type: 'user/message' }> =>
      event.type === 'user/message' && event.data.source.kind === 'session-collaboration')
    expect(injectedReply?.data.source).toMatchObject({
      senderSessionId: target.id,
      targetSessionId: caller.id,
      inReplyTo: result.messageId,
    })
  })

  it('allows a received relay to authorize a reverse cross-workspace message', async () => {
    const ctx = await setup({ allowCrossWorkspace: true })
    const callerSession = createSession(ctx, 'caller', '/one')
    const targetSession = createSession(ctx, 'target', '/two')
    const caller = fakeAgent(ctx, callerSession, 'caller reply')
    const target = fakeAgent(ctx, targetSession, 'target reply')
    FakeQuery.records = [
      { header: callerSession.header, live: true, persisted: false },
      { header: targetSession.header, live: true, persisted: false },
    ]
    callerSession.append('user/message', createUserMessage({
      content: [{ type: 'text', text: `Please ask session ${target.id}.` }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    vi.spyOn(ctx.agents, 'get').mockImplementation(id => id === caller.id ? caller : id === target.id ? target : undefined)

    await ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'first message' }],
      signal: new AbortController().signal,
      wait: false,
    })

    await expect(ctx.sessionCollaboration.delegate({
      caller: target,
      targetSessionId: caller.id,
      content: [{ type: 'text', text: 'reverse message' }],
      signal: new AbortController().signal,
      wait: false,
    })).resolves.toMatchObject({
      callerSessionId: target.id,
      targetSessionId: caller.id,
      completed: false,
    })

    const reverseRelay = callerSession.events.find((event): event is Extract<SessionEvent, { type: 'user/message' }> =>
      event.type === 'user/message' && event.data.source.kind === 'session-collaboration')
    expect(reverseRelay?.data.source).toEqual({
      kind: 'session-collaboration',
      form: 'relay',
      senderSessionId: target.id,
      targetSessionId: caller.id,
    })
  })

  it('rejects a second waited delivery instead of queueing it for the same target', async () => {
    const ctx = await setup({ allowCrossWorkspace: true })
    const caller = fakeAgent(ctx, createSession(ctx, 'caller', '/one'), '')
    const targetSession = createSession(ctx, 'target', '/one')
    let release = (): void => {}
    const idle = new Promise<void>((resolve) => { release = resolve })
    const target = fakeAgent(ctx, targetSession, 'target reply', { idle })
    FakeQuery.records = [
      { header: caller.session.header, live: true, persisted: false },
      { header: targetSession.header, live: true, persisted: false },
    ]
    vi.spyOn(ctx.agents, 'get').mockImplementation(id => id === target.id ? target : undefined)

    const first = ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'first' }],
      signal: new AbortController().signal,
      wait: true,
    })
    await Promise.resolve()
    await Promise.resolve()

    await expect(ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: target.id,
      content: [{ type: 'text', text: 'second' }],
      signal: new AbortController().signal,
      wait: true,
    })).rejects.toMatchObject({ code: 'TARGET_BUSY' })
    expect(Reflect.get(target, 'steer') as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce()

    release()
    await expect(first).resolves.toMatchObject({ completed: true, reply: 'target reply' })
  })

  it('rejects cross-workspace delivery when the host policy is disabled', async () => {
    const ctx = await setup()
    const caller = fakeAgent(ctx, createSession(ctx, 'caller', '/one'), '')
    const targetSession = createSession(ctx, 'target', '/two')
    FakeQuery.records = [
      { header: caller.session.header, live: true, persisted: false },
      { header: targetSession.header, live: true, persisted: false },
    ]

    await expect(ctx.sessionCollaboration.delegate({
      caller,
      targetSessionId: targetSession.id,
      content: [{ type: 'text', text: 'do not send' }],
      signal: new AbortController().signal,
      wait: true,
    })).rejects.toMatchObject({ code: 'CROSS_WORKSPACE_DENIED' })
  })
})
