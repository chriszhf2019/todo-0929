#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
记言 Todo · 手机助手（自己用）—— 最小闭环

原理：手机当眼睛和手（无线 adb），Mac 当大脑（本地 Ollama 视觉模型）。
循环：截屏 → 视觉模型看屏输出下一步动作 → adb 执行 → 再截屏验证。

用法：
  python3 assistant.py "打开设置"
  MODEL=qwen2.5vl:7b python3 assistant.py "打开微信"

依赖（一次性）：
  - adb（已装到 ~/android-platform-tools/platform-tools/adb，并软链到 /opt/homebrew/bin）
  - ollama pull qwen2.5vl:7b（或 llava）
  - 手机连接：USB 或无线调试均可

已知限制：
  - 通用视觉模型的像素坐标精度有限，可能点偏，属正常，多步会自行纠正。
  - 本闭环只做 tap / swipe / back / home / open_app，暂不含中文输入（
    adb 原生 input text 不支持中文，需 ADBKeyboard，后续再加）。
"""

import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

# 环境变量可覆盖：OLLAMA_URL / MODEL / MAX_STEPS / NUM_CTX
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("MODEL", "llava")
MAX_STEPS = int(os.environ.get("MAX_STEPS", "10"))
# 视觉模型默认上下文只有 4096，一张截图就吃掉 ~4200 token，必须调大
NUM_CTX = int(os.environ.get("NUM_CTX", "16384"))
SCREENSHOT = "/tmp/vox_assistant_screen.png"

# 选定设备的序列号；在 main 里解析，adb 命令统一带 -s
SERIAL = ""


def run(cmd):
    """执行 shell 命令，返回 (returncode, stdout, stderr)。stdin 断开，避免子进程抢占输入。"""
    proc = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, stdin=subprocess.DEVNULL
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def adb(cmd):
    """拼带 -s 序列号的 adb 命令（字符串形式）。"""
    return f"adb -s {SERIAL} {cmd}"


def resolve_serial():
    """从 adb devices 里挑一台已授权设备。优先选普通 USB 序列号（非 mDNS 无线条目）。"""
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
    # 优先返回不带 mDNS 后缀的普通序列号（USB 直连）
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
    """截屏：先写手机 /sdcard，再 pull 回本地。

    不用 `exec-out screencap` 是因为折叠屏等多显示设备会把
    `[Warning] Multiple displays...` 警告混进 PNG 头部，导致图片损坏。
    """
    remote = "/sdcard/vox_assistant_screen.png"
    code, _, _ = run(adb(f"shell screencap -p {remote}"))
    if code != 0:
        return False
    code, _, _ = run(f"adb -s {SERIAL} pull {remote} {path}")
    return code == 0 and os.path.exists(path) and os.path.getsize(path) > 0


ACTION_SCHEMA = (
    '{"action": "tap", "x": <int>, "y": <int>}  点击屏幕坐标\n'
    '{"action": "swipe", "x1": <int>, "y1": <int>, "x2": <int>, "y2": <int>}  从(x1,y1)滑到(x2,y2)\n'
    '{"action": "back"}  返回上一页\n'
    '{"action": "home"}  回到桌面\n'
    '{"action": "open_app", "package": "<包名>"}  打开某个应用\n'
    '{"action": "done"}  目标已完成，立即停止'
)

# 常见应用包名，方便模型直接用 open_app 而不是瞎滑找图标
COMMON_PACKAGES = (
    "设置=com.android.settings，微信=com.tencent.mm，电话=com.google.android.dialer，"
    "短信=com.google.android.apps.messaging，相机=com.google.android.GoogleCamera，"
    "浏览器=com.android.chrome，图库=com.google.android.apps.photos"
)


def build_prompt(goal, width, height):
    return (
        f"你是一个安卓手机操作助手。屏幕分辨率是 {width}x{height}。\n"
        f"用户目标：{goal}\n"
        "请仔细观察当前屏幕截图，先判断「目标是否已经达成」："
        "如果当前屏幕已经满足目标，直接输出 done，不要做任何多余动作。\n"
        "如果未达成，判断下一步该做的唯一一个动作。"
        "不要连续重复同一个动作超过两次。\n"
        "常见应用包名：" + COMMON_PACKAGES + "\n"
        "只输出一个 JSON 对象，不要输出任何其他文字。可选动作：\n" + ACTION_SCHEMA
    )


def file_hash(path):
    with open(path, "rb") as fh:
        return hashlib.md5(fh.read()).hexdigest()


def ask_model(image_path, goal, width, height):
    """把截图发给 Ollama 视觉模型，返回动作 dict。"""
    with open(image_path, "rb") as fh:
        img_b64 = base64.b64encode(fh.read()).decode("ascii")

    payload = {
        "model": MODEL,
        "prompt": build_prompt(goal, width, height),
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
    return json.loads(raw)


# 模型输出常见的动作名别名 / 畸形，归一化成标准动作
ACTION_ALIASES = {
    "click": "tap",
    "press": "tap",
    "tap": "tap",
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
    """把模型可能输出的畸形动作（click / x=[x,y] / 多余字段）修复成标准动作。"""
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


def act(action):
    kind = action.get("action")
    try:
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
        if kind == "done":
            return True
    except (KeyError, TypeError, ValueError):
        return False
    return False


def main():
    global SERIAL
    SERIAL = resolve_serial()

    if not adb_ready():
        print("❌ 没有检测到已授权的安卓设备。请确认：")
        print("   1. USB 已连接，或无线调试已开且 adb connect 成功")
        print("   2. 手机上点「允许 USB 调试 / 允许无线调试」")
        sys.exit(1)

    goal = sys.argv[1] if len(sys.argv) > 1 else "打开设置应用"
    width, height = screen_size()
    print(f"✅ 设备 {SERIAL} · 分辨率 {width}x{height} · 目标：{goal} · 模型：{MODEL}\n")

    prev_hash = None
    for step in range(1, MAX_STEPS + 1):
        if not screencap():
            print("❌ 截屏失败，adb 连接可能断开")
            sys.exit(1)

        cur_hash = file_hash(SCREENSHOT)
        if prev_hash is not None and cur_hash == prev_hash:
            print("🎉 屏幕已无变化，判定目标已达成或动作无效，停止")
            break
        prev_hash = cur_hash

        try:
            action = normalize_action(ask_model(SCREENSHOT, goal, width, height))
        except Exception as exc:
            print(f"❌ 模型调用失败：{exc}")
            sys.exit(1)

        print(f"第 {step} 步：{json.dumps(action, ensure_ascii=False)}")

        if action.get("action") == "done":
            print("🎉 目标完成")
            break

        if not act(action):
            print(f"⚠️  动作执行失败：{action}")
        time.sleep(1.5)
    else:
        print("⚠️  达到最大步数，可能未完成")


if __name__ == "__main__":
    main()
