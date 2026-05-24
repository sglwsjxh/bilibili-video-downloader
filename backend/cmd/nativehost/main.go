package main

import (
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/sglwsjxh/bilibili-video-download/backend/internal/job"
	"github.com/sglwsjxh/bilibili-video-download/backend/internal/messaging"
)

func main() {
	log.SetPrefix("[bili-host] ")
	log.SetFlags(log.Ltime | log.Lshortfile)

	manager := job.NewManager()
	defer manager.Stop()

	for {
		msg, err := messaging.ReadMessage(os.Stdin)
		if err != nil {
			log.Printf("read error: %v", err)
			break
		}

		switch msg.Type {
		case messaging.MsgTypeDownloadStart:
			var payload messaging.DownloadStartPayload
			if mapToStruct(msg.Payload, &payload) {
				payload.OutputDir = strings.ReplaceAll(payload.OutputDir, "/", "\\")
				manager.StartJob(msg.ID, payload)
			}

		case messaging.MsgTypeCancel:
			manager.CancelJob(msg.ID)

		case messaging.MsgTypeSelectDir:
			var payload messaging.SelectDirPayload
			if msg.Payload != nil {
				mapToStruct(msg.Payload, &payload)
			}
			result := selectDirectory(payload.DefaultPath)
			messaging.WriteMessageSafe(os.Stdout, messaging.NewMessage(
				messaging.MsgTypeSelectDirResult, msg.ID, result,
			))

		default:
			log.Printf("unknown message type: %s", msg.Type)
		}
	}
}

func mapToStruct(from any, to any) bool {
	data, err := json.Marshal(from)
	if err != nil {
		return false
	}
	return json.Unmarshal(data, to) == nil
}

func selectDirectory(defaultPath string) *messaging.SelectDirResultPayload {
	escapedPath := strings.ReplaceAll(defaultPath, "'", "''")
	psScript := `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择下载目录'; $f.SelectedPath = '` + escapedPath + `'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath } else { Write-Output 'CANCEL' }`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	output, err := cmd.Output()
	if err != nil {
		return &messaging.SelectDirResultPayload{Cancel: true}
	}

	path := strings.TrimSpace(string(output))
	if path == "CANCEL" || path == "" {
		return &messaging.SelectDirResultPayload{Cancel: true}
	}

	return &messaging.SelectDirResultPayload{Path: path, Cancel: false}
}
