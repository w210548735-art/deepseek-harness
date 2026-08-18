/**
 * Cross-session collaboration plugin, browser half: renders the durable
 * `session_delegate` call and opens its explicit target in the current view.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ctx.locale and the keyed tool-view slot declarations.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { en, zh, type SessionCollaborationKey } from './locales.ts'
import { SessionDelegateCard, type SessionDelegateCardInjected } from './cross-session/SessionDelegateCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The cross-session collaboration card copy. */
    'conversation.session-collaboration': SessionCollaborationKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'conversation.session-collaboration'

/** Required services: locale for copy and sessions for target navigation. */
export const inject = ['locale', 'sessions']

/**
 * Register the client dictionary and the keyed `session_delegate` tool view.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-conversation-enhancements: dictionaries')

  ctx.inject(['slots'], (slotsCtx) => {
    // The session_delegate card opens the explicit target in the same view.
    slotsCtx.slots.inject('tool.call.toolview', () => slotsCtx.slots.register({
      name: 'tool.call.toolview',
      key: 'session_delegate',
      locale: NS,
      inject: (): SessionDelegateCardInjected => ({
        openSession: (sessionId) => { ctx.sessions.open(sessionId) },
      }),
    }, SessionDelegateCard))
  })
}
