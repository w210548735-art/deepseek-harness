# @deepseek-ai/dsh-client-ui-settings-custom-prompt

[English](README.md) | 中文

用于注入到每次对话的用户自定义提示词的 Web 设置页。

## Purpose

本浏览器插件在 Web 设置面板注册**自定义提示词**页。页面暂存提示词文本、经设置作用域传输保存到 `custom-prompt` 设置命名空间，并可清除回默认值。命名空间本身与系统提示词注入由 [`@deepseek-ai/dsh-custom-prompt`](../../context/custom-prompt/README.md) 拥有；本包纯粹是该能力的设置表面。

## Slot contribution

| Slot | id | order | Meaning |
|---|---|---|---|
| `settings.section` | `custom-prompt` | 1 | 一个设置页，紧随通用设置之后 |

注册经由 `slots.inject('settings.section', …)`，因此当设置表面声明该槽位时安装，并随本插件的 fiber 一起回滚。页面文案存放在 `settings.custom-prompt` locale 命名空间（简体中文为源，英文镜像）。

## Model Experience

Indirectly, through [`@deepseek-ai/dsh-custom-prompt`](../../context/custom-prompt/README.md)：本页写入 `custom-prompt` 命名空间 section，该能力将其渲染为系统提示词 section。

#### KV Cache effect

无直接失效。页面只改写持久提示词文本；注入 section 的前缀复用语义属于 `@deepseek-ai/dsh-custom-prompt`，且只在该文本变化时改变。

## Known Limitations and Deferred Work

- **Namespace coupling** — 页面按名称绑定 `custom-prompt` 命名空间；组合本包而不组合 `@deepseek-ai/dsh-custom-prompt`（或该命名空间的任何其他注册者）时作用域不可用，页面会把持久值显示为空。
- **No preview** — 页面不渲染实时的组装提示词预览；需要预览的部署须在同一页面追加后续 section。
