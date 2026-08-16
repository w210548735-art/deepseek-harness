/** Host loader entry for the browser implementation exported from `./client`. */

import type { Context } from '@deepseek-ai/cordis'

/** Required services: none — the browser half binds the settings scope at apply time. */
export const inject: string[] = []

/**
 * The node half is a load carrier for the browser implementation; every
 * registration happens client-side in `./client`. The settings namespace
 * itself is registered by the owning capability package
 * (`@deepseek-ai/dsh-custom-prompt`), never here — one owner per namespace.
 * @param ctx - host context (unused).
 */
export function apply(_ctx: Context): void {}
