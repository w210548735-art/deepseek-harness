/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-custom-prompt`.
 * @module @deepseek-ai/dsh-custom-prompt/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-custom-prompt'

/** Cordis companion plugin name. */
export const name = 'custom-prompt-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the settings seam validates and hot-publishes the
 * durable section, the system-prompt registry owns section-order and
 * duplicate-name contracts, and the prompt text is re-read from the live
 * scope at each assembly.
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
