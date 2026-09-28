# VoxFlow 屏幕信息读取能力 — 实现方案与交接文档

> 本文档是给 codex（或后续执行者）的完整实现规格。目标：让「记言 Todo (VoxFlow)」安卓应用能**自动读取前台聊天 App 的屏幕对话文字**，作为待办提取的素材。方案参考了开源项目 [jev-chat/jev-chat-jarvis](https://github.com/jev-chat/jev-chat-jarvis) 的「无障碍读节点 + OCR 兜底」实现。

---

## 一、背景与目标

VoxFlow 是一个「通话/短信/微信 → 提取待办 → Obsidian 笔记」的安卓应用（React + Capacitor + 原生 Java/Kotlin 插件）。

它已有：通知监听（短信/微信通知）、通话记录同步、微信无障碍读取（`WeChatAccessibilityService`，仅监听 `com.tencent.mm`）。

**要做的**：把微信无障碍服务扩展为**通用屏幕读取**——自动监听所有前台聊天 App，读屏幕对话文字，作为待办提取素材。微信 8.0.52+ 对普通无障碍服务隐藏了消息文字，因此需要 **OCR 兜底**。

### 核心约束
- `AccessibilityService.takeScreenshot` 需 **API 30+**（Android 11+），旧设备（minSdk 24）降级为只读节点。
- 截屏 OCR 必须**节流**（系统对截屏有节流 errorCode 3），两次截屏 ≥ 2 秒。
- `android:canTakeScreenshot="true"` 需用户在无障碍设置里**关掉再开一次**才生效（系统限制）。
- ML Kit 用**内置中文模型**（`text-recognition-chinese`），打包进 APK，无需下载、无需 Play Services。

---

## 二、技术方案概览

```
前台聊天 App
   │ 无障碍 onAccessibilityEvent
   ▼
读节点树 collectText(node)
   ├─ 节点文字 ≥ 4 行 → 直接保存
   └─ 节点文字 < 4 行 → 截屏(takeScreenshot) + ML Kit 中文 OCR → 保存
                          ▼
              CapturedVisualTextStore（SharedPreferences，去重）
                          ▼
              前端 getCapturedVisualContent → 录入 IngestItem → 提取待办
```

- **适配器模式**：每个聊天 App 一个「读取规则」（包名 + 是否走 OCR + 节点过滤），见第三节。
- **去重**：内容 sha256 去重（已有逻辑）。
- **排除**：系统 UI（`com.android.systemui`）、设置（`com.android.settings`）、桌面（含 `launcher`）、输入法（`com.google.android.inputmethod`）、自身（`com.voxflow.todo`）。

---

## 三、每个聊天 App 的适配规则（重点）

> 下表是「每个应用都要记录」的适配清单。codex 实现时按此扩展 `WeChatAccessibilityService` 的 `shouldSkip` / 节点过滤逻辑，或引入适配器接口。

| App | 包名 | 读取方式 | 备注 |
|---|---|---|---|
| 微信 | `com.tencent.mm` | 节点 + OCR 兜底 | 微信 8.0.52+ 对无障碍隐藏消息文字，且部分账号开启防截屏(FLAG_SECURE)；节点读不到时走 OCR，OCR 也可能被防截屏挡住，需在 UI 提示用户 |
| QQ | `com.tencent.mobileqq` | 节点读取 | jev-chat-jarvis 9.3.50 实测群聊/1v1 走节点 |
| 飞书 / Lark | `com.ss.android.lark` | 节点 + OCR 兜底 | 正文自绘不在无障碍树，需对气泡矩形 OCR |
| X / Twitter | `com.twitter.android` | 节点（含 content-desc） | Compose 节点，正文在 content-desc 里 |
| 通用（任意 App） | — | 节点 + OCR 兜底 | 不限制包名，读任意前台 App 的可见文字 |

### 节点读取规则（现有 `collectText`，需保留/扩展）
- 遍历 `AccessibilityNodeInfo` 树，取 `getText()` + `getContentDescription()`。
- 过滤 `ignoredLabels`（微信/QQ/飞书等 UI 标签：微信、聊天、通讯录、发现、我、搜索、返回、更多、发送、表情、相册、拍摄、语音输入、按住说话、消息、联系人、动态、设置、取消、确定…）。
- 单行长度 2~600 字符，去相邻重复，最多 80 行。

### OCR 兜底规则
- 触发条件：节点文字行数 < 4。
- 截屏：`AccessibilityService.takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), callback)`，`HardwareBuffer` 转 `Bitmap.copy(ARGB_8888)` 后立即 `buffer.close()`。
- OCR：ML Kit `ChineseTextRecognizerOptions`，按 `TextBlock → Line` 提取，按 `boundingBox.top` 排序。
- 节流：两次截屏 ≥ 2 秒。
- OCR 结果行数 < 2 则丢弃。

---

## 四、文件改动清单

### 已改动（本仓库当前状态）

| 文件 | 改动 |
|---|---|
| `android/app/build.gradle` | 加 `com.google.mlkit:text-recognition-chinese:16.0.1`；加 `com.google.ai.edge.litertlm:litertlm-android:0.17.1`（端侧推理，见第六节）；加 `apply plugin: 'kotlin-android'` + `compileOptions`/`kotlinOptions` |
| `android/build.gradle` | AGP `8.5.2` + Kotlin `2.4.0` |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle `8.7` |
| `android/variables.gradle` | minSdk 22 → 24 |
| `android/app/src/main/res/xml/voxflow_accessibility_service.xml` | 去掉 `packageNames`（监听所有 App） |
| `android/app/src/main/java/com/voxflow/todo/WeChatAccessibilityService.java` | 去微信限制、读所有 App、加 OCR 兜底（懒初始化 MlKitOcr） |
| `android/app/src/main/java/com/voxflow/todo/MlKitOcr.java`（新建） | ML Kit 中文 OCR 封装 |
| `android/app/src/main/java/com/voxflow/todo/ScreenCapture.java`（新建） | 无障碍 takeScreenshot 封装（节流 + HardwareBuffer 释放） |
| `android/app/src/main/java/com/voxflow/todo/OnDeviceLlmEngine.kt`（新建） | 端侧 LiteRT-LM 引擎（第六节） |
| `src/components/GemmaObsidianSettings.tsx` | 无障碍卡片文案改为「屏幕内容读取」 |

### 待 codex 完成
1. **恢复 `canTakeScreenshot`**：上一轮为排查绑定问题临时移除，正式版需加回 `android:canTakeScreenshot="true"` 到 `voxflow_accessibility_service.xml`。
2. **适配器清单落地**：把第三节的 App 规则实现为 `shouldSkip` 白名单/黑名单 + 节点过滤，或在 `WeChatAccessibilityService` 里加适配器接口。
3. **设置页 UI**：加「截屏 OCR 需关掉再开一次」的提示（文案已在 `GemmaObsidianSettings.tsx` 改好，确认即可）。

---

## 五、构建环境（重要，codex 必须先知道）

- **JDK 21**：`litertlm`（Kotlin 2.4 编译、class 版本 65）要求 JDK 21+。本机 JDK 21 已装在 `~/Library/Java/JavaVirtualMachines/jdk-21.0.12.1.jdk/`（`/usr/libexec/java_home -v 21` 可识别）。`scripts/build-android.sh` 已改为优先 JDK 21。
- **Gradle 8.7 + AGP 8.5.2 + Kotlin 2.4.0**：`litertlm` 要求 Kotlin 2.4 → 要求 AGP 8.5.2 → 要求 Gradle 8.7。
- **编译命令**：
  ```bash
  # 前端
  npm run lint && npm run build
  # 原生（必须 JDK 21）
  cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew :app:assembleDebug
  # 完整出包
  npm run android:apk
  ```
- **网络**：当前环境可访问 Google Maven（dl.google.com）、Kaggle、国内镜像（清华 TUNA）；**被阻断** GitHub releases 大文件、Hugging Face、ghcr.io 的某些 blob。

---

## 六、遗留问题（与屏幕读取并行，非本轮重点）

1. **端侧 litertlm 模型加载卡住**：模型文件 `gemma-4-E2B-it.litertlm`（2.58GB）已从手机 Edge Gallery 复制到 `/sdcard/Android/data/com.voxflow.todo/files/models/gemma.litertlm`，权限已 `chmod 666`。但 `Engine.initialize()` 加载时 CPU 高、内存不涨（~200MB），疑似模型格式/backend 不匹配（该文件可能是 Edge Gallery 特定变体，或需指定 GPU/NPU backend）。**待排查**：`EngineConfig` 的 `backend` 参数（`Backend.CPU/GPU/NPU/GOOGLE_TENSOR`）。
2. **无障碍服务绑定**：`adb shell settings put secure enabled_accessibility_services` **不会触发系统绑定服务**（日志无 bindService）。必须**通过 UI**：应用内点「开启屏幕内容读取」→ 系统无障碍设置 → 手动开启「记言 Todo 微信已打开内容读取」。

---

## 七、验证清单

1. `npm run lint` + `npm run build` 通过。
2. `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew :app:assembleDebug` 通过。
3. `npm run android:apk` 出包，`adb install -r dist/VoxFlow-Todo-1.3-release.apk` 装真机。
4. 通过 UI 开启无障碍服务（第六节第 2 条）。
5. 打开 QQ / 飞书 / X 等聊天 App → 回到 VoxFlow「同步系统记录」→ 信息流出现屏幕对话记录。
6. 微信：节点读不到时确认走截屏 OCR 兜底（`adb logcat -d | grep -iE "MlKitOcr|takeScreenshot"` 确认）。
7. 验证方式：`adb exec-out screencap -p` 截图 + `adb shell dumpsys accessibility` 查绑定 + `adb logcat` 查日志。
