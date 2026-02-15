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

    @property
    def available(self) -> bool:
        return self.tool != "none"
