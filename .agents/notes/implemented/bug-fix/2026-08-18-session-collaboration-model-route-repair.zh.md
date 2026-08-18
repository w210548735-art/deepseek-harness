# Agent Note: 会话协作在 relay 投递前修复缺失的目标模型路由

Status: implemented

[English](2026-08-18-session-collaboration-model-route-repair.md) | 中文

## 问题

会话协作服务可能在没有 `AgentOptions.provider` 或 `AgentOptions.model` 的情况下恢复冷目标。此时严格的部署 persona 会在渲染 `{{model}}` 时失败，目标虽然已经接收 inbox 中的 relay，却还没有进入模型请求阶段。

## 决策

会话协作在 steer 目标之前检查在线 Agent 是否具有完整的 provider/model 路由。如果没有，服务通过现有的 model-selection waterfall 安装路由：优先使用目标会话最近一次持久化的 request header，没有记录时才回退到调用方 Agent 的完整路由。该 waterfall 会同时向 prompt assembly 和 `agent/request` 提供同一 provider/model，并会跟随目标后续产生的 request header，而不是永久冻结回退值。已有完整路由的 Agent 不被修改；如果目标和调用方都没有路由，则继续保留底层明确的路由失败。

## Alternatives considered

- **从部署 persona 中删除 `{{model}}`** ——拒绝，因为这会隐藏路由缺失，并把错误推迟到没有 provider/model 的模型请求阶段。
- **每次冷恢复都直接传入全局默认模型** ——拒绝，因为这会忽略目标会话持久化的模型选择，也不能修复已经在线但无模型的 Agent。
- **修改 Agent Loop 自动制造全局回退** ——拒绝，因为路由归属于恢复或投递 Agent 的入口，全局回退会改变无关入口的行为。

## 后果

当发送方或目标日志提供有效路由时，由协作恢复的冷目标可以使用该路由执行第一条 relay。目标自己的路由仍然优先；两边都没有可用路由的无模型目标仍会明确失败，不会得到虚假的模型身份。本修复只作用于协作投递，不新增持久化事件或 wire 字段。

## Testing

session-collaboration 测试覆盖了仅有发送方路由时的冷恢复、目标 request header 优先级、prompt assembly 变量，以及交给模型适配器的 `agent/request` 路由。包类型检查已通过。
