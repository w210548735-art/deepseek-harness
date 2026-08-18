/**
 * Package-owned invariant companion for
 * `@deepseek-ai/dsh-client-ui-conversation-enhancements`.
 * @module @deepseek-ai/dsh-client-ui-conversation-enhancements/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-conversation-enhancements'

/** Cordis companion plugin name. */
export const name = 'client-ui-conversation-enhancements-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package only registers a keyed browser view over
 * the durable `session_delegate` tool-call arguments; target validation is
 * local and the session switch is delegated to the host session service.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
