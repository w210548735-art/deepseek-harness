# `@deepseek-ai/dsh-tool-session-collaboration`

[English](README.md) | 中文

基于 `ctx.sessionCollaboration` 提供双向会话上下文 relay 能力的模型工具消费者。

## 模型工具

该包注册 `session_delegate`。必填的 `session_id` 必须来自用户明确输入，或来自可信 collaboration relay 同步的发送方 ID。`prompt` 会通过 `Agent.steer()` 作为模型上下文发送，不是普通人工输入，relay 中还会包含发送方和目标 ID。`wait` 为 `true` 时，目标 assistant 文本会以 collaboration context 注入调用方，工具返回确认信息；另一会话正在等待时，单向或反向消息应使用 `wait:false`。两个会话都可以使用同一个工具，重复使用目标 ID 即可进行下一轮协作。

该工具不会搜索目标、切换浏览器当前选中的会话，也不会自行暴露目标历史。若 Agent 还需要只读搜索和事件检查，应同时挂载 `@deepseek-ai/dsh-tool-session-query`。

## 系统提示词

挂载后，Agent 会收到以下固定指引：

```text
Use session_delegate when the user explicitly provides another session ID or a trusted collaboration relay supplies one, and asks that session to perform a task. The target receives a model-context relay through next-step steering, not a normal typed input. The relay includes both sender and target session IDs. When wait is true, the target assistant reply is injected back into the caller as collaboration context and the tool returns a receipt. Use wait:false for one-way or reverse messages while the other session is waiting. The target may be in another workspace only when the deployment enables explicit cross-workspace collaboration. Repeat the tool with the same target session_id for another collaboration round.
```

跨工作区权限由 Host 服务配置负责。模型工具不会执行不受限制的跨工作区搜索。

## Model Experience

### `session_delegate` 工具及其指引

#### What the model sees

`session_delegate` 工具（必填 `session_id`、必填 `prompt`、可选 `wait`）与上文引用的固定系统提示词指引——即稳定的模型可见文本。relay 是模型上下文而不是普通人工输入，因此用户不需要在输入框中再次写入相同内容。

#### Token effect

每次调用都会把带 ID 的 relay 加入目标会话；等待式调用还会把目标收集到的 assistant 回复作为带来源的上下文消息注入调用方，工具结果只返回确认信息；固定指引增加常量前缀。

#### KV Cache effect

工具 schema 与指引在不变时位于稳定的提示词前缀中。每轮协作会把 relay 持久化到目标历史，等待式调用还会把回复 relay 追加到调用方历史；目标会话的前缀在投递上下文后发生变化。

## Known Limitations and Deferred Work

- **同步单轮** — `wait:true` 等待目标 turn 产生完成的 assistant 消息；后台任务 ID 与用户可见的协作状态属于后续工作。
- **不支持硬抢占** — steering 在最近的 step 边界执行，不会中断已经开始生成的模型请求。
- **无回复即失败** — 目标从未空闲、被取消或未产生任何 assistant 消息时，委托失败而不是返回模棱两可的成功。
- **同一目标不支持并发等待式发送** — 第二个等待请求返回 `TARGET_BUSY`，不会进入队列。
