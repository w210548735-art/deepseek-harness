# @deepseek-ai/dsh-client-ui-conversation-enhancements

[English](README.md) | 中文

显式跨会话协作的 Web 客户端配套插件。它渲染 `session_delegate` 工具调用中的目标会话 ID，并提供在当前视图打开该会话的按钮。

## 用途

本包负责协作包的浏览器展示，不发送消息、不恢复 Agent，也不合并会话历史；这些职责属于 [`@deepseek-ai/dsh-session-collaboration`](../../session-query/session-collaboration/README.md) 与 [`@deepseek-ai/dsh-tool-session-collaboration`](../../session-query/tool-session-collaboration/README.md)。

## 组合

请在客户端 locale、客户端 runtime、UI slots 和 UI tool 包之后挂载本包。Web bundle 使用 `ui-conversation-enhancements` 注册本包；本包没有单独的部署配置。

还必须挂载协作 runtime 和面向模型的工具：

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

## 客户端行为

本包为 `session_delegate` 注册一个 keyed `tool.call.toolview` 条目。它同时处理运行中和已完成的工具调用，读取明确的 `session_id` 与可选的 `prompt`；当调用参数格式错误或没有非空会话 ID 时不渲染卡片。

卡片展示目标会话 ID 和任务文本。点击“跳转到目标会话”后调用 `ctx.sessions.open`，在当前 Web 视图中切换选中的会话；它不会打开新窗口、创建分支或再次发送消息。

## Slot 贡献

| Slot | 贡献 |
|---|---|
| `tool.call.toolview`（key `session_delegate`） | 目标会话卡片和跳转按钮 |

## Model Experience

间接地，通过 [`@deepseek-ai/dsh-tool-session-collaboration`](../../session-query/tool-session-collaboration/README.md)：本包渲染已经记录的 `session_delegate` 调用，但不增加模型可见的提示词文本或工具行为。

#### KV Cache effect

无影响。浏览器包只渲染已记录的工具调用参数，并将会话导航委托给客户端会话服务。

## Known Limitations and Deferred Work

- **仅支持明确目标** — 卡片可以打开工具调用中的会话 ID，但不会搜索会话，也不会从自由文本推断目标。
- **只负责导航** — 打开目标会话只会切换选中会话，不会合并历史、滚动到目标事件或向调用方返回回复。
- **无效调用被隐藏** — 参数格式错误或目标 ID 为空时不渲染卡片，由宿主保留通用工具展示。
