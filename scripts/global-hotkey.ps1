<#
.SYNOPSIS
    BACON-AI Voice - Global Hotkey Listener for Windows
.DESCRIPTION
    Registers a system-wide hotkey (default: F2) that toggles recording
    in the BACON-AI Voice web UI by POSTing to the backend toggle endpoint.
.PARAMETER Hotkey
    The hotkey to register (default: F2). Supported: F1-F12, F13-F24.
.PARAMETER BackendUrl
    The backend URL (default: http://localhost:8765).
.EXAMPLE
    .\global-hotkey.ps1
    .\global-hotkey.ps1 -Hotkey F4
    .\global-hotkey.ps1 -Hotkey F2 -BackendUrl http://localhost:9000
#>

param(
    [string]$Hotkey = "F2",
    [string]$BackendUrl = "http://localhost:8765"
)

# Map hotkey name to virtual key code
$vkMap = @{
    "F1" = 0x70; "F2" = 0x71; "F3" = 0x72; "F4" = 0x73
    "F5" = 0x74; "F6" = 0x75; "F7" = 0x76; "F8" = 0x77
    "F9" = 0x78; "F10" = 0x79; "F11" = 0x7A; "F12" = 0x7B
    "F13" = 0x7C; "F14" = 0x7D; "F15" = 0x7E; "F16" = 0x7F
    "F17" = 0x80; "F18" = 0x81; "F19" = 0x82; "F20" = 0x83
    "F21" = 0x84; "F22" = 0x85; "F23" = 0x86; "F24" = 0x87
}

if (-not $vkMap.ContainsKey($Hotkey)) {
    Write-Host "Unsupported hotkey: $Hotkey. Supported: F1-F24" -ForegroundColor Red
    exit 1
}

$vk = $vkMap[$Hotkey]

# Import Win32 API functions
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class HotKeyHelper {
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll")] public static extern bool GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
    [StructLayout(LayoutKind.Sequential)] public struct MSG {
        public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam;
        public uint time; public int pt_x; public int pt_y;
    }
}
"@

$HOTKEY_ID = 1
$WM_HOTKEY = 0x0312

# Register the hotkey (no modifiers, just the key)
$registered = [HotKeyHelper]::RegisterHotKey([IntPtr]::Zero, $HOTKEY_ID, 0, $vk)
if (-not $registered) {
    Write-Host "Failed to register hotkey $Hotkey. It may be in use by another application." -ForegroundColor Red
    exit 1
}

Write-Host "BACON-AI Voice - Global Hotkey Listener" -ForegroundColor Cyan
Write-Host "Hotkey: $Hotkey | Backend: $BackendUrl/recording/toggle" -ForegroundColor Green
Write-Host "Press $Hotkey anywhere to toggle recording. Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

try {
    $msg = New-Object HotKeyHelper+MSG
    while ([HotKeyHelper]::GetMessage([ref]$msg, [IntPtr]::Zero, 0, 0)) {
        if ($msg.message -eq $WM_HOTKEY) {
            try {
                $response = Invoke-RestMethod -Uri "$BackendUrl/recording/toggle" -Method POST -TimeoutSec 2
                $clients = $response.clients
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Toggle sent to $clients client(s)" -ForegroundColor Green
            } catch {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Failed to reach backend: $_" -ForegroundColor Red
            }
        }
    }
} finally {
    [HotKeyHelper]::UnregisterHotKey([IntPtr]::Zero, $HOTKEY_ID)
    Write-Host "`nHotkey unregistered. Goodbye!" -ForegroundColor Cyan
}
