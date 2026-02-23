; BACON-AI Voice Trigger — AutoHotkey v2
; =====================================================================
; Win+B  →  Start BACON-AI recording (if frontend is open in browser)
; Win+Shift+B  →  Capture active window title + start recording
;
; Prerequisites:
;   1. BACON-AI Voice backend running (STT-dev-restart.bat or start-dev.sh)
;   2. BACON-AI Voice frontend open in Chrome at http://localhost:5002
;   3. "Type to keyboard" enabled in the Output tab
;   4. For Win+B (simple): enable "Cursor Position mode" in QCS Output tab
;      OR set a Target Window in QCS first
;
; Installation:
;   - Double-click this file to run (requires AutoHotkey v2 installed)
;   - To auto-start on Windows boot:
;     Press Win+R → shell:startup → copy .ahk shortcut here
; =====================================================================

#Requires AutoHotkey v2.0

; ── Configuration ─────────────────────────────────────────────────────────────
; Update BACON_PORT to match your version (8700 + version number from src/version.json)
; v1 = 8701, v2 = 8702, etc.
BACON_PORT := 8702
ICONS_DIR := A_ScriptDir . "\icons\"

; ── Tray icon setup ──────────────────────────────────────────────────────────
TraySetIcon(ICONS_DIR . "mic-idle.png")
A_TrayMenu.Delete()
A_TrayMenu.Add("🎙 Start recording (Win+B)", TrayStartRecording)
A_TrayMenu.Add("🎯 Capture window + record (Win+Shift+B)", TrayCaptureAndRecord)
A_TrayMenu.Add()
A_TrayMenu.Add("⚙️ Open BACON-AI Voice", TrayOpenApp)
A_TrayMenu.Add()
A_TrayMenu.Add("❌ Exit", TrayExitApp)
A_TrayMenu.Default := "🎙 Start recording (Win+B)"

; ── Tray menu handlers ───────────────────────────────────────────────────────

TrayStartRecording(*) {
    TriggerRecording()
}

TrayCaptureAndRecord(*) {
    CaptureAndRecord()
}

TrayOpenApp(*) {
    global BACON_PORT
    Run("http://localhost:" . BACON_PORT . "/")
}

TrayExitApp(*) {
    ExitApp()
}

; ── Core functions ───────────────────────────────────────────────────────────

TriggerRecording() {
    global BACON_PORT, ICONS_DIR
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("POST", "http://localhost:" . BACON_PORT . "/recording/start", false)
        whr.SetRequestHeader("Content-Type", "application/json")
        whr.Send("{}")
        TraySetIcon(ICONS_DIR . "mic-active.png")
        ToolTip("🎙 BACON-AI listening…")
        SetTimer(ResetTrayIcon, -3000)
    } catch as e {
        ToolTip("❌ BACON-AI not running — start STT-dev-restart.bat")
        SetTimer(() => ToolTip(), -4000)
    }
}

ResetTrayIcon() {
    global ICONS_DIR
    ToolTip()
    TraySetIcon(ICONS_DIR . "mic-idle.png")
}

CaptureAndRecord() {
    global BACON_PORT
    activeTitle := WinGetTitle("A")
    try {
        ; Attempt to set target window
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("POST", "http://localhost:" . BACON_PORT . "/keyboard/set-target", false)
        whr.SetRequestHeader("Content-Type", "application/json")
        ; Escape quotes in window title for JSON
        safeTitle := StrReplace(activeTitle, "\", "\\")
        safeTitle := StrReplace(safeTitle, '"', '\"')
        whr.Send('{"target":"' . safeTitle . '"}')
    } catch {
        ; /keyboard/set-target not yet available — continue anyway
    }
    TriggerRecording()
}

; ── Hotkey bindings ──────────────────────────────────────────────────────────
; Win+B — Simple trigger (no window capture)
; Works best with "Cursor Position mode" ON in BACON-AI Voice Output tab.
; User keeps cursor in target terminal — beeps play — speak — text pastes.
#b:: TriggerRecording()

; Win+Shift+B — Capture window + trigger
; Captures the currently focused window title, sends it to the backend as the
; target window, then starts recording.
#+b:: CaptureAndRecord()
