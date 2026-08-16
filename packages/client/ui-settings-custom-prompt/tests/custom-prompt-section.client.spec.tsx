// @vitest-environment jsdom
/** CustomPromptSection behavior: staged draft, save/clear writes, status line. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { CustomPromptSection, type CustomPromptSectionProps } from '../src/client/CustomPromptSection.tsx'
import { createCustomPromptSectionStore } from '../src/client/settings-store.ts'
// Type-only: pulls the LocaleNamespaceMap augmentation for the locale seat.
import type {} from '../src/client/index.ts'

afterEach(cleanup)

const COPY = {
  'description': '注入每一次对话',
  'placeholder': '例如：请始终用中文回答。',
  'hint': '保存后立即生效。',
  'save': '保存',
  'clear': '清除',
  'unsaved': '有未保存的修改',
  'saving': '保存中…',
  'saveFailed': '保存失败，请重试',
} satisfies Record<string, string>

type CopyKey = keyof typeof COPY

/** Empty global standard-kit hooks (the section reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount() {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createCustomPromptSectionStore().create()
  store.actions.adopt({ prompt: 'Be brief.' }, 1)
  const save = vi.fn(async () => {})
  const clear = vi.fn(async () => {})
  const props: CustomPromptSectionProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key as CopyKey] ?? key,
    close: vi.fn(),
    save,
    clear,
  }
  render(<CustomPromptSection {...props} />)
  return { store, save, clear }
}

// oxlint-disable-next-line typescript/no-unnecessary-type-assertion
const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement

describe('CustomPromptSection', () => {
  it('renders the description and the persisted prompt in the textarea', () => {
    mount()
    expect(screen.getByText(COPY.description)).toBeDefined()
    expect(textarea().value).toBe('Be brief.')
    expect(screen.getByText(COPY.hint)).toBeDefined()
  })

  it('stages edits and saves the draft through the injected write', () => {
    const { store, save } = mount()
    fireEvent.change(textarea(), { target: { value: 'Always answer in Chinese.' } })
    expect(screen.getByText(COPY.unsaved)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: COPY.save }))
    expect(save).toHaveBeenCalledWith('Always answer in Chinese.')

    act(() => { store.actions.committed('Always answer in Chinese.') })
    expect(screen.getByText(COPY.hint)).toBeDefined()
  })

  it('calls clear and re-adopts the cleared section', () => {
    const { store, clear } = mount()
    fireEvent.click(screen.getByRole('button', { name: COPY.clear }))
    expect(clear).toHaveBeenCalledTimes(1)

    act(() => { store.actions.committed('') })
    expect(textarea().value).toBe('')
    expect(screen.getByText(COPY.hint)).toBeDefined()
  })

  it('surfaces a failed write as an alert and keeps the draft', () => {
    const { store } = mount()
    fireEvent.change(textarea(), { target: { value: 'Draft text.' } })
    act(() => { store.actions.failed('write failed') })
    expect(screen.getByRole('alert').textContent).toBe(COPY.saveFailed)
    expect(textarea().value).toBe('Draft text.')
  })

  it('disables the textarea and buttons while a write is in flight', () => {
    const { store } = mount()
    fireEvent.change(textarea(), { target: { value: 'Draft text.' } })
    act(() => { store.actions.writing(true) })
    expect(textarea().disabled).toBe(true)
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
    expect((screen.getByRole('button', { name: COPY.saving }) as HTMLButtonElement).disabled).toBe(true)
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
    expect((screen.getByRole('button', { name: COPY.clear }) as HTMLButtonElement).disabled).toBe(true)
  })
})
