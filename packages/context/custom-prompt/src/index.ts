/**
 * User-defined prompt text injected into every assembled system prompt. The
 * text lives in the `custom-prompt` settings namespace (user-editable through
 * the settings document, hot-published by the provider), and the registered
 * system-prompt section re-reads the live scope at every assembly, so a saved
 * edit takes effect on the next model request without a restart.
 * @module @deepseek-ai/dsh-custom-prompt
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
// Type-only: pulls the ctx.systemPrompt Context merge into this program.
import type {} from '@deepseek-ai/dsh-system-prompt'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'custom-prompt'

/** Required services: the settings seam (storage) and the system-prompt registry (injection). */
export const inject = ['settings', 'systemPrompt']

/** The settings namespace owning this plugin's user section. */
export const CUSTOM_PROMPT_NAMESPACE = settingsNamespace('custom-prompt')

/** Resolved section: one optional prompt string; the schema default keeps an empty prompt a no-op. */
export interface CustomPromptSettings {
  /** Text injected before the tool guidance sections of every assembled system prompt. */
  prompt: string
}

/** Schemastery validation for {@link CustomPromptSettings}. */
const CustomPromptSchema: z<CustomPromptSettings> = z.object({
  prompt: z.string().default(''),
})

/**
 * Register the settings namespace and the prompt section. The section text is
 * a provider re-read from the live scope per assembly; `renderPrompt` drops
 * empty sections, so an unset prompt contributes nothing.
 * @param ctx - registrant context carrying settings and systemPrompt.
 */
export function apply(ctx: Context): void {
  const scope = ctx.settings.register(CUSTOM_PROMPT_NAMESPACE, CustomPromptSchema)

  // Order 10: immediately after the deployment persona (order 0), before the
  // tool-guidance range (100–199), so the user text is early and stable.
  ctx.systemPrompt.section({
    name: 'user:custom-prompt',
    order: 10,
    text: () => scope.get().prompt,
  })
}
