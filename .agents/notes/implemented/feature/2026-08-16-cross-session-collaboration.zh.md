# Agent Note: Explicit cross-session collaboration

Status: implemented

[English](2026-08-16-cross-session-collaboration.md) | 中文

## Problem

会话历史读取可以找到之前的工作，但不能让一个已有会话要求另一个已有会话执行任务并返回结果。跨工作区发送还需要明确的授权点，因为会话 ID 是不透明的持久化标识。

## Decision

Host 挂载 `@deepseek-ai/dsh-session-collaboration`，标准 Agent preset 挂载 `@deepseek-ai/dsh-tool-session-collaboration`。`session_delegate` 工具要求明确的目标会话 ID，并向目标 Agent 发送一条 relay 用户消息。目标进入空闲状态后，服务收集该消息之后产生的 assistant 消息并返回给调用方模型。再次使用同一个 ID 调用即可进行下一轮协作。

服务通过 `ctx.agents` 解析运行中的目标，并通过 Agent registry 恢复持久化目标。relay 会写入目标会话日志；冷启动目标收集回复后会被释放。服务默认要求 `cwd` 完全相等；发布的 base 组合为明确目标 ID 的发送启用 `allowCrossWorkspace`，但搜索仍限制在工作区内。

## Alternatives considered

**为每次协作复用 `tool-subagent`。** 该工具只表达新建或可继续的子代理所有权，不能按持久化 ID 寻址任意已有普通会话，因此无法表达用户选择的目标。

**从模型工具直接暴露 `session.prompt`。** 该 API 方法是 Host 传输操作，不负责目标 Agent 查找、冷启动恢复、回复关联、超时或清理。独立 Host 服务可以集中负责这些行为。

**允许无约束的跨工作区搜索。** 这会把只读发现操作变成广泛的数据披露通道。实现保持搜索受限，并要求跨工作区发送必须提供明确 ID。

## Consequences

目标提示词和回复都是持久化会话事件，因此协作轮次会显示在目标记录中并可回放。调用方只收到收集到的 assistant 文本，两个会话的历史不会合并。目标始终不空闲、被取消或没有产生 assistant 消息时，委托会失败而不是返回含义不明确的成功。当前工具是同步的；后台任务 ID 和用户可见的协作状态属于后续工作。
