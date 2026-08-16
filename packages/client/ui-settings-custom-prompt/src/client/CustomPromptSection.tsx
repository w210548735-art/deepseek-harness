/**
 * Custom-prompt settings page: a textarea staging the prompt text with a
 * save that writes the durable namespace section through the injected scope
 * face, a clear that unsets the section, and a dirty/saving/error status
 * line. Registered by this package into the settings section slot — a
 * feature owns its own settings surface.
 */
import { useCallback, type ReactNode } from 'react'
import clsx from 'clsx'
import type {
  PropsLocale, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createCustomPromptSectionStore } from './settings-store.ts'
import css from './CustomPromptSection.module.css'

/** Injected business face: the durable prompt writes (t rides the standard locale seat). */
export interface CustomPromptSectionInjected {
  /** Persist `draft` as the custom prompt. */
  save: (draft: string) => Promise<void>
  /** Clear the custom prompt (the section re-inherits its default). */
  clear: () => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type CustomPromptSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createCustomPromptSectionStore>>
  & PropsLocale<'settings.custom-prompt'> & CustomPromptSectionInjected

/**
 * Render the custom-prompt settings page.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function CustomPromptSection({ t, useStore, actions, save, clear }: CustomPromptSectionProps): ReactNode {
  const state = useStore(s => s)
  const dirty = state.draft !== state.saved
  const onSave = useCallback(() => { void save(state.draft) }, [save, state.draft])
  const onClear = useCallback(() => { void clear() }, [clear])

  return (
    <div className={css.section}>
      <p className={css.description}>{t('description')}</p>
      <textarea
        className={css.textarea}
        value={state.draft}
        placeholder={t('placeholder')}
        disabled={state.saving}
        onChange={(event) => { actions.edit(event.target.value) }}
      />
      <div className={css.footer}>
        <span className={css.status}>
          {state.error !== null
            ? <span className={css.error} role="alert">{t('saveFailed')}</span>
            : dirty
              ? <span className={css.pending}>{t('unsaved')}</span>
              : <span className={css.hint}>{t('hint')}</span>}
        </span>
        <button
          type="button"
          className={css.button}
          disabled={state.saving || (state.draft === '' && state.saved === '')}
          onClick={onClear}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className={clsx(css.button, css.save)}
          disabled={!dirty || state.saving}
          onClick={onSave}
        >
          {t(state.saving ? 'saving' : 'save')}
        </button>
      </div>
    </div>
  )
}
