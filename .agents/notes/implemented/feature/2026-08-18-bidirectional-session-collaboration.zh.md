# Agent Note: 双向会话协作使用持久化 ID framing 的 steering relay

Status: implemented

[English](2026-08-18-bidirectional-session-collaboration.md) | 中文

## 问题

会话协作插件此前通过普通的 `followup()` next-turn 队列发送消息，因此目标会话可能在已有工作之后才收到 relay，等待式回复也可能包含后续 turn 的 assistant 事件。目标会话还没有持久化、类型化的发送方和目标 ID 记录，无法可靠地让另一个会话寻址回来。

## 决策

会话协作创建 `session-collaboration` 消息来源，使用 `form: 'relay'`、`senderSessionId` 和 `targetSessionId`。相同的 ID 也会重复写入模型可见的文本 framing，使目标模型可以使用发送方 ID 发送反向消息。投递调用 `Agent.steer()`：空闲目标立即唤醒，运行中的目标在最近的 step 边界领取 relay，不进入普通 next-turn 队列。relay 不会取消已经开始流式生成的模型请求。

等待式发送只收集领取该 relay 消息的目标 turn 中的 assistant 文本。运行时会对同一目标的另一个等待式发送返回 `TARGET_BUSY`，不会排队，因为现有会话事件格式无法把同一 turn 中的 assistant 回复分配给两个并发 relay 请求。非等待式发送在 steer 目标后返回；冷启动恢复的目标仍然必须等待，以便安全释放临时 Agent。

跨工作区授权默认关闭，启用后仍由 `allowCrossWorkspace` 控制。启用时，调用方可以使用用户消息中的目标 ID，或使用此前收到的 collaboration relay 中能够证明反向关系的发送方和目标 ID。这样两个会话可以同步 ID，而不需要用户再次输入 ID。

## Alternatives considered

- **保留 `followup()`** ——拒绝，因为 next-turn FIFO 会让普通待处理工作延迟协作消息，无法表达本次需要的插入语义。
- **只使用 `inject()`** ——拒绝，因为空闲目标会保留待注入上下文而不会唤醒；协作投递在必要时必须启动目标 turn。
- **取消并重启目标 turn** ——拒绝，因为这会丢弃或重排正在进行的模型工作，并要求新增核心 Agent 抢占约定。
- **允许同一目标并发等待 relay** ——拒绝，因为持久化 assistant 事件只标识 turn，没有把多个 relay 与回复关联起来的字段。

## Consequences

relay 会以带来源的模型上下文呈现，而不是普通人工输入，因此不需要再次填充用户输入框。客户端协作包会保留已记录 `session_delegate` 调用上的目标会话操作，使其在回合完成后仍可用。两个会话都可以调用同一个 `session_delegate` 工具；`wait:true` 通过调用方工具结果返回目标回复，`wait:false` 提供不阻塞的反向消息路径。传输使用 next-step steering，不是硬中断，后台协作仍不属于这个同步 API。

## Testing

Host 测试覆盖了使用 steering 而不是 follow-up 队列、持久化发送方和目标 ID、模型可见的 ID framing、精确 turn 回复收集、反向跨工作区授权以及 `TARGET_BUSY` 拒绝。客户端测试覆盖 `session_delegate` 目标提取和协作卡片的导航约定。包文档和模型提示词说明了无需输入框重复输入、step 边界时序和异步反向消息指导。
