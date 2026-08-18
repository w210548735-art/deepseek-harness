/** Host loader entry for the browser collaboration card exported from `./client`. */
import type { Context } from '@deepseek-ai/cordis'

/** The browser half binds its client services at application startup. */
export const inject: string[] = []

/**
 * The host half is a load carrier; all registrations happen in `./client`.
 * @param _ctx - host context, unused by this browser-only package.
 */
export function apply(_ctx: Context): void {}
