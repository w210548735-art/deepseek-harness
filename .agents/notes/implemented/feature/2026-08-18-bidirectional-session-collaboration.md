# Agent Note: Bidirectional session collaboration uses durable ID-framed steering relays

Status: implemented

English | [中文](2026-08-18-bidirectional-session-collaboration.zh.md)

## Problem

The session collaboration plugin delivered messages through the ordinary `followup()` next-turn queue, so a target could receive a relay behind existing work and an awaited response could include assistant events from later turns. The target also had no durable, typed record of the sender and target IDs needed for a second session to address the first one.

## Decision

Session collaboration creates a `session-collaboration` message source with `form: 'relay'`, `senderSessionId`, and `targetSessionId`. The same IDs are repeated in a model-visible text frame so the target model can use the sender ID for a reverse message. Delivery calls `Agent.steer()`: an idle target wakes immediately, while a running target claims the relay at the nearest step boundary without entering the ordinary next-turn queue. A relay does not cancel a model request that is already streaming.

Awaited delivery collects assistant text only from the target turn that claimed the exact relay message. The runtime rejects another awaited delivery to the same target with `TARGET_BUSY` instead of queueing it, because the current session event format cannot assign one assistant turn to two simultaneous relay requests. Non-waiting delivery returns after steering the live target; a cold resumed target still requires waiting so its temporary Agent can be released safely.

Cross-workspace authorization remains disabled by default and is still gated by `allowCrossWorkspace`. When enabled, a caller may use a target ID from a user message or from a previously received collaboration relay whose sender and target IDs prove the reverse relationship. This lets two sessions synchronize IDs without requiring the user to type the ID again.

## Alternatives considered

- **Keep `followup()`** — rejected because its next-turn FIFO ordering lets ordinary pending work delay a collaboration message and does not express the requested insertion semantics.
- **Use `inject()` alone** — rejected because an idle target keeps injected context pending and does not wake; collaboration delivery must start the target turn when necessary.
- **Cancel and restart the target turn** — rejected because it would discard or reorder active model work and would require a new core Agent preemption contract.
- **Permit concurrent awaited relays to one target** — rejected because durable assistant events identify turns, not a response-to-message correlation for multiple relays in one turn.

## Consequences

Relay messages render as sourced model context rather than ordinary human input, so the user input box does not need to be populated again. The client collaboration package keeps the target-session action available on the recorded `session_delegate` call after a turn completes. Both sessions can call the same `session_delegate` tool; `wait:true` returns the target reply through the caller's tool result, while `wait:false` provides a non-blocking message path for reverse communication. The transport is next-step steering, not hard interruption, and background collaboration remains outside this synchronous API.

## Testing

The Host tests cover steering instead of follow-up queueing, durable sender/target IDs, model-visible ID framing, exact-turn reply collection, reverse cross-workspace authorization, and `TARGET_BUSY` rejection. Client tests cover `session_delegate` target extraction and the collaboration card's navigation contract. The package documentation and model prompt describe the no-input-box behavior, step-boundary timing, and asynchronous reverse-message guidance.
