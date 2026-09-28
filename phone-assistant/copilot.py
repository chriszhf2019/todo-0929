#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
记言 Todo · 手机副驾（自己用）—— 读屏 + 精确点击 + 人确认

相比之前，这次的关键升级（B 第一刀）：
  · 用 `uiautomator dump` 拿到每个 UI 元素（文字 + 精确中心坐标）
  · 把元素列表喂给视觉模型，让它用 `tap_element` 按编号精确点击
  · 模型不再「瞎猜像素坐标」，只做「选哪个元素」的决策
  · 人确认后才执行（发不发、点不点，永远由你）

用法：
  python3 copilot.py
  MODEL=qwen2.5vl:7b python3 copilot.py "打开微信"

交互：
  y / 回车  → 执行建议动作
  s         → 跳过，重新看屏
  <任意文字> → 当作新目标
  q         → 退出
"""

import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

from apps import APP_MAP

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("MODEL", "llava")
NUM_CTX = int(os.environ.get("NUM_CTX", "16384"))
SCREENSHOT = "/tmp/vox_copilot_screen.png"
SERIAL = ""
UI_ELEMENTS = []  # 当前屏幕的可点击元素列表 [{text, x, y, clickable}]


def run(cmd):
    proc = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, stdin=subprocess.DEVNULL
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def adb(cmd):
    return f"adb -s {SERIAL} {cmd}"


def resolve_serial():
    code, out, _ = run("adb devices")
    if code != 0:
        return ""
    serials = []
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("List of"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            serials.append(parts[0])
    if not serials:
        return ""
    for s in serials:
        if "._adb-tls" not in s and not s.startswith("adb-"):
            return s
    return serials[0]


def adb_ready():
    if not SERIAL:
        return False
    code, out, _ = run(adb("get-state"))
    return code == 0 and out == "device"


def screen_size():
    code, out, _ = run(adb("shell wm size"))
    if code == 0:
        for token in out.split():
            if "x" in token:
                parts = token.split("x")
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    return int(parts[0]), int(parts[1])
    return 1080, 2400


def screencap(path=SCREENSHOT):
    """截屏：写手机 /sdcard 再 pull（避开折叠屏多显示警告混入 PNG）。"""
    remote = "/sdcard/vox_copilot_screen.png"
    code, _, _ = run(adb(f"shell screencap -p {remote}"))
    if code != 0:
        return False
    code, _, _ = run(f"adb -s {SERIAL} pull {remote} {path}")
    return code == 0 and os.path.exists(path) and os.path.getsize(path) > 0


def get_ui_elements():
    """用 uiautomator 拿到当前屏幕所有带文字的元素 + 精确中心坐标。"""
    global UI_ELEMENTS
    remote = "/sdcard/vox_ui.xml"
    local = "/tmp/vox_ui.xml"
    if run(adb(f"shell uiautomator dump {remote}"))[0] != 0:
        return []
    if run(f"adb -s {SERIAL} pull {remote} {local}")[0] != 0:
        return []
    try:
        tree = ET.parse(local)
    except Exception:
        return []

    elements = []
    for node in tree.iter("node"):
        text = (node.get("text") or "").strip()
        desc = (node.get("content-desc") or "").strip()
        label = text or desc
        bounds = node.get("bounds", "")
        if not label or not bounds:
            continue
        m = re.match(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", bounds)
        if not m:
            continue
        x1, y1, x2, y2 = (int(v) for v in m.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        elements.append({
            "text": label[:40],
            "x": (x1 + x2) // 2,
            "y": (y1 + y2) // 2,
            "clickable": node.get("clickable") == "true",
        })

    # 去重（相同文字+坐标只留一个），优先可点击的排前面
    seen = set()
    unique = []
    for e in elements:
        key = (e["text"], e["x"], e["y"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    unique.sort(key=lambda e: (not e["clickable"], -e["y"]))
    UI_ELEMENTS = unique
    return unique


ACTION_SCHEMA = (
    '{"action": "tap_element", "index": <int>}  点击「屏幕元素列表」里指定编号的元素（首选，坐标最准）\n'
    '{"action": "tap", "x": <int>, "y": <int>}  点击坐标（仅当目标元素不在列表里时用）\n'
    '{"action": "swipe", "x1": <int>, "y1": <int>, "x2": <int>, "y2": <int>}  滑动\n'
    '{"action": "back"}  返回上一页\n'
    '{"action": "home"}  回到桌面\n'
    '{"action": "open_app", "package": "<包名>"}  打开应用\n'
    '{"action": "done"}  目标已完成'
)

COMMON_PACKAGES = (
    "设置=com.android.settings，微信=com.tencent.mm，电话=com.google.android.dialer，"
    "短信=com.google.android.apps.messaging，相机=com.google.android.GoogleCamera，"
    "浏览器=com.android.chrome，图库=com.google.android.apps.photos"
)

ACTION_ALIASES = {
    "click": "tap",
    "press": "tap",
    "tap": "tap",
    "tap_element": "tap_element",
    "swipe": "swipe",
    "scroll": "swipe",
    "back": "back",
    "home": "home",
    "open_app": "open_app",
    "openapp": "open_app",
    "launch": "open_app",
    "done": "done",
    "finish": "done",
    "stop": "done",
}


def normalize_action(raw):
    if not isinstance(raw, dict):
        return {}
    action = dict(raw)
    kind = str(action.get("action", "")).lower()
    action["action"] = ACTION_ALIASES.get(kind, action.get("action", ""))
    x = action.get("x")
    if isinstance(x, (list, tuple)) and len(x) >= 2:
        try:
            action["x"] = int(x[0])
            action["y"] = int(x[1])
        except (ValueError, TypeError):
            pass
    return action


def deterministic_action(goal):
    """常见单步指令用规则直接命中，不依赖模型。返回动作或 None。"""
    g = goal.strip()
    low = g.lower()

    # 打开网址（要在"打开X"之前，避免 URL 里的词被误判成应用名）
    m = re.match(r"^(?:打开网址|打开链接|访问|open\s+url)\s+(https?://\S+)", g, re.IGNORECASE)
    if m:
        return {"action": "open_url", "url": m.group(1)}

    # 打开 / 启动 / 开 X（模糊匹配，大小写不敏感）
    m = re.match(r"^(?:打开|启动|开|open|launch)\s*(.+)$", g, re.IGNORECASE)
    if m:
        name = m.group(1).strip()
        for key, pkg in APP_MAP.items():
            if key.lower() in name.lower():
                return {"action": "open_app", "package": pkg}

    # 回到桌面 / 主页 / home
    if re.search(r"回到?桌面|回到?主页|回到?主屏|回到?主界面", g) or low == "home":
        return {"action": "home"}

    # 返回 / back
    if g in ("返回", "后退") or low == "back":
        return {"action": "back"}

    # 最近任务
    if low in ("最近任务", "多任务", "recents", "任务列表"):
        return {"action": "recents"}

    # 锁屏 / 息屏 / 亮屏
    if re.search(r"锁屏|息屏|关屏", g) or low in ("sleep", "lock"):
        return {"action": "screen_off"}
    if re.search(r"亮屏|唤醒|点亮", g) or low == "wake":
        return {"action": "wake"}

    # 音量
    if re.search(r"音量\+|音量加|增大音量|调大音量|音量调大", g):
        return {"action": "volume_up"}
    if re.search(r"音量-|音量减|减小音量|调小音量|音量调小", g):
        return {"action": "volume_down"}
    if low in ("静音", "mute"):
        return {"action": "mute"}

    # 截图
    if low in ("截图", "截屏", "screenshot"):
        return {"action": "screenshot"}

    # 通知栏
    if re.search(r"下拉通知|打开通知栏|展开通知", g):
        return {"action": "expand_notifications"}
    if re.search(r"收起通知|关闭通知栏", g):
        return {"action": "collapse_notifications"}

    # 亮度 X（0-100）
    m = re.match(r"^(?:亮度|brightness)\s*(\d{1,3})", g, re.IGNORECASE)
    if m:
        pct = max(0, min(100, int(m.group(1))))
        return {"action": "brightness", "value": int(pct * 255 / 100)}

    # 拨号 X
    m = re.match(r"^(?:拨打|拨号|打电话给|call|dial)\s*([\d+#*]+)", g, re.IGNORECASE)
    if m:
        return {"action": "dial", "number": m.group(1)}

    # 系统设置子页
    if re.search(r"wifi|无线|wlan", low):
        return {"action": "settings_page", "page": "wifi"}
    if re.search(r"蓝牙|bluetooth", low):
        return {"action": "settings_page", "page": "bluetooth"}
    if "开发者选项" in g:
        return {"action": "settings_page", "page": "developer"}

    return None


SETTINGS_PAGES = {
    "wifi": "android.settings.WIFI_SETTINGS",
    "bluetooth": "android.settings.BLUETOOTH_SETTINGS",
    "developer": "android.settings.APPLICATION_DEVELOPMENT_SETTINGS",
}


def take_screenshot():
    """截图保存到本地 screenshots/ 目录。"""
    ts = time.strftime("%Y%m%d_%H%M%S")
    remote = "/sdcard/vox_shot.png"
    local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
    os.makedirs(local_dir, exist_ok=True)
    local = os.path.join(local_dir, f"shot_{ts}.png")
    if run(adb(f"shell screencap -p {remote}"))[0] != 0:
        return False
    if run(f"adb -s {SERIAL} pull {remote} {local}")[0] != 0:
        return False
    print(f"   📸 已保存 {local}")
    return True


def act(action):
    kind = action.get("action")
    try:
        if kind == "tap_element":
            idx = int(action.get("index", -1))
            if 0 <= idx < len(UI_ELEMENTS):
                e = UI_ELEMENTS[idx]
                return run(adb(f"shell input tap {e['x']} {e['y']}"))[0] == 0
            return False
        if kind == "tap":
            x, y = int(action["x"]), int(action["y"])
            return run(adb(f"shell input tap {x} {y}"))[0] == 0
        if kind == "swipe":
            x1, y1 = int(action["x1"]), int(action["y1"])
            x2, y2 = int(action["x2"]), int(action["y2"])
            return run(adb(f"shell input swipe {x1} {y1} {x2} {y2} 300"))[0] == 0
        if kind == "back":
            return run(adb("shell input keyevent 4"))[0] == 0
        if kind == "home":
            return run(adb("shell input keyevent 3"))[0] == 0
        if kind == "open_app":
            pkg = action.get("package", "")
            if not pkg:
                return False
            return run(adb(f"shell monkey -p {pkg} -c android.intent.category.LAUNCHER 1"))[0] == 0
        if kind == "recents":
            return run(adb("shell input keyevent 187"))[0] == 0
        if kind == "screen_off":
            return run(adb("shell input keyevent 223"))[0] == 0
        if kind == "wake":
            return run(adb("shell input keyevent 224"))[0] == 0
        if kind == "volume_up":
            return run(adb("shell input keyevent 24"))[0] == 0
        if kind == "volume_down":
            return run(adb("shell input keyevent 25"))[0] == 0
        if kind == "mute":
            return run(adb("shell input keyevent 164"))[0] == 0
        if kind == "screenshot":
            return take_screenshot()
        if kind == "expand_notifications":
            return run(adb("shell cmd statusbar expand-notifications"))[0] == 0
        if kind == "collapse_notifications":
            return run(adb("shell cmd statusbar collapse"))[0] == 0
        if kind == "brightness":
            return run(adb(f"shell settings put system screen_brightness {int(action['value'])}"))[0] == 0
        if kind == "dial":
            num = action.get("number", "")
            return run(adb(f"shell am start -a android.intent.action.DIAL -d tel:{num}"))[0] == 0
        if kind == "open_url":
            url = action.get("url", "")
            return run(adb(f"shell am start -a android.intent.action.VIEW -d '{url}'"))[0] == 0
        if kind == "settings_page":
            page = SETTINGS_PAGES.get(action.get("page", ""))
            if not page:
                return False
            return run(adb(f"shell am start -a {page}"))[0] == 0
        if kind == "done":
            return True
    except (KeyError, TypeError, ValueError):
        return False
    return False


def build_copilot_prompt(goal, width, height, elements):
    lines = []
    for i, e in enumerate(elements[:50]):
        flag = "可点" if e["clickable"] else "文本"
        lines.append(f"{i}. [{flag}] {e['text']} @({e['x']},{e['y']})")
    elem_text = "\n".join(lines) if lines else "(未识别到 UI 元素)"

    return (
        f"你是一个安卓手机副驾。屏幕分辨率 {width}x{height}。\n"
        f"用户目标：{goal}\n"
        "下面是通过无障碍树识别到的「屏幕元素列表」（编号. 文字 @精确坐标）：\n"
        f"{elem_text}\n\n"
        "请观察屏幕截图和元素列表，先描述屏幕，再建议下一步并说明理由。只输出 JSON：\n"
        '{"summary": "一句话描述屏幕", "action": <动作JSON>, "reason": "为什么"}\n'
        "action 必须是以下之一：\n" + ACTION_SCHEMA + "\n"
        "优先用 tap_element 点列表里的编号；目标不在列表里再用 open_app 或 tap 坐标。\n"
        "如果目标已达成，action 用 {\"action\":\"done\"}。\n"
        "常见应用包名：" + COMMON_PACKAGES
    )


def ask_copilot(image_path, goal, width, height, elements):
    with open(image_path, "rb") as fh:
        img_b64 = base64.b64encode(fh.read()).decode("ascii")

    payload = {
        "model": MODEL,
        "prompt": build_copilot_prompt(goal, width, height, elements),
        "images": [img_b64],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0, "num_ctx": NUM_CTX},
    }
    req = urllib.request.Request(
        OLLAMA_URL + "/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    raw = data.get("response", "").strip()
    parsed = json.loads(raw)
    return {
        "summary": str(parsed.get("summary", "")),
        "reason": str(parsed.get("reason", "")),
        "action": normalize_action(parsed.get("action", {})),
    }


def main():
    global SERIAL
    SERIAL = resolve_serial()
    if not adb_ready():
        print("❌ 没有检测到已授权的安卓设备。")
        sys.exit(1)

    goal = sys.argv[1] if len(sys.argv) > 1 else "帮我看看现在屏幕上有什么"
    width, height = screen_size()
    print(f"✅ 设备 {SERIAL} · 分辨率 {width}x{height} · 模型：{MODEL}\n")
    print("副驾模式：读屏 + 精确坐标 + 人确认。")
    print("  [y/回车] 执行 · [s] 跳过重看 · [输入文字] 改目标 · [q] 退出\n")

    while True:
        # 常见单步指令：规则直达，不走模型
        det = deterministic_action(goal)
        if det:
            print(f"🎯 规则直达：{goal} → {json.dumps(det, ensure_ascii=False)}")
            ok = act(det)
            print("   ✅ 完成" if ok else "   ⚠️ 执行失败")
            break

        if not screencap():
            print("❌ 截屏失败，adb 连接可能断开")
            sys.exit(1)
        elements = get_ui_elements()

        try:
            result = ask_copilot(SCREENSHOT, goal, width, height, elements)
        except Exception as exc:
            print(f"❌ 模型调用失败：{exc}")
            sys.exit(1)

        action = result["action"]
        print("┌─ 目标：", goal)
        print("│  屏幕：", result["summary"] or "(无)")
        print("│  理由：", result["reason"] or "(无)")
        print("└─ 建议：", json.dumps(action, ensure_ascii=False))

        try:
            choice = input("\n执行？[y/回车=执行 | s=跳过 | 输入新目标 | q=退出] ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n退出")
            break

        low = choice.lower()
        if low == "q":
            break
        if low == "s":
            continue
        if low != "y" and choice != "":
            goal = choice
            continue

        if action.get("action") == "done":
            print("🎉 目标已完成")
            break
        ok = act(action)
        print("✅ 已执行" if ok else "⚠️  执行失败")
        time.sleep(1.2)


if __name__ == "__main__":
    main()
