"""Cross-platform keyboard emulation abstraction."""
import os
import shutil
import subprocess
import platform


class KeyboardEmulator:
    """Auto-detects and uses the appropriate keyboard typing tool."""

    def __init__(self, tool: str = "auto"):
        self.tool = tool if tool != "auto" else self._detect_tool()

    def _detect_tool(self) -> str:
        """Auto-detect available keyboard emulation tool."""
        # WSL detection
        if "microsoft" in platform.release().lower():
            return "sendkeys"

        session_type = os.environ.get("XDG_SESSION_TYPE", "").lower()

        if session_type == "wayland":
            if shutil.which("ydotool"):
                return "ydotool"
            if shutil.which("wtype"):
                return "wtype"

        # X11 or fallback
        if shutil.which("xdotool"):
            return "xdotool"

        return "none"

    def focus_previous_window(self) -> bool:
        """Switch focus to the previous window (Alt+Tab). Returns True on success."""
        if self.tool == "none":
            return False

        try:
            if self.tool == "xdotool":
                subprocess.run(
                    ["xdotool", "key", "alt+Tab"],
                    check=True,
                    timeout=5,
                )
            elif self.tool == "ydotool":
                # ydotool: Alt keydown, Tab press, Alt keyup
                subprocess.run(
                    ["ydotool", "key", "56:1", "15:1", "15:0", "56:0"],
                    check=True,
                    timeout=5,
                )
            elif self.tool == "wtype":
                subprocess.run(
                    ["wtype", "-M", "alt", "-k", "Tab", "-m", "alt"],
                    check=True,
                    timeout=5,
                )
            elif self.tool == "sendkeys":
                subprocess.run(
                    [
                        "powershell.exe", "-c",
                        "Add-Type -AssemblyName System.Windows.Forms; "
                        "[System.Windows.Forms.SendKeys]::SendWait('%{TAB}')"
                    ],
                    check=True,
                    timeout=5,
                )
            else:
                return False
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def focus_window_by_title(self, title: str) -> bool:
        """Focus a specific window by (partial) title match. Returns True on success."""
        if self.tool == "none":
            return False

        try:
            if self.tool in ("xdotool",):
                # Find window by partial name and activate it
                result = subprocess.run(
                    ["xdotool", "search", "--name", title],
                    capture_output=True, text=True, timeout=5,
                )
                wids = result.stdout.strip().split("\n")
                if wids and wids[0]:
                    subprocess.run(
                        ["xdotool", "windowactivate", wids[-1]],
                        check=True, timeout=5,
                    )
                    return True
                return False
            elif self.tool == "sendkeys":
                # PowerShell: Find window by partial title match and activate it
                escaped = title.replace("'", "''")
                subprocess.run(
                    [
                        "powershell.exe", "-c",
                        "$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*"
                        + escaped
                        + "*' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1; "
                        "if ($p) { "
                        "Add-Type '[DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name W -Namespace U; "
                        "[U.W]::SetForegroundWindow($p.MainWindowHandle) "
                        "} else { exit 1 }"
                    ],
                    check=True,
                    timeout=5,
                )
                return True
            else:
                # Fallback to Alt+Tab for ydotool/wtype
                return self.focus_previous_window()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def type_text(self, text: str) -> bool:
        """Type text at current cursor position. Returns True on success."""
        if self.tool == "none":
            return False

        try:
            if self.tool == "xdotool":
                subprocess.run(
                    ["xdotool", "type", "--clearmodifiers", text],
                    check=True,
                    timeout=10,
                )
            elif self.tool == "ydotool":
                subprocess.run(
                    ["ydotool", "type", text],
                    check=True,
                    timeout=10,
                )
            elif self.tool == "wtype":
                subprocess.run(
                    ["wtype", text],
                    check=True,
                    timeout=10,
                )
            elif self.tool == "sendkeys":
                # WSL: Use PowerShell SendKeys
                escaped = text.replace("'", "''")
                subprocess.run(
                    [
                        "powershell.exe", "-c",
                        f"Add-Type -AssemblyName System.Windows.Forms; "
                        f"[System.Windows.Forms.SendKeys]::SendWait('{escaped}')"
                    ],
                    check=True,
                    timeout=10,
                )
            else:
                return False
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def list_windows(self) -> list[dict[str, str]]:
        """Return a list of visible windows with titles. Each entry has 'title' and 'process'."""
        if self.tool == "none":
            return []

        try:
            if self.tool == "sendkeys":
                result = subprocess.run(
                    [
                        "powershell.exe", "-c",
                        "Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowHandle -ne 0 } "
                        "| Select-Object ProcessName, MainWindowTitle "
                        "| ForEach-Object { $_.ProcessName + '|' + $_.MainWindowTitle }"
                    ],
                    capture_output=True, text=True, timeout=5,
                )
                windows = []
                seen = set()
                for line in result.stdout.strip().split("\n"):
                    line = line.strip()
                    if not line or "|" not in line:
                        continue
                    process, title = line.split("|", 1)
                    if title and title not in seen:
                        seen.add(title)
                        windows.append({"title": title, "process": process})
                return windows
            elif self.tool == "xdotool":
                result = subprocess.run(
                    ["xdotool", "search", "--onlyvisible", "--name", ""],
                    capture_output=True, text=True, timeout=5,
                )
                windows = []
                seen = set()
                for wid in result.stdout.strip().split("\n"):
                    if not wid.strip():
                        continue
                    name_result = subprocess.run(
                        ["xdotool", "getwindowname", wid.strip()],
                        capture_output=True, text=True, timeout=2,
                    )
                    title = name_result.stdout.strip()
                    if title and title not in seen:
                        seen.add(title)
                        windows.append({"title": title, "process": ""})
                return windows[:30]  # Limit to avoid flooding
            else:
                return []
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return []

    @property
    def available(self) -> bool:
        return self.tool != "none"
