# @deepseek-ai/dsh-custom-prompt

[English](README.md) | 中文

用户自定义提示词文本，经设置 seam 注入到每次组装的系统提示词中。

## Purpose

部署或用户可附加一条持久指令——风格、语言、常驻规则——模型在每次对话开头都会看到。文本存放在 `custom-prompt` 设置命名空间（`$DSH_HOME/settings.yaml` 的 section）中，因此经设置文档的编辑会热发布到运行中的 harness，下一次模型请求无需重启即可拾取。

## Settings namespace

| Key | Type | Default | Meaning |
|---|---|---|---|
| `prompt` | string | `''` | 注入到每次组装系统提示词的工具指引 section 之前的文本 |

空提示词渲染为空 section 并被丢弃，因此在用户写入文本之前系统提示词不受影响。

## Extension points

- **Prompt position:** section `user:custom-prompt` 注册在 `order 10`——紧随部署 persona（`deployment:persona`，order 0）之后、工具指引（100–199）之前。替换 persona 槽位的组合不影响本 section。
- **Live re-read:** section 文本是每次组装时求值的 provider，因此值始终是当前解析出的设置；插件不持有缓存副本。

## Model Experience

### Request context and condition

#### What the model sees

用户书写的 `prompt` 文本，作为独立系统提示词 section 渲染在提示词头部、工具指引之前。设置未设时为空。

#### Token effect

直接、等于提示词自身长度；设置为空时为零。

#### KV Cache effect

section 位于稳定提示词前缀（身份 → persona → 用户提示词 → 工具指引）中，因此提示词文本不变时前缀保持可复用；改写设置会替换该 section 的 token，并从此处起使前缀复用失效。

## Known Limitations and Deferred Work

- **Global scope** — section 全局注册，作用于进程内每个 agent/会话；不支持按 agent 或按 preset 的自定义提示词。想要自己副本的 preset 必须注册自己的 section。
- **No input validation** — 提示词是自由文本；需要约束（长度上限、禁止内容）的组合必须在设置写入路径（`validate` 钩子）或后续提示词监听器中强制。
