/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-settings-custom-prompt`.
 * @module @deepseek-ai/dsh-client-ui-settings-custom-prompt/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-settings-custom-prompt'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-custom-prompt-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the settings seam validates and hot-publishes the
 * durable section, the slot ledger owns the single registration, and the
 * browser write path goes through the public settings scope contract.
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
