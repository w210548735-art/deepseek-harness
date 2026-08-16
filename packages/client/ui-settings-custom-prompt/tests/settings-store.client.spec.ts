/** Custom-prompt section store behavior: adoption, staging, and the write lifecycle. */
import { describe, expect, it } from 'vitest'
import { createCustomPromptSectionStore } from '../src/client/settings-store.ts'

function create() {
  const store = createCustomPromptSectionStore().create()
  return { state: () => store.getSnapshot(), actions: store.actions }
}

describe('createCustomPromptSectionStore', () => {
  it('starts empty and not dirty', () => {
    const { state } = create()
    expect(state()).toEqual({ draft: '', saved: '', saving: false, error: null, revision: -1 })
  })

  it('adopts a newer accepted section as both draft and saved', () => {
    const { state, actions } = create()
    actions.adopt({ prompt: 'Always answer in Chinese.' }, 3)
    expect(state()).toMatchObject({ draft: 'Always answer in Chinese.', saved: 'Always answer in Chinese.', revision: 3 })
  })

  it('ignores stale or loading snapshots and an undefined prompt resolves empty', () => {
    const { state, actions } = create()
    actions.adopt({ prompt: 'First.' }, 2)
    actions.adopt({ prompt: 'Stale.' }, 1)
    expect(state().draft).toBe('First.')
    // A loading snapshot (revision undefined) never adopts.
    actions.adopt(undefined, undefined)
    expect(state().draft).toBe('First.')
    // A section without the prompt field adopts as empty.
    actions.adopt({}, 4)
    expect(state()).toMatchObject({ draft: '', saved: '', revision: 4 })
  })

  it('tracks a dirty draft until a committed write or a staged edit revert', () => {
    const { state, actions } = create()
    actions.edit('draft text')
    expect(state()).toMatchObject({ draft: 'draft text', saved: '' })
    actions.committed('draft text')
    expect(state()).toMatchObject({ draft: 'draft text', saved: 'draft text', saving: false, error: null })
  })

  it('keeps the staged draft while a write is in flight and restores it on failure', () => {
    const { state, actions } = create()
    actions.edit('draft text')
    actions.writing(true)
    expect(state()).toMatchObject({ saving: true, error: null })
    // The snapshot echo of the write must not clobber the in-flight draft.
    actions.adopt({ prompt: 'old' }, 5)
    expect(state().draft).toBe('draft text')
    actions.failed('write failed')
    expect(state()).toMatchObject({ saving: false, error: 'write failed', draft: 'draft text' })
  })

  it('clears the error when the next write starts', () => {
    const { state, actions } = create()
    actions.failed('write failed')
    actions.writing(true)
    expect(state()).toMatchObject({ saving: true, error: null })
  })
})
