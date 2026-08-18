# `@deepseek-ai/dsh-tool-session-collaboration`

English | [中文](README.zh.md)

Model-facing consumer for bidirectional session-context relays through `ctx.sessionCollaboration`.

## Model tool

The package registers `session_delegate`. Its required `session_id` must come from the user's explicit request or the sender ID synchronized by a trusted collaboration relay. The `prompt` is delivered through `Agent.steer()` as model context, not as a normal typed input, and the relay includes both sender and target IDs. When `wait` is true, the target's assistant text is injected back into the caller as collaboration context and the tool returns a receipt; use `wait:false` for one-way or reverse messages while the other session is waiting. Repeating the tool call with the same target id provides another round, so both sessions can use the same tool.

The tool does not search for targets, switch the browser's selected session, or expose a target's history by itself. Mount `@deepseek-ai/dsh-tool-session-query` when the agent also needs read-only search and event inspection.

## System prompt

When mounted, the agent receives this fixed guidance:

```text
Use session_delegate when the user explicitly provides another session ID or a trusted collaboration relay supplies one, and asks that session to perform a task. The target receives a model-context relay through next-step steering, not a normal typed input. The relay includes both sender and target session IDs. When wait is true, the target assistant reply is injected back into the caller as collaboration context and the tool returns a receipt. Use wait:false for one-way or reverse messages while the other session is waiting. The target may be in another workspace only when the deployment enables explicit cross-workspace collaboration. Repeat the tool with the same target session_id for another collaboration round.
```

Cross-workspace permission is owned by the host service configuration. The model tool never performs an unrestricted cross-workspace search.

## Model Experience

### The `session_delegate` tool and its guidance

#### What the model sees

The `session_delegate` tool (required `session_id`, required `prompt`, optional `wait`) and the fixed system-prompt guidance quoted above, which is stable model-visible text. A relay is model context rather than a normal human input, so the user does not need to type the same content into the input box again.

#### Token effect

Each call adds the ID-framed relay to the target session; when awaited, the target's collected assistant reply is added to the caller as a sourced context message and the tool result is a receipt; the fixed guidance adds a constant prefix.

#### KV Cache effect

The tool schema and guidance sit in the stable prompt prefix while unchanged. Each collaboration round appends a durable relay to the target history and, when awaited, a reply relay to the caller history; the target session's prefix changes when the relayed context is delivered.

## Known Limitations and Deferred Work

- **Synchronous single round** — `wait:true` waits for the target turn's completed assistant message; background job ids and user-visible collaboration status are separate follow-up work.
- **No hard preemption** — steering runs at the nearest step boundary and does not interrupt an already streaming model request.
- **No reply means failure** — a target that never becomes idle, is cancelled, or produces no assistant message fails the delegation instead of returning an ambiguous success.
- **No concurrent awaited delivery to one target** — a second waited call returns `TARGET_BUSY` instead of entering a queue.
