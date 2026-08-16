/**
 * Custom-prompt section slot store: the textarea draft plus the write
 * lifecycle. The plugin's apply-world scope listener is the only writer of
 * `adopt`; the component stages edits through `edit` and the injected save
 * path drives `writing`/`committed`/`failed`.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Section state mirrored from the settings scope. */
export interface CustomPromptSectionState {
  /** Textarea content (staged edit). */
  draft: string
  /** Last persisted prompt text; `draft !== saved` marks the section dirty. */
  saved: string
  /** Whether a write is in flight (disables the textarea and buttons). */
  saving: boolean
  /** Non-null while the last write failed. */
  error: string | null
  /** Scope snapshot revision guard: only newer accepted sections adopt. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type CustomPromptSectionActions = {
  /** Adopt an accepted scope section (external edit, another tab, or own write echo). */
  adopt: (state: CustomPromptSectionState, section: { prompt?: string } | undefined, revision: number | undefined) => void
  /** Stage one textarea edit. */
  edit: (state: CustomPromptSectionState, draft: string) => void
  /** Mark a write as starting; clears the previous error. */
  writing: (state: CustomPromptSectionState, saving: boolean) => void
  /** Record a write failure and return the section to editable state. */
  failed: (state: CustomPromptSectionState, error: string) => void
  /** Record a successful write of `prompt`. */
  committed: (state: CustomPromptSectionState, prompt: string) => void
}

/**
 * Declares the custom-prompt section state and write surface.
 * @returns the store handle.
 */
export function createCustomPromptSectionStore(): EngineStoreHandle<CustomPromptSectionState, CustomPromptSectionActions> {
  return defineStore({
    init: (): CustomPromptSectionState => ({ draft: '', saved: '', saving: false, error: null, revision: -1 }),
    actions: {
      adopt: (d, section, revision) => {
        // While a write is in flight the snapshot echo must not clobber the
        // user's staged draft; the commit path publishes the final value.
        if (revision === undefined || revision <= d.revision || d.saving) return
        const prompt = section?.prompt ?? ''
        d.draft = prompt
        d.saved = prompt
        d.revision = revision
      },
      edit: (d, draft) => {
        d.draft = draft
      },
      writing: (d, saving) => {
        d.saving = saving
        if (saving) d.error = null
      },
      failed: (d, error) => {
        d.saving = false
        d.error = error
      },
      committed: (d, prompt) => {
        d.saving = false
        d.error = null
        d.saved = prompt
        d.draft = prompt
      },
    },
  })
}
