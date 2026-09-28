# 记言 Todo (VoxFlow) 进展与修改记录

日期：2026-09-24

## 一、这次解决的问题

应用最初已经具备信息采集、待办提取和基础无障碍执行能力，但还缺少一条真正闭环的体验：

1. 通话/微信内容结束后，如何确认并沉淀为待办。
2. 从待办如何发起自动操作。
3. 自动操作时如何做到「系统给建议，用户确认后执行」。
4. 操作手机时如何给出上下文浮窗提示。

本次围绕这四个点补齐了前后端与原生能力。

## 二、核心设计边界

### 1. 建议、确认、执行

自动执行不是一次性跑完所有步骤，而是：

1. 系统先生成建议步骤。
2. 用户逐条确认。
3. 系统执行当前步骤。
4. 完成后停在下一步，继续等待确认。

这样优先保证不误操作，尤其是发消息、拨号、预订等敏感动作。

### 2. 不自动发出消息

微信/QQ 待办目前只执行到：

1. 打开微信/QQ。
2. 点击搜索。
3. 输入联系人。
4. 选中聊天。
5. 填入待办正文作为草稿。

最终「发送」仍由用户确认，避免误发消息。

### 3. 通话摘要的真实能力边界

普通安卓应用无法读取双方通话音频，因此通话摘要默认只能包含：

- 联系人
- 号码
- 呼叫类型
- 通话时长

真实通话内容需要用户手动补充；后续如果使用免提麦克风转写，可以把转写文本接入摘要，但普通听筒通话不能自动获得。

### 4. 餐饮类待办先搜索、不自动下单

聚餐类待办会询问人数、口味、预算、位置，并生成大众点评搜索计划。当前只执行到打开搜索结果页，选定餐厅后可以继续输入指令进入详情或预订入口，最终预订/付款仍由用户确认。

## 三、已完成的改动

### 前端

- `src/components/TodoExecuteModal.tsx`
  - 新增待办执行面板。
  - 支持「建议步骤预览 -> 逐步确认 -> 执行下一步」。
  - 支持语音识别后先展示建议，不自动执行。
  - 聚餐类待办显示人数、口味、预算、位置偏好选择。

- `src/components/CallReviewModal.tsx`
  - 新增通话结束摘要弹窗。
  - 显示联系人、时间、时长和可编辑摘要。
  - 支持勾选默认待办、手动添加待办，并选择性加入待办。

- `src/components/TodoPanel.tsx`
  - 每条未完成待办增加「执行」按钮。

- `src/components/AppUsageMonitor.tsx`
  - 多步指令执行改为统一解析和可重试执行。
  - 语音识别后先填指令并等待确认，不再直接执行。

- `src/lib/taskCommands.ts`
  - 统一指令解析、应用包名映射、多步执行和重试逻辑。
  - 新增微信、QQ、大众点评等包名映射。
  - 新增餐饮类待办偏好解析与大众点评搜索计划。

- `src/lib/nativeBridge.ts`
  - 新增 `syncTodos` 方法，用于把待办同步给原生浮窗。

- `src/App.tsx`
  - 接入待办执行弹窗和通话摘要弹窗。
  - 未完成待办变化时同步到原生无障碍服务。
  - 新通话记录进入后触发通话摘要确认流程。

### 原生 Android

- `android/app/src/main/java/com/voxflow/todo/TodoHintStore.java`
  - 新增待办原生缓存，供无障碍浮窗在后台读取。

- `android/app/src/main/java/com/voxflow/todo/VoxFlowNativePlugin.java`
  - 新增 `syncTodos` 插件方法。

- `android/app/src/main/java/com/voxflow/todo/WeChatAccessibilityService.java`
  - 新增无障碍浮窗。
  - 打开微信、QQ、短信或电话应用时显示关联待办数量。
  - 检测通话结束并提示打开应用查看摘要。
  - 点击浮窗回到记言 Todo。
  - 优化文字点击：优先选择可点击节点，避免点到输入框文本。

### 脚本

- `scripts/install-to-phone.command`
  - 自动选择第一台已授权设备，避免多设备时 `more than one device/emulator`。

### 文档

- `README.md`
- `PIXEL9PROFOLD.md`

补充了浮窗提示、通话摘要、逐步执行和餐饮示例说明。

## 四、验证情况

已通过：

- `npm run lint`
- `npm run build`
- `npx cap sync android`
- `TodoHintStore.java` 使用 Android SDK 单独编译通过

尚未完成：

- 原生 Android 全量 Gradle 构建和真机安装。因为 Codex 运行环境的自动授权通道报错，无法由代码代理直接执行 `adb` / Gradle / 本地网络监听。

