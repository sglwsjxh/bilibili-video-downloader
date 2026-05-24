package ffmpeg

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type Merger struct {
	ffmpegPath string
}

func New() *Merger {
	path, _ := exec.LookPath("ffmpeg")
	return &Merger{ffmpegPath: path}
}

func (m *Merger) Merge(videoPath, audioPath, title string) (string, error) {
	if m.ffmpegPath == "" {
		return "", fmt.Errorf("ffmpeg not found in PATH")
	}

	outputDir := filepath.Dir(videoPath)
	if filepath.Dir(videoPath) != filepath.Dir(audioPath) {
		outputDir, _ = filepath.Split(videoPath)
	}

	safeTitle := sanitizeFilename(title)
	outputPath := filepath.Join(outputDir, safeTitle+".mp4")

	cmd := exec.Command(m.ffmpegPath,
		"-y",
		"-i", videoPath,
		"-i", audioPath,
		"-c", "copy",
		outputPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg failed: %w\noutput: %s", err, string(output))
	}

	os.Remove(videoPath)
	os.Remove(audioPath)

	return outputPath, nil
}

func sanitizeFilename(name string) string {
	result := make([]byte, 0, len(name))
	for _, c := range []byte(name) {
		switch c {
		case '\\', '/', ':', '*', '?', '"', '<', '>', '|', '\'':
			result = append(result, '_')
		default:
			result = append(result, c)
		}
	}
	if len(result) > 80 {
		result = result[:80]
	}
	return string(result)
}
