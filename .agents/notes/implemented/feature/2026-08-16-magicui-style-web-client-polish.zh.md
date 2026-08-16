# Agent Note: MagicUI 风格 Web 客户端打磨

Status: implemented

[English](2026-08-16-magicui-style-web-client-polish.md) | 中文

## Problem

Web 客户端此前是扁平、基本静止的表面：入场状态直接跳出、交互卡片变色无过渡、主操作没有触感反馈、空态 hero 平淡。DeepSeek Chat 的 MagicUI 风格处理——环境网格背景、光泽边框与扫光、柔和辉光阴影、入场与错峰动效、数字滚动——读起来更精致，但仓库样式契约（CSS Modules + clsx、无组件库、无 Tailwind、颜色只用 token）排除了整包移植 MagicUI 的 Tailwind 组件；而且给展示层加动效可能动摇已提交的 aria golden，并忽略操作系统的减弱动效偏好。

## Decision

**把 MagicUI 母题移植进各组件自己的 CSS Modules。** 环境网格与点阵背景（`HeroShell`、`OnboardingModal`）、光泽边框（`InputBar`）与斜向扫光（`Button.primary`、`ModelsSection.rowCard`、`PluginInventorySettingsTab.card`、`SidebarRoot.newSession`、`ToolRow`）、hover/选中/运行态的辉光阴影（`ChatView.toBottom`、`TerminalBlock`、`TrajectoryCell`、`WorkflowRunPanel`、`GoalBar`、`Rows`、`PlanReviewPanel`）、入场与错峰动画（`PopupSelectView`、`MessageItem`、`StatsLine`、`QueueDock`、`TodoPanel`、`ModelSelect`、`SubagentCatalogAction`）都手工改写为共享 `--dsw-*` token 之上的 CSS，用 `color-mix()` 从既有 token 推导色调。无字面颜色、无 Tailwind、无新依赖——[web-styling 系统](../process/2026-07-19-web-styling-system.md) 的裁决继续生效。

**数字滚动做成小型框架钩子。** `ui-primitives` 的 `useAnimatedNumber` 用 rAF 与三次缓出动画化数值，目标每次变化都从当前显示值续动，首次挂载直接渲染目标值，并尊重 `prefers-reduced-motion: reduce` 与显式 `disabled`。`ContextMeter` 动画化百分比圆环与读数。stats 条直接渲染稳定的 turn/step 计数：其文本既是视觉也是 golden 抓取的内容，动画化它会让组装态浏览器 aria 抓取观察到中间计数。

**动画只属于展示，不进入语义。** 每个过渡与动画都门控在 `@media (prefers-reduced-motion: no-preference)` 之后，并在同一张样式表里带 `reduce` 覆写；可访问输出始终携带稳定值：`ContextMeter` 的 `aria-label` 与 Tooltip 使用提供方精确百分比，只有视觉圆环与数字在动，因此 aria 抓取或屏幕阅读器永远不会读到中间刻度。

**新增的 elevated 表面必须 rebind 滚动条 indirection。** `DetailsPanel` 的 section 卡片涂 `--dsw-alias-bg-module-platform`，其滚动 body 因此声明 l2 `--dsh-scrollbar-*` 对，遵循 [pointer-revealed sidebar scrollbars](2026-08-04-pointer-revealed-sidebar-scrollbars.md) 契约，由 ui-theme 不变量测试强制。

## Alternatives considered

**直接移植 MagicUI 的 Tailwind 组件。** 否决：样式契约是 CSS Modules + token、无 Tailwind；为一次视觉改造引入 Tailwind 会分裂样式系统及其随 bundle 内联的 CSS 隔离。

**引入动画库（framer-motion 之类）。** 否决：所需动效只是短 CSS 过渡、一次性入场关键帧与一个数值补间；一个库加它的 provider 基建并不比 CSS 加一个 40 行钩子多做任何事。

**动画化 stats 条文本。** 否决：该条文本既是视觉也是 golden 抓取的内容；最初的移植动画化它后，组装态浏览器抓取与滚动竞态（`plan-review`、`question-composer`、`queue-actions` 观察到中间计数），因此该条渲染稳定计数。

**让 aria 跟随显示值一起动画。** 否决：组装态浏览器 aria golden 会抓取 context-meter 标签，屏幕阅读器也不该读中间刻度；稳定值留在可访问标签里、视觉层动画，这也让 `lifecycle-chrome` 抓取保持稳定。

**不带 reduced-motion 兜底直接上过渡。** 审查时否决：与其它所有样式表不一致；composer 卡片、diff/terminal 块、goal bar 各自补上 `reduce` 覆写。

## Consequences

出厂表面在不引入新依赖、不改变模型可见行为的前提下获得打磨后的动效词汇，DOM 只多一处（`EmptyHero` 的 `aria-hidden` backdrop）。动效处处遵循操作系统减弱动效偏好。context-meter 的 aria 保持抓取稳定、stats 条渲染稳定计数，因此没有任何被抓取的文本与数字滚动竞态。每个新的 elevated 滚动表面都必须声明 l2 滚动条对，否则 ui-theme 不变量测试变红。性能注记：hero 网格漂移动画的是 `background-position`（paint 属性），以缓慢的 28 秒节奏运行，hover 辉光层层叠加 box-shadow——在出厂频率下都可接受，对比度与动效强度由人工视觉清单覆盖。
