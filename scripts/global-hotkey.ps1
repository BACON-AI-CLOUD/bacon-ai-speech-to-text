# BACON-AI Voice - Global Hotkey Listener
# Registers a system-wide hotkey (default: F2) that triggers recording toggle
# Usage: powershell.exe -ExecutionPolicy Bypass -File global-hotkey.ps1 [-Key F2] [-Url http://localhost:8765]

param(
    [string]$Key = "F2",
    [string]$Url = "http://localhost:8765"
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class HotKeyHelper {
    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern bool GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int x;
        public int y;
    }
}
"@

# Map key name to virtual key code
$keyMap = @{
    "F1" = 0x70; "F2" = 0x71; "F3" = 0x72; "F4" = 0x73;
    "F5" = 0x74; "F6" = 0x75; "F7" = 0x76; "F8" = 0x77;
    "F9" = 0x78; "F10" = 0x79; "F11" = 0x7A; "F12" = 0x7B;
    "Pause" = 0x13; "ScrollLock" = 0x91;
}

$vk = $keyMap[$Key]
if (-not $vk) {
    Write-Host "Unsupported key: $Key. Supported: $($keyMap.Keys -join ', ')" -ForegroundColor Red
    exit 1
}

$HOTKEY_ID = 1
$WM_HOTKEY = 0x0312

$registered = [HotKeyHelper]::RegisterHotKey([IntPtr]::Zero, $HOTKEY_ID, 0, $vk)
if (-not $registered) {
    Write-Host "Failed to register hotkey $Key - may already be in use" -ForegroundColor Red
    exit 1
}

Write-Host "BACON-AI Voice: Global hotkey [$Key] registered" -ForegroundColor Green
Write-Host "Press $Key from any window to toggle recording" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

try {
    $msg = New-Object HotKeyHelper+MSG
    while ([HotKeyHelper]::GetMessage([ref]$msg, [IntPtr]::Zero, 0, 0)) {
        if ($msg.message -eq $WM_HOTKEY) {
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[$ts] $Key pressed - toggling recording..." -ForegroundColor Yellow -NoNewline
            try {
                $response = Invoke-RestMethod -Uri "$Url/recording/toggle" -Method Post -TimeoutSec 3
                Write-Host " OK (clients: $($response.clients))" -ForegroundColor Green
            } catch {
                Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
} finally {
    [HotKeyHelper]::UnregisterHotKey([IntPtr]::Zero, $HOTKEY_ID)
    Write-Host "`nHotkey unregistered. Goodbye!" -ForegroundColor Gray
}
