param(
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$DelayMs = 20,
    [ValidateSet('unicode', 'scancode')][string]$Mode = 'unicode'
)

$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class AutoTyper
{
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion u; }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern short VkKeyScan(char ch);

    [DllImport("user32.dll")]
    static extern uint MapVirtualKey(uint uCode, uint uMapType);

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const uint KEYEVENTF_SCANCODE = 0x0008;
    const ushort VK_RETURN = 0x0D;
    const ushort VK_TAB = 0x09;
    const ushort SC_LSHIFT = 0x2A;

    static INPUT Key(ushort vk, ushort scan, uint flags)
    {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = vk;
        input.u.ki.wScan = scan;
        input.u.ki.dwFlags = flags;
        return input;
    }

    static void Send(params INPUT[] inputs)
    {
        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void PressVk(ushort vk)
    {
        ushort scan = (ushort)MapVirtualKey(vk, 0);
        Send(Key(vk, scan, 0), Key(vk, scan, KEYEVENTF_KEYUP));
    }

    static void SendUnicode(char c)
    {
        Send(Key(0, c, KEYEVENTF_UNICODE), Key(0, c, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }

    static void SendScanCode(char c)
    {
        short res = VkKeyScan(c);
        // No key on the current layout produces this char (or it needs Ctrl/Alt) - fall back to unicode.
        if (res == -1 || (res & 0x0600) != 0)
        {
            SendUnicode(c);
            return;
        }
        ushort scan = (ushort)MapVirtualKey((uint)(res & 0xFF), 0);
        bool shift = (res & 0x0100) != 0;
        if (shift)
        {
            Send(Key(0, SC_LSHIFT, KEYEVENTF_SCANCODE));
        }
        Send(Key(0, scan, KEYEVENTF_SCANCODE), Key(0, scan, KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP));
        if (shift)
        {
            Send(Key(0, SC_LSHIFT, KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP));
        }
    }

    public static void Type(string text, int delayMs, bool scanCodeMode)
    {
        text = text.Replace("\r\n", "\n").Replace("\r", "\n");
        Console.Out.WriteLine("T:" + text.Length);
        Console.Out.Flush();

        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (c == '\n')
            {
                PressVk(VK_RETURN);
            }
            else if (c == '\t')
            {
                PressVk(VK_TAB);
            }
            else if (scanCodeMode && c < 128)
            {
                SendScanCode(c);
            }
            else
            {
                SendUnicode(c);
            }

            if (delayMs > 0)
            {
                Thread.Sleep(delayMs);
            }
            if ((i + 1) % 5 == 0 || i == text.Length - 1)
            {
                Console.Out.WriteLine("P:" + (i + 1));
                Console.Out.Flush();
            }
        }
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

$text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue

[AutoTyper]::Type($text, $DelayMs, $Mode -eq 'scancode')
