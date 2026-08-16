# @deepseek-ai/dsh-custom-prompt

English | [中文](README.zh.md)

User-defined prompt text injected into every assembled system prompt, configured through the settings seam.

## Purpose

A deployment or user can attach a persistent instruction — style, language, standing rules — that the model sees at the start of every conversation. The text lives in the `custom-prompt` settings namespace (`$DSH_HOME/settings.yaml` section), so edits through the settings document hot-publish into the running harness and the next model request picks them up with no restart.

## Settings namespace

| Key | Type | Default | Meaning |
|---|---|---|---|
| `prompt` | string | `''` | Text injected before the tool-guidance sections of every assembled system prompt |

An empty prompt renders as an empty section and is dropped, so the system prompt is unaffected until the user writes text.

## Extension points

- **Prompt position:** the section `user:custom-prompt` registers at `order 10` — immediately after the deployment persona (`deployment:persona`, order 0) and before tool guidance (100–199). A composition that replaces the persona slot does not affect this section.
- **Live re-read:** the section text is a provider evaluated per assembly, so the value is always the current resolved setting; the plugin holds no cached copy.

## Model Experience

### Request context and condition

#### What the model sees

The user-written `prompt` text, rendered as its own system-prompt section at the head of the prompt, before tool guidance. Empty when the setting is unset.

#### Token effect

Direct, equal to the prompt's own length; zero when the setting is empty.

#### KV Cache effect

The section sits in the stable prompt prefix (identity → persona → user prompt → tool guidance), so while the prompt text is unchanged the prefix remains reusable; rewriting the setting replaces that section's tokens and invalidates prefix reuse from that point.

## Known Limitations and Deferred Work

- **Global scope** — the section registers globally and applies to every agent/session in the process; per-agent or per-preset custom prompts are not supported. A preset that wants its own copy must register its own section.
- **No input validation** — the prompt is free text; a composition that needs constraints (length caps, disallowed content) must enforce them at the settings write path (`validate` hook) or in a later prompt listener.
