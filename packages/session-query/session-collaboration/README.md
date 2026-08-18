# `@deepseek-ai/dsh-session-collaboration`

English | [中文](README.zh.md)

Host service for bidirectional, explicitly addressed model-context relays between existing sessions.

## Configuration

| Key | Default | Meaning |
|---|---:|---|
| `allowCrossWorkspace` | `false` | Allows an explicit target id to cross the caller and target `cwd` values. |
| `waitTimeoutMs` | `120000` | Maximum time spent waiting for one target turn to complete. |

The service requires a live caller Agent, an explicit target `SessionId`, and `ctx.sessionQuery`. It validates that the target exists before resolving a live Agent or resuming a persisted session. Before steering, a target Agent without a complete provider/model route uses its latest durable request header; when that is absent, it inherits the caller's complete route. This keeps cold resumes and legacy model-less Agents compatible with strict `{{model}}` personas while preserving the target's own logged route. If neither Agent has a complete route, the underlying model-routing failure remains explicit. Every relay is recorded in the target log with the sender and target IDs in both its durable source and model-visible framing, so either session can address the other in the next round.

The default authorization requires exact `cwd` equality. A deployment that enables `allowCrossWorkspace` accepts cross-workspace delivery only through this explicit target-id operation or a target ID received in a prior collaboration relay; it does not widen `session_search` or expose an unbounded workspace listing.

Delivery uses `Agent.steer()`, so it wakes an idle target and inserts into the next step of a running target instead of entering the ordinary next-turn FIFO. It does not cancel a model request that is already streaming. Each awaited delivery waits for the target Agent to become idle and returns only assistant text from the target turn that claimed that relay. Cancellation and timeout reject the delivery; a cold target Agent is disposed after the reply is collected. Repeating the operation with the same target id provides another collaboration round.

The service does not merge session histories or allow a target to send an unsolicited message to an arbitrary recipient. An awaited delivery injects the target reply into the caller as a sourced relay context and returns a receipt through the caller's tool result; a non-waiting delivery returns after the relay is steered. A second waiting delivery to the same target fails with `TARGET_BUSY` instead of being queued, because the target turn cannot safely correlate two simultaneous replies.

## Model Experience

### Relay delivery context

#### What the model sees

The service itself is host-side and model-agnostic; the only model-visible effect flows through [`@deepseek-ai/dsh-tool-session-collaboration`](../tool-session-collaboration/README.md) (`session_delegate`), which steers the caller's model-context relay to the target and optionally returns the target's reply to the caller model. The relay is not a normal human input, so it does not require the user to type the content again in an input box.

#### Token effect

The delivered relay content and collected reply relay become model tokens through the consumer tool; the relay's ID framing is part of both requests.

#### KV Cache effect

No direct invalidation. The service appends durable relay events to the target log and injects a durable reply relay into the caller log; the consumer tool owns the caller tool-result token placement.

## Known Limitations and Deferred Work

- **Synchronous awaited delivery** — each round waits for the target turn to finish; background job ids and user-visible collaboration status are separate follow-up work.
- **No hard preemption** — `steer()` waits for the nearest step boundary and cannot interrupt a model request that is already streaming.
- **Reply-missing rounds fail** — a target that never becomes idle, is cancelled, or produces no assistant message rejects the delivery rather than returning ambiguous success.
- **Cold fire-and-forget is rejected** — a resumed cold target must be awaited so its temporary Agent can be released after the turn.