## 五、真机验证步骤

1. 在 Mac 终端运行：

```bash
bash "/Users/zhaohf/Downloads/App0922/-todo-main/scripts/install-to-phone.command"
```

2. 建一条「微信」渠道待办，打开微信，检查顶部浮窗。
3. 打一个普通电话，结束后回到 App，检查通话摘要弹窗。
4. 建一条「周六 4 人聚餐」待办，点执行，检查偏好选择和逐步确认。

## 六、仍待推进

1. 浮窗提示目前按渠道匹配，未按具体联系人做精细匹配。
2. 通话摘要仍依赖系统通话记录，缺少真实转写接入。
3. 餐饮示例目前只到搜索结果页，未完成餐厅详情读取和预订表单填写。
4. 端侧 LiteRT-LM 模型加载仍可能卡住，需要真机日志继续排查。
5. 原生浮窗代码尚未完成全量编译验证，需真机构建确认。

## 七、2026-09-25 补充

根据使用场景进一步明确为两点：

1. 操作手机时按联系人/渠道给出提示，通话或微信结束后进入摘要确认。
2. 应用可以代为搜索并读取结果，提供候选，由用户确认。

本次补充改动：

- `WeChatAccessibilityService.java`
  - 新增读取当前屏幕文字的能力，供前端读取搜索结果。
  - 浮窗提示从「按渠道数数量」升级为「优先匹配当前联系人」。
  - 来电时显示电话待办数量，挂断后提示查看摘要。

- `VoxFlowNativePlugin.java`
  - 新增 `getCurrentScreenText` 插件方法。

- `nativeBridge.ts`
  - 新增 `getCurrentScreenText` 类型定义。

- `TodoExecuteModal.tsx`
  - 餐饮搜索执行完成后自动读取当前屏幕文字。
  - 展示候选餐厅，用户点击候选后进入「确认第 1 步」继续执行。

至此，搜索类任务从「盲操作」升级为「搜索 -> 读屏 -> 列候选 -> 用户确认 -> 继续」的可控 Agent 流程。

仍待验证：真机编译与安装，以及大众点评搜索页在折叠屏上的节点读取稳定性。

## 八、2026-09-25 常驻桌宠浮窗

把原来的顶部一次性提示条升级为「常驻桌面桌宠」，让它在后台持续存在，触发条件时再展开为信息卡片。

设计取舍：

- 空闲状态只显示一个可拖动的小猫脸，不做常驻大卡片，避免持续遮挡屏幕。
- 触发条件沿用已有的无障碍事件与通话状态：来电、打开微信 / QQ / 短信 / 电话、通话结束。
- 展开后显示标题 + 正文 + 「查看 / 稍后」两个动作，约 9 秒自动收回，用户可提前点「稍后」。
- 位置默认贴右下角，可直接拖动；点击小猫回到记言 Todo。
- 桌宠开关保存在本机 `SharedPreferences`，与无障碍服务解耦，关闭后不删除已有待办同步。

本次改动：

- `DesktopPetOverlay.java`
  - 新增独立的桌宠浮层实现，包含空闲猫脸、消息卡片、拖动、点击回 App、自动收起。
  - 使用 `TYPE_ACCESSIBILITY_OVERLAY`，不需要额外悬浮窗权限。

- `WeChatAccessibilityService.java`
  - 移除旧的单行 `overlayView` 提示条，改由 `DesktopPetOverlay` 承接提示。
  - 新增 `isDesktopPetEnabled` / `setDesktopPetEnabled` 静态方法。
  - 来电、联系人和渠道提示改为「标题 + 正文」形式。

- `VoxFlowNativePlugin.java`
  - 新增 `setDesktopPetEnabled` 插件方法。
  - `buildStatus()` 增加 `desktopPetEnabled` 状态字段。

- `nativeBridge.ts` / `App.tsx` / `GemmaObsidianSettings.tsx`
  - 前端新增桌宠开关，并把当前状态写入原生状态对象。

验证：

- `npm run lint` 通过。
- `npm run build` 通过。
- `DesktopPetOverlay.java` 与 `WeChatAccessibilityService.java` 已用 Android SDK 单独编译通过。
- 全量 Gradle 构建因本机构建代理写入 `~/.gradle` 的授权通道临时故障未完成，需在终端重跑：
  `npm run android:apk`。

仍待真机确认：桌宠在 Pixel 9 Pro Fold 折叠 / 展开两种形态下的默认位置与拖动手感，以及高频无障碍事件下自动收起是否会闪烁。
