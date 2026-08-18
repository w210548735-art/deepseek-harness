# Agent Note: Session collaboration repairs a missing target model route before relay delivery

Status: implemented

English | [中文](2026-08-18-session-collaboration-model-route-repair.zh.md)

## Problem

The collaboration service could resume a cold target without `AgentOptions.provider` or `AgentOptions.model`. A strict deployment persona then failed while rendering `{{model}}`, before the target reached its model request, even though the relay had been accepted by the target inbox.

## Decision

Before steering a target, session collaboration checks whether the live Agent has a complete provider/model route. If it does not, the service installs the existing model-selection waterfall with the target session's latest durable request header as the first choice and the caller Agent's complete route as the fallback. The waterfall supplies the same provider/model pair to prompt assembly and to `agent/request`; it also follows later target request headers instead of permanently freezing the fallback. Agents that already have a complete route are not changed, and a target with no route on either side keeps the underlying explicit routing failure.

## Alternatives considered

- **Remove `{{model}}` from the deployment persona** — rejected because it hides the missing route and leaves the later model request without a provider/model.
- **Pass the global default directly to every cold resume** — rejected because it ignores a target session's durable model selection and does not repair an already-live model-less Agent.
- **Change the Agent Loop to invent a global fallback** — rejected because route ownership belongs to the entry point that resumed or delivered the Agent, and a global fallback would alter unrelated entry points.

## Consequences

Cold targets resumed by collaboration can execute their first relay under a valid route when the sender or target log provides one. Existing target-specific routes remain authoritative, and model-less targets with no usable route still fail loudly instead of receiving a fabricated model identity. The repair is scoped to collaboration delivery and adds no new durable event or wire field.

## Testing

The session-collaboration tests cover cold recovery from a sender-only route, target request-header precedence, prompt assembly variables, and the `agent/request` route returned to the model adapter. The package typecheck passes.
