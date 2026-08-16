/**
 * Custom-prompt settings page plugin, browser half: binds the
 * `custom-prompt` settings namespace the host capability package
 * (`@deepseek-ai/dsh-custom-prompt`) registers, and registers the
 * feature-owned settings section whose textarea writes that namespace.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings slot declarations plus the ctx.settingsScope Context
// merge. Cross-plugin collaboration goes through the service, never a value
// import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ctx.locale into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { CustomPromptSection, type CustomPromptSectionInjected } from './CustomPromptSection.tsx'
import { createCustomPromptSectionStore } from './settings-store.ts'
import { en, zh, type CustomPromptKey } from './locales.ts'

export type { CustomPromptSectionProps, CustomPromptSectionInjected } from './CustomPromptSection.tsx'
export type { CustomPromptSectionState } from './settings-store.ts'
export type { CustomPromptKey } from './locales.ts'

/** The settings namespace registered by @deepseek-ai/dsh-custom-prompt. */
const CUSTOM_PROMPT_NAMESPACE = 'custom-prompt'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The custom-prompt settings page copy. */
    'settings.custom-prompt': CustomPromptKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.custom-prompt'

/** A section from the host settings document (the `prompt` field is optional until a write lands). */
interface CustomPromptSection {
  prompt?: string
}

/**
 * Required services: the settings scope transport (plus connection/remote it
 * reads at bind time), the slot ledger, and locale for the page copy. The
 * target slot is declared by ui-settings' apply; this registration waits on
 * the declaration through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Bind the namespace scope and register the settings section.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind<CustomPromptSection>({ namespace: CUSTOM_PROMPT_NAMESPACE })
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-custom-prompt: dictionaries')

  const store = createCustomPromptSectionStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    // The first snapshot is `loading` (value/revision undefined) — adopt
    // skips it, and the first accepted section lands through this listener.
    bound?.adopt(snapshot.value, snapshot.revision)
  }
  ctx.effect(() => scope.subscribe(sync), 'ui-settings-custom-prompt: scope adoption')

  const injected = (actions: BoundActions<typeof store>): CustomPromptSectionInjected => {
    bound = actions
    // Re-sync from the snapshot so no change is lost between registration
    // and the first render.
    sync()
    return {
      save: async (draft) => {
        actions.writing(true)
        try {
          await scope.set('prompt', draft)
          actions.committed(draft)
        } catch {
          actions.failed('write failed')
        }
      },
      clear: async () => {
        actions.writing(true)
        try {
          await scope.unset('prompt')
          actions.committed('')
        } catch {
          actions.failed('write failed')
        }
      },
    }
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'custom-prompt',
    order: 1,
    label: () => t('nav'),
    locale: NS,
    store,
    inject: injected,
  }, CustomPromptSection))
}
