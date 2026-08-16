# @deepseek-ai/dsh-client-ui-settings-custom-prompt

English | [中文](README.zh.md)

Web settings page for the user-defined prompt injected into every conversation.

## Purpose

This browser plugin registers the **自定义提示词 (Custom prompt)** page in the Web settings panel. The page stages a prompt text, saves it into the `custom-prompt` settings namespace through the settings scope transport, and clears it back to the default. The namespace itself and the system-prompt injection are owned by [`@deepseek-ai/dsh-custom-prompt`](../../context/custom-prompt/README.md); this package is purely the settings surface for that capability.

## Slot contribution

| Slot | id | order | Meaning |
|---|---|---|---|
| `settings.section` | `custom-prompt` | 1 | One settings page, directly after General |

The registration rides `slots.inject('settings.section', …)`, so it installs when the settings surface declares the slot and rolls back with this plugin's fiber. The page copy lives in the `settings.custom-prompt` locale namespace (Simplified Chinese source of truth, English mirror).

## Model Experience

Indirectly, through [`@deepseek-ai/dsh-custom-prompt`](../../context/custom-prompt/README.md): this page writes the `custom-prompt` namespace section that capability renders as a system-prompt section.

#### KV Cache effect

No direct invalidation. The page only rewrites the durable prompt text; the prefix-reuse semantics of the injected section belong to `@deepseek-ai/dsh-custom-prompt` and change exactly when that text changes.

## Known Limitations and Deferred Work

- **Namespace coupling** — the page binds the `custom-prompt` namespace by name; composing this package without `@deepseek-ai/dsh-custom-prompt` (or any other registrar of that namespace) leaves the scope unavailable and the page shows the durable value as empty.
- **No preview** — the page does not render a live assembled-prompt preview; a deployment that wants one must add it as a later section in the same page.
