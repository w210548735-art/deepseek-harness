# @deepseek-ai/dsh-client-ui-conversation-enhancements

English | [中文](README.zh.md)

Web client companion for explicit cross-session collaboration. It renders the `session_delegate` tool call with the target session id and provides a button that opens that session in the current view.

## Purpose

This package owns the browser presentation for the collaboration packages. It does not send messages, resume Agents, or merge session histories; those responsibilities belong to [`@deepseek-ai/dsh-session-collaboration`](../../session-query/session-collaboration/README.md) and [`@deepseek-ai/dsh-tool-session-collaboration`](../../session-query/tool-session-collaboration/README.md).

## Composition

Mount the package after the client locale, client runtime, UI slots, and UI tool packages. The Web bundle registers it as `ui-conversation-enhancements`; the package has no deployment configuration of its own.

The collaboration runtime and model-facing tool must also be mounted:

```yaml
- id: session-collaboration
  name: '@deepseek-ai/dsh-session-collaboration'
  config:
    allowCrossWorkspace: true
- id: tool-session-collaboration
  name: '@deepseek-ai/dsh-tool-session-collaboration'
- id: ui-conversation-enhancements
  name: '@deepseek-ai/dsh-client-ui-conversation-enhancements'
```

## Client behavior

The package registers one keyed `tool.call.toolview` entry for `session_delegate`. It accepts both running and settled tool-call blocks, reads the explicit `session_id` and optional `prompt`, and renders nothing when the call arguments are malformed or do not contain a non-empty session id.

The rendered card displays the target session id and task text. Clicking `Jump to target session` calls `ctx.sessions.open` with that id and changes the selected session in the current Web view; it does not open a new window, create a fork, or send a second message.

## Slot contribution

| Slot | Contribution |
|---|---|
| `tool.call.toolview` (key `session_delegate`) | target-session card and jump button |

## Model Experience

Indirectly, through [`@deepseek-ai/dsh-tool-session-collaboration`](../../session-query/tool-session-collaboration/README.md): this package renders the recorded `session_delegate` call but does not add model-visible prompt text or tool behavior.

#### KV Cache effect

None. The browser package only renders recorded tool-call arguments and delegates session navigation to the client session service.

## Known Limitations and Deferred Work

- **Explicit target only** — the card can open the session id present in the tool call but does not search for sessions or infer a target from free-form text.
- **Navigation only** — opening a target changes the selected session; it does not merge histories, scroll to a specific target event, or return a reply to the caller.
- **Invalid calls are hidden** — malformed arguments and empty target ids render no card, leaving the generic tool presentation to the host.
