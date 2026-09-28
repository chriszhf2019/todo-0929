package com.voxflow.todo;

import android.graphics.Bitmap;
import android.util.Log;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

import java.util.ArrayList;
import java.util.List;

/**
 * On-device Chinese OCR via ML Kit's bundled recognizer (ships inside the APK,
 * no download, no Play Services). Recognizes a screenshot Bitmap and returns its
 * text lines in reading order. Recognition is asynchronous; the callback runs on
 * ML Kit's thread.
 */
final class MlKitOcr {

    private static final String TAG = "MlKitOcr";

    private final TextRecognizer recognizer;

    MlKitOcr() {
        recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
    }

    void recognize(Bitmap bitmap, ResultCallback callback) {
        try {
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            recognizer.process(image)
                .addOnSuccessListener(text -> {
                    List<String> lines = new ArrayList<>();
                    for (Text.TextBlock block : text.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            String t = line.getText();
                            if (t != null && !t.trim().isEmpty()) {
                                lines.add(t.trim());
                            }
                        }
                    }
                    callback.onResult(lines);
                })
                .addOnFailureListener(e -> {
                    Log.w(TAG, "ocr failed: " + e.getMessage());
                    callback.onResult(new ArrayList<>());
                });
        } catch (Exception e) {
            Log.w(TAG, "ocr exception: " + e.getMessage());
            callback.onResult(new ArrayList<>());
        }
    }

    void close() {
        try {
            recognizer.close();
        } catch (Exception ignored) {
        }
    }

    interface ResultCallback {
        void onResult(List<String> lines);
    }
}
