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
                # WSL: Copy to clipboard then paste with Ctrl+V
                # SendKeys.SendWait interprets special chars and has buffer limits,
                # so clipboard paste is more reliable for longer text.
                escaped = text.replace("'", "''")
                subprocess.run(
                    [
                        "powershell.exe", "-c",
                        f"Set-Clipboard -Value '{escaped}'; "
                        f"Add-Type -AssemblyName System.Windows.Forms; "
                        f"[System.Windows.Forms.SendKeys]::SendWait('^v')"
                    ],
                    check=True,
                    timeout=10,
                )
            else:
                return False
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def focus_and_type(self, text: str, target_window: str = '', use_alt_tab: bool = False) -> tuple[bool, bool]:
        """
        Focus a window then type text in a single atomic operation.

        On WSL/sendkeys this runs as ONE PowerShell call so the focus obtained
        in step 1 is guaranteed to still be active when Ctrl+V fires in step 2.
        Returns (focused: bool, typed: bool).
        """
        if self.tool != "sendkeys":
            # Non-WSL: fall back to separate calls (no race condition on X11/Wayland)
            import time
            focused = False
            if target_window:
                focused = self.focus_window_by_title(target_window)
            elif use_alt_tab:
                focused = self.focus_previous_window()
            if focused:
                time.sleep(0.3)
            typed = self.type_text(text)
            return focused, typed

        escaped_text = text.replace("'", "''")

        # Build the focus block (runs inside the same PS process)
        if target_window:
            escaped_title = target_window.replace("'", "''")
            focus_block = (
                "$p = Get-Process | Where-Object { "
                "$_.MainWindowTitle -like '*" + escaped_title + "*' -and $_.MainWindowHandle -ne 0 "
                "} | Select-Object -First 1; "
                "if ($p) { "
                "try { Add-Type -MemberDefinition "
                "'[DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);' "
                "-Name WinAPI -Namespace BVKB -PassThru | Out-Null } catch {}; "
                "[BVKB.WinAPI]::SetForegroundWindow($p.MainWindowHandle) | Out-Null; "
                "Start-Sleep -Milliseconds 500; "
                "$focused = $true "
                "} else { $focused = $false }; "
            )
        elif use_alt_tab:
            focus_block = (
                "Add-Type -AssemblyName System.Windows.Forms; "
                "[System.Windows.Forms.SendKeys]::SendWait('%{TAB}'); "
                "Start-Sleep -Milliseconds 500; "
                "$focused = $true; "
            )
        else:
            focus_block = "$focused = $false; "

        paste_block = (
            f"Set-Clipboard -Value '{escaped_text}'; "
            "Add-Type -AssemblyName System.Windows.Forms; "
            "[System.Windows.Forms.SendKeys]::SendWait('^v'); "
            "Write-Output \"$focused|ok\""
        )

        try:
            result = subprocess.run(
                ["powershell.exe", "-c", focus_block + paste_block],
                capture_output=True,
                text=True,
                timeout=15,
            )
            output = result.stdout.strip()
            focused = output.startswith("True") or output.startswith("$true") or "|ok" in output and output.split("|")[0].lower() == "true"
            typed = "|ok" in output
            return focused, typed
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False, False

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
