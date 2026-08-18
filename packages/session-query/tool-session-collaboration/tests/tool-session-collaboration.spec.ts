import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { MessageId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { SessionCollaborationResult } from '@deepseek-ai/dsh-session-collaboration'
import * as ToolSessionCollaboration from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

async function setup(result: SessionCollaborationResult): Promise<{
  ctx: Context
  delegate: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const delegate = vi.fn(async () => result)
  ctx.provide('sessionCollaboration', { delegate } as never)
  await ctx.plugin(ToolSessionCollaboration)
  return { ctx, delegate }
}

describe('tool-session-collaboration', () => {
  it('registers guidance that describes steering context instead of input-box text', async () => {
    const { ctx } = await setup({
      callerSessionId: SessionId('caller'),
      targetSessionId: SessionId('target'),
      messageId: MessageId('message'),
      completed: false,
    })

    const prompt = await ctx.systemPrompt.assemble()
    expect(prompt.sections.map(section => section.text).join('\n'))
      .toContain('model-context relay through the next-step steering channel, not a normal typed input')
    expect(ctx.tools.get('session_delegate')).toBeDefined()
  })

  it('passes the caller, synchronized target id, prompt, and wait policy to the host', async () => {
    const result: SessionCollaborationResult = {
      callerSessionId: SessionId('caller'),
      targetSessionId: SessionId('target'),
      messageId: MessageId('message'),
      completed: false,
    }
    const { ctx, delegate } = await setup(result)
    const caller = {
      id: result.callerSessionId,
      session: { header: { cwd: '/workspace' } },
    }

    const execution = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: 'tool-call' as never,
      name: 'session_delegate',
      arguments: { session_id: result.targetSessionId, prompt: 'send this back', wait: false },
      agent: caller as never,
    })

    expect(execution.isError).toBe(false)
    expect(execution.content).toEqual([{
      type: 'text',
      text: `Message sent from session ${result.callerSessionId} to session ${result.targetSessionId}. Message id: ${result.messageId}`,
    }])
    expect(delegate).toHaveBeenCalledWith(expect.objectContaining({
      caller,
      targetSessionId: result.targetSessionId,
      content: [{ type: 'text', text: 'send this back' }],
      wait: false,
    }))
  })

  it('reports that an awaited reply was injected instead of duplicating its text in the tool result', async () => {
    const result: SessionCollaborationResult = {
      callerSessionId: SessionId('caller'),
      targetSessionId: SessionId('target'),
      messageId: MessageId('message'),
      completed: true,
      reply: 'target reply',
      replyMessageId: MessageId('reply-message'),
    }
    const { ctx } = await setup(result)
    const execution = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: 'tool-call-wait' as never,
      name: 'session_delegate',
      arguments: { session_id: result.targetSessionId, prompt: 'wait for this', wait: true },
      agent: { id: result.callerSessionId } as never,
    })

    expect(execution.content).toEqual([{
      type: 'text',
      text: `Session ${result.targetSessionId} replied to session ${result.callerSessionId}; the reply was injected as collaboration context. Reply message id: ${result.replyMessageId}`,
    }])
    expect(execution.content[0]).not.toHaveProperty('text', expect.stringContaining('target reply'))
  })
})
