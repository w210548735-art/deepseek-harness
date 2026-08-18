/** session_delegate target extraction and the jump card behavior. */
import { describe, expect, it } from 'vitest'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { sessionDelegateTarget } from '../src/client/cross-session/session-delegate-model.ts'

const running = (argsRaw: string): ToolCallBlock => ({
  callId: 'c1', name: 'session_delegate', argsRaw, turn: 1, step: 1, time: 1_000, callView: null, subCalls: [],
})

const settled = (argsRaw: string): ToolCallBlock => ({
  kind: 'tool-result', seq: 2, time: 2_000, callId: 'c1',
  call: { name: 'session_delegate', argsRaw },
  callTime: 1_000, content: [], isError: false, callView: null, resultView: null, subCalls: [],
} as unknown as ToolCallBlock)

describe('sessionDelegateTarget', () => {
  it('extracts the target from a running call', () => {
    expect(sessionDelegateTarget(running('{"session_id":"s-42","prompt":"do it"}'))).toEqual({
      sessionId: 's-42', prompt: 'do it',
    })
  })

  it('extracts the target from a settled call and tolerates a missing prompt', () => {
    expect(sessionDelegateTarget(settled('{"session_id":"s-7"}'))).toEqual({ sessionId: 's-7' })
  })

  it('returns undefined for malformed or missing targets', () => {
    expect(sessionDelegateTarget(running('not-json'))).toBeUndefined()
    expect(sessionDelegateTarget(running('{"prompt":"no id"}'))).toBeUndefined()
    expect(sessionDelegateTarget(running('{"session_id":42}'))).toBeUndefined()
  })

  it('treats non-object JSON, missing args, and a missing call head as no target', () => {
    expect(sessionDelegateTarget(running('42'))).toBeUndefined()
    // A settled block whose call head was dropped carries no args at all.
    const headless = {
      kind: 'tool-result', seq: 2, time: 2_000, callId: 'c1',
      call: undefined, callTime: 1_000, content: [], isError: false, callView: null, resultView: null, subCalls: [],
    } as unknown as ToolCallBlock
    expect(sessionDelegateTarget(headless)).toBeUndefined()
  })
})
