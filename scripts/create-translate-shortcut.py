#!/usr/bin/env python3
"""
Creates and opens a 'Translate Screenshot' Shortcut that:
  1. Recognizes text in the input image (OCR via Apple Vision)
  2. Translates the text to English
  3. Copies the result to clipboard
  4. Shows a notification with the translation
"""

import plistlib
import subprocess
import tempfile
import os
import uuid

def new_uuid():
    return str(uuid.uuid4()).upper()

def action_output_ref(action_uuid, output_name):
    return {
        "Value": {
            "OutputName": output_name,
            "OutputUUID": action_uuid,
            "Type": "ActionOutput",
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }

recognize_uuid = new_uuid()
translate_uuid = new_uuid()

shortcut = {
    "WFWorkflowActions": [
        # Step 1: Recognize text in the input image (Apple Vision OCR)
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.extracttextfromimage",
            "WFWorkflowActionParameters": {
                "CustomOutputName": "Recognized Text",
                "UUID": recognize_uuid,
                "WFImage": {
                    "Value": {"Type": "ExtensionInput"},
                    "WFSerializationType": "WFTextTokenAttachment",
                },
            },
        },
        # Step 2: Translate recognized text (auto-detect → English)
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.translate",
            "WFWorkflowActionParameters": {
                "CustomOutputName": "Translation",
                "UUID": translate_uuid,
                "WFInputText": action_output_ref(recognize_uuid, "Recognized Text"),
                "WFTranslateTextLanguage": "en",
            },
        },
        # Step 3: Copy translation to clipboard
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.setclipboard",
            "WFWorkflowActionParameters": {
                "WFInput": action_output_ref(translate_uuid, "Translation"),
            },
        },
        # Step 4: Show notification with the translated text
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
            "WFWorkflowActionParameters": {
                "WFNotificationActionBody": action_output_ref(translate_uuid, "Translation"),
                "WFNotificationActionTitle": "Translation",
                "WFNotificationActionSound": False,
            },
        },
    ],
    "WFWorkflowClientVersion": "1240.0.0.0.0",
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowIcon": {
        "WFWorkflowIconGlyphNumber": 59511,
        "WFWorkflowIconStartColor": 4292093695,
    },
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": ["WFImageContentItem"],
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowName": "Translate Screenshot",
    "WFWorkflowTypes": [],
}

# Write unsigned shortcut to temp file
unsigned = tempfile.NamedTemporaryFile(suffix=".shortcut", delete=False)
plistlib.dump(shortcut, unsigned, fmt=plistlib.FMT_BINARY)
unsigned.close()

# Sign it so Shortcuts accepts it
signed_path = os.path.join(tempfile.gettempdir(), "TranslateScreenshot.shortcut")
result = subprocess.run(
    ["shortcuts", "sign", "--mode", "anyone", "--input", unsigned.name, "--output", signed_path],
    capture_output=True, text=True
)
os.unlink(unsigned.name)

if result.returncode != 0:
    print(f"❌ Signing failed: {result.stderr}")
    exit(1)

# Open the signed shortcut — Shortcuts app will prompt to add it
subprocess.run(["open", signed_path])
print("✅ Shortcuts app should now be open — click 'Add Shortcut' to install it.")
print("   Once added, the script at scripts/screenshot-translate.sh will call it automatically.")
