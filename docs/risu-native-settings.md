# Risu 原生设置接入

内核固定为 2026.8.250 / upstream `e565563a288ebe4c65b6099a1645ba477d1c84b4`。

| World 页面 | 原生功能 |
| --- | --- |
| 预设 | 多预设导入、切换、新建、复制、删除、原生 .risup 导出 |
| 预设 | 自定义开关、选择、文本、文本区域、分组、说明、分隔线；全局与本局变量 |
| 预设 | 提示模板条目、顺序、角色、原生条件宏、默认变量、选项定义、关联模块、完整字段编辑 |
| 世界书 | 原生 Module 导入、启用、编辑、删除、带资源的 .risum 导出 |
| 脚本 | API 3.0 原生 Plugin 导入、源码安装、启用、参数、更新、导出、删除、原生设置回调 |
| 脚本 | 原生 Trigger 的条件、动作、排序、启用、手动执行、导入导出、完整字段 |
| AI 接口 | memory / translate / emotion / otherAx 的模型选择与分任务参数 |
| 生成引擎 / 预设 | World 参数与原生预设参数的明确优先级 |

## 执行路径与保留范围

`risu-native-settings.mjs` 使用原生 database / modules / plugins / triggers 导出。
预设通过原生 `setPreset` / `changeToPreset` 应用，`.risup` 经原生加密、压缩、解码；
模块的世界书、正则、触发器、宏与资源由原生模块集合提供给执行器。
Trigger 使用原生 `runTrigger`，未替换条件、动作或权限限制；字段表来自同版本
[`src/ts/process/triggers.ts`](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/ts/process/triggers.ts)。
界面不识别的未来字段通过完整 JSON 编辑保留。模型建议表来自内嵌模型定义，仍允许输入 ID。

选项解析与变量写入对应原生
[`Toggles.svelte`](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/lib/SideBars/Toggles.svelte) 和
[`chatVar.svelte.ts`](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/ts/parser/chatVar.svelte.ts)。
开关值是 `1` / `0`，选择值是索引字符串；不会擅自把作者选项全部开启。
关闭“只保存到当前游戏”后修改选项，会像原版一样删除该选项的本局覆盖。

仅 World 专用的 `feliniaGame-Do_6xMRR.js` 增加连接后回调及辅助任务类型路由。
其他 75 个内嵌运行库文件未修改，NSFW 的默认文本、开关与全部执行代码未修改。
连接回调先应用 World 接口，再用原生 preset 恢复生成参数，同时保留用户接口地址、协议、密钥。
选择 World 参数来源时跳过这一步。原生预设条目不是生成时的临时数据库快照，
因此切换和导出不会把 World 临时参数覆盖回作者预设。

原生 API 3.0 的 iframe 沙箱、权限确认与更新校验继续执行。原生权限弹窗由 World dialog 显示，
没有自动批准。原生 API 2.x 在此版本已经不支持。第三方插件若依赖 Risu 独立应用的专有 DOM、
桌面 API 或未提供的 UI，仍需插件作者适配；接入原生插件执行器不等于所有第三方插件都兼容。

## 保存

`guardianDragonSet.risu.nativeState` 保存预设库、当前索引、模块、插件、全局选项与模型选择。
旧 `nativePreset` 自动兼容。仅选择或新建原生预设才启用其参数，修改模块不会意外启用默认预设。
本局选项与 trigger scriptstate 放在 `GAME.risuNative` 并随手动/自动存档保存，新游戏清空。
纪年初始化后恢复原生数据库；已启用插件在启动游戏或打开脚本页时加载。
恢复生成引擎默认值保留原生库和 NSFW 选择。存储失败会显示错误。

记忆可选择保留原文或使用原生副模型摘要；选模型不会自动开启翻译或表情功能。
表情模型只有在角色启用原生表情判断时使用。不同厂商原生模型使用对应原生连接配置；
`reverse_proxy` 使用 World 当前连接。

## 验证

运行：

```sh
WORLD_QA_MODULES=/absolute/path/to/node_modules node scripts/check-risu-native.mjs
```

依赖 `jsdom`、`fake-indexeddb`。测试加载仓库中实际内核，验证原生预设导入导出、
多预设恢复、自定义字段、全局与本局选项、模块导入导出及启用、手动触发器变量写入、
模板选项与 NSFW 展开、参数优先级、四种任务的实际 HTTP 请求模型字段、设置页顺序修改。
HTTP 传输使用本地替身，不调用付费服务。另行执行 NSFW 原生默认值与 YES/NO DOM 回归。

线上浏览器验证：连接 AI 的全部设置入口、预设/模块/触发器/副模型页面可访问；
API 3.0 测试插件在原生 iframe 中注册设置并成功执行回调、显示原生弹窗。
初次使用尚未启用原生预设时，参数来源显示 World；明确选择预设来源后启用原生参数。
