/**
 * Real-composition guard for `dsh-custom-prompt`: settings-file + system-prompt
 * + the plugin boot from a test-only cordis.yml through the actual Loader +
 * Include path; the assembled prompt carries the user prompt after a hot
 * external edit, after an in-process update, and drops it again when cleared.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { CUSTOM_PROMPT_NAMESPACE, apply, inject, name } from '../src/index.ts'

/** Rendered prompt with no persona and no user prompt: the harness identity only. */
const IDENTITY = 'You are an AI agent powered by DeepSeek Harness.'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Boot the minimal composition (settings-file + system-prompt + custom-prompt). */
async function loadComposition(initialYaml: string): Promise<{ ctx: Context; settingsPath: string }> {
  root = await mkdtemp(join(tmpdir(), 'dsh-custom-prompt-'))
  const settingsPath = join(root, 'settings.yaml')
  await writeFile(settingsPath, initialYaml)

  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: settings',
    "  name: '@deepseek-ai/dsh-settings-file'",
    '  config:',
    `    path: ${JSON.stringify(settingsPath)}`,
    '    debounceMs: 10',
    '- id: system-prompt',
    "  name: '@deepseek-ai/dsh-system-prompt'",
    '- id: custom-prompt',
    '  name: test-custom-prompt',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-settings-file', FileSettingsProvider],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['test-custom-prompt', { name, inject, apply }],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { ctx, settingsPath }
}

/** Poll until the assertion passes (the settings-file watcher hot-publishes asynchronously). */
async function waitFor(check: () => Promise<void> | void, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last: unknown
  while (Date.now() < deadline) {
    try {
      await check()
      return
    } catch (error) {
      last = error
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

describe('custom-prompt real composition', () => {
  it('leaves the system prompt untouched while the prompt setting is empty', async () => {
    const { ctx } = await loadComposition('')
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(IDENTITY)
  })

  it('hot-publishes an external settings edit into the next assembly', async () => {
    const { ctx, settingsPath } = await loadComposition('')
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(IDENTITY)

    await writeFile(settingsPath, 'custom-prompt:\n  prompt: Always answer in Chinese.\n')
    await waitFor(async () => {
      const assembly = await ctx.systemPrompt.assemble()
      expect(assembly.sections.map(section => section.name))
        .toEqual(['harness:identity', 'deployment:persona', 'user:custom-prompt'])
      expect(renderPrompt(assembly)).toBe(`${IDENTITY}\n\nAlways answer in Chinese.`)
    })
  })

  it('applies an in-process settings update to the next assembly', async () => {
    const { ctx } = await loadComposition('')
    await ctx.get('settings')!.update(CUSTOM_PROMPT_NAMESPACE, { prompt: 'Be brief.' })

    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(`${IDENTITY}\n\nBe brief.`)

    await ctx.get('settings')!.update(CUSTOM_PROMPT_NAMESPACE, { prompt: 'Be concise, then stop.' })
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(`${IDENTITY}\n\nBe concise, then stop.`)
  })

  it('drops the user section again after the prompt is cleared', async () => {
    const { ctx } = await loadComposition('')
    await ctx.get('settings')!.update(CUSTOM_PROMPT_NAMESPACE, { prompt: 'Draft only.' })
    await vi.waitFor(async () => {
      expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(`${IDENTITY}\n\nDraft only.`)
    })

    await ctx.get('settings')!.update(CUSTOM_PROMPT_NAMESPACE, { prompt: '' })
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe(IDENTITY)
  })

  it('registers exactly one namespace exposing the prompt schema to configuration surfaces', async () => {
    const { ctx } = await loadComposition('custom-prompt:\n  prompt: Draft only.\n')
    const descriptors = ctx.get('settings')!.describe()
    expect(descriptors.map(entry => entry.ns)).toEqual(['custom-prompt'])
    expect(descriptors[0]!.user).toEqual({ prompt: 'Draft only.' })
  })
})
