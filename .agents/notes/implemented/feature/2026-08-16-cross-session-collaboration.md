# Agent Note: Explicit cross-session collaboration

Status: implemented

English | [中文](2026-08-16-cross-session-collaboration.zh.md)

## Problem

Session history reads identify prior work, but they do not let one existing session ask another existing session to perform a task and return the result. Cross-workspace delivery also needs an explicit authorization point because a session id is an opaque durable identifier.

## Decision

The host mounts `@deepseek-ai/dsh-session-collaboration` and the standard agent presets mount `@deepseek-ai/dsh-tool-session-collaboration`. The `session_delegate` tool requires an explicit target session id and delivers one relay user message to that target Agent. The target's assistant messages after that delivered message are collected after the target becomes idle and returned to the caller model. Repeating the tool call with the same id provides another round.

The service resolves live targets through `ctx.agents` and resumes persisted targets through the Agent registry. It records the relay in the target session log and disposes a cold target after its reply is collected. The default service policy requires exact `cwd` equality; the shipped base composition enables `allowCrossWorkspace` for explicit target-id delivery while keeping search workspace-scoped.

## Alternatives considered

**Reuse `tool-subagent` for every collaboration.** This only represents newly created or continuable child ownership and cannot address an arbitrary existing ordinary session by durable id, so it cannot express the requested user-selected target.

**Expose `session.prompt` directly from the model tool.** The API method is a host transport operation and does not own target-agent lookup, cold resume, reply correlation, timeout, or cleanup. The dedicated host service keeps those responsibilities together.

**Allow unrestricted cross-workspace search.** This would turn a read-only discovery operation into a broad disclosure channel. The implementation keeps search scoped and requires an explicit id for cross-workspace delivery.

## Consequences

Target prompts and replies are durable session events, so a collaboration round is visible in the target transcript and can be replayed. The caller receives only the collected assistant text; the caller and target histories are not merged. A target that never becomes idle, is cancelled, or produces no assistant message fails the delegation instead of returning an ambiguous success. The current tool is synchronous; background job ids and user-visible collaboration status remain separate follow-up work.
