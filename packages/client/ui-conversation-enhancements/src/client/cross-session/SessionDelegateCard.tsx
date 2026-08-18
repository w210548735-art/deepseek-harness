/**
 * session_delegate tool card: names the target session a collaboration round
 * addressed and offers a jump-to-session button that switches the current view
 * via `ctx.sessions.open` — no new browser window.
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { sessionDelegateTarget } from './session-delegate-model.ts'
import css from './SessionDelegateCard.module.css'

/** Injected business face: the session-switch verb. */
export interface SessionDelegateCardInjected {
  /** Switch the current view to one session id. */
  openSession: (sessionId: SessionId) => void
}

/** Full component props: toolview share plus the injected verb. */
export type SessionDelegateCardProps = ToolCallViewProps & SessionDelegateCardInjected & PropsLocale<'conversation.session-collaboration'>

/**
 * Render the collaboration card.
 * @param props - the call block plus the session-switch verb.
 * @returns the card, or nothing when the call carries no valid target.
 */
export function SessionDelegateCard({ block, openSession, t }: SessionDelegateCardProps) {
  const target = sessionDelegateTarget(block)
  if (target === undefined) return null
  return (
    <div className={css.card} data-tool="session_delegate">
      <div className={css.row}>
        <span className={css.label}>{t('sessionDelegate.target')}</span>
        <span className={css.id}>{String(target.sessionId)}</span>
      </div>
      {target.prompt !== undefined && (
        <div className={css.row}>
          <span className={css.label}>{t('sessionDelegate.prompt')}</span>
          <span className={css.prompt}>{target.prompt}</span>
        </div>
      )}
      <button
        type="button"
        className={css.jump}
        onClick={() => { openSession(target.sessionId) }}
      >
        {t('sessionDelegate.jump')}
      </button>
    </div>
  )
}
