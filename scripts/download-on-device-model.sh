#!/usr/bin/env bash
set -euo pipefail

# 下载 MediaPipe Gemma 端侧模型（.task 文件）。
#
# 应用默认采用「首次运行下载」，直链由 DEFAULT_ON_DEVICE_MODEL_URL 配置
# （src/lib/nativeBridge.ts）。此脚本用于在有网环境预下载 / 验证直链。
#
# 官方模型来源：
#   - Kaggle:   https://www.kaggle.com/models/google/gemma-2/tfLite/gemma-2b-it-gpu-int4
#   - Hugging Face: https://huggingface.co/litert-community/Gemma2-2B-IT

MODEL_URL="${ON_DEVICE_MODEL_URL:-https://huggingface.co/litert-community/Gemma2-2B-IT/resolve/main/gemma-2b-it-gpu-int4.task}"
OUT_FILE="${1:-./dist/on-device/gemma.task}"

mkdir -p "$(dirname "$OUT_FILE")"
echo "下载端侧模型 -> $OUT_FILE"
echo "来源: $MODEL_URL"
curl -L --fail --progress-bar -o "$OUT_FILE" "$MODEL_URL"
echo ""
echo "完成: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
echo "如需打包进 APK，请把该文件放到 android/app/src/main/assets/ 并改用 assets 加载；"
echo "否则请在可访问的环境托管该文件，并在应用设置里配置直链地址。"
