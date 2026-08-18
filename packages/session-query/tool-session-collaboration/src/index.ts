/**
 * Model-facing bidirectional relay delivery to an existing session.
 *
 * @module @deepseek-ai/dsh-tool-session-collaboration
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session-collaboration'
import { SessionId as toSessionId } from '@deepseek-ai/dsh-session'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'tool-session-collaboration'

/** Services required by the collaboration tool. */
export const inject = ['tools', 'systemPrompt', 'sessionCollaboration']

/** Tool configuration is owned by the host collaboration service. */
export interface Config {
  /** Reserved for Loader configuration symmetry. */
  enabled?: boolean
}

/** Schemastery config for the model-facing consumer. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
})

interface DelegateArgs {
  readonly session_id: string
  readonly prompt: string
  readonly wait?: boolean
}

const OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

const PROMPT =
  'Use session_delegate when the user explicitly provides another session ID or a trusted collaboration relay supplies one, and asks that session to perform a task. '
  + 'The target receives a model-context relay through the next-step steering channel, not a normal typed input. '
  + 'Every relay includes both the sender and target session IDs, and the target can use the sender ID to send a message back. '
  + 'When wait is true, the target assistant reply is injected back into the caller as collaboration context and this tool returns a receipt. Use wait:false for one-way or reverse messages while the other session is waiting, to avoid a two-sided wait. '
  + 'The target may be in another workspace only when the deployment enables explicit cross-workspace collaboration. '
  + 'Repeat the tool with the same target session_id for another collaboration round.'

/** Register the explicit session-to-session collaboration tool. */
export function apply(ctx: Context, config: Config): void {
  if (config.enabled === false) return
  ctx.systemPrompt.section({ name: 'tool:session-collaboration', order: 114, text: PROMPT })
  ctx.tools.register(defineTool({
    name: 'session_delegate',
    description: 'Send a model-context message to an explicitly identified existing session through next-step steering and optionally return its reply.',
    parameters: {
      session_id: { type: 'string', required: true, description: 'Target session id supplied by the user or synchronized by a prior collaboration relay.' },
      prompt: { type: 'string', required: true, description: 'Message or task to deliver as model context to the target session.' },
      wait: { type: 'boolean', description: 'Wait for the target turn reply; defaults to true. Use false for asynchronous messages.' },
    },
    output: OUTPUT,
    isConcurrencySafe: () => true,
    execute: async (args: DelegateArgs, exec) => {
      if (exec.agent === undefined) throw new Error('session collaboration requires an agent-bound caller')
      const result = await ctx.sessionCollaboration.delegate({
        caller: exec.agent,
        targetSessionId: toSessionId(args.session_id),
        content: [{ type: 'text', text: args.prompt }],
        signal: exec.signal,
        wait: args.wait !== false,
      })
      return result.completed
        ? `Session ${result.targetSessionId} replied to session ${result.callerSessionId}; the reply was injected as collaboration context. Reply message id: ${result.replyMessageId}`
        : `Message sent from session ${result.callerSessionId} to session ${result.targetSessionId}. Message id: ${result.messageId}`
    },
    presentCall: (args: DelegateArgs) => ({
      card: 'generic' as const,
      kind: 'read' as const,
      title: `Delegate to session ${args.session_id}`,
      rawInput: { session_id: args.session_id, prompt: args.prompt },
    }),
  }))
}
