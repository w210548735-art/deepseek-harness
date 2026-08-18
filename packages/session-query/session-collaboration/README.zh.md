# `@deepseek-ai/dsh-session-collaboration`

[English](README.md) | 中文

用于在已有会话之间进行双向、明确寻址的模型上下文 relay 的 Host 服务。

## 配置

| 键 | 默认值 | 含义 |
|---|---:|---|
| `allowCrossWorkspace` | `false` | 允许明确指定的目标 ID 跨越调用方和目标会话的 `cwd`。 |
| `waitTimeoutMs` | `120000` | 等待一次目标 turn 完成的最长时间。 |

该服务要求存在调用方 Agent、明确指定的目标 `SessionId` 和 `ctx.sessionQuery`。它会先确认目标存在，再解析运行中的 Agent 或恢复持久化会话。steer 之前，如果目标 Agent 缺少完整的 provider/model 路由，会优先使用目标最近一次持久化的 request header；没有记录时才继承调用方的完整路由。这样冷恢复目标和旧的无模型 Agent 也能使用严格要求 `{{model}}` 的 persona，同时保留目标自己已记录的路由。如果两边都没有完整路由，底层模型路由错误仍会明确暴露。每条 relay 都会把发送方和目标 ID 写入目标日志的来源字段及模型可见的 framing，因此任一会话都能在下一轮寻址另一会话。

默认授权要求 `cwd` 完全相等。部署启用 `allowCrossWorkspace` 后，只允许通过明确目标 ID 或此前 relay 已同步的目标 ID 跨工作区发送，不会扩大 `session_search` 的范围，也不会暴露无界的工作区列表。

发送使用 `Agent.steer()`：空闲目标会被唤醒，运行中的目标会在最近的下一 step 插入消息，不会进入普通的 next-turn FIFO；它不会取消已经开始生成的模型请求。每次等待式发送都会等待目标 Agent 完成，并只返回接收该 relay 的目标 turn 中产生的 assistant 文本。取消或超时会拒绝发送；冷启动的目标 Agent 收集回复后会被释放。使用同一个目标 ID 再次调用即可进行下一轮协作。

该服务不会合并会话历史，也不允许目标会话向任意收件人主动发送未寻址消息。等待式发送会把目标回复以带来源的 relay context 注入调用方，并通过调用方工具结果返回确认信息；非等待式发送会在 relay 被插入后返回。同一目标已有等待式协作时，第二次等待请求会直接返回 `TARGET_BUSY`，不会排队，因为两个同时等待的回复无法安全关联。

## Model Experience

### Relay 投递上下文

#### What the model sees

服务本身是 Host 侧、模型无关的；唯一的模型可见效果经由 [`@deepseek-ai/dsh-tool-session-collaboration`](../tool-session-collaboration/README.md)（`session_delegate`）实现——通过 steer 将调用方的模型上下文 relay 投递给目标，并可把目标回复返回给调用方模型。relay 不是普通人工输入，因此不需要用户在输入框中再次写入内容。

#### Token effect

投递的 relay 内容与收集的回复 relay 经由消费者工具成为模型 token；双方请求中都包含 ID framing。

#### KV Cache effect

无直接失效。服务向目标日志追加持久的 relay 事件，并向调用方日志注入持久的回复 relay；调用方工具结果的 token 位置由消费者工具负责。

## Known Limitations and Deferred Work

- **同步等待式发送** — 每轮都要等待目标 turn 完成；后台任务 ID 与用户可见的协作状态属于后续工作。
- **不支持硬抢占** — `steer()` 会等待最近的 step 边界，不能中断已经开始生成的模型请求。
- **无回复的轮次失败** — 目标从未空闲、被取消或未产生任何 assistant 消息时，发送被拒绝，而不是返回模棱两可的成功。
- **冷启动目标不支持非等待式发送** — 恢复出来的临时 Agent 必须等待完成后才能安全释放。
