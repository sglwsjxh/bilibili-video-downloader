Dim args, rawUrl, cmdPart, shell, psCmd
Set args = WScript.Arguments
If args.Count = 0 Then WScript.Quit 1
rawUrl = args(0)
cmdPart = Mid(rawUrl, Len("ffmpeg-run://") + 1)

psCmd = "powershell.exe -ExecutionPolicy Bypass -Command ""$c=[System.Uri]::UnescapeDataString('" & cmdPart & "'); Start-Process cmd -ArgumentList '/c',$c -Wait -WindowStyle Hidden"""

Set shell = CreateObject("WScript.Shell")
shell.Run psCmd, 0, False