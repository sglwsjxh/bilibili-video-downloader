package downloader

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/sglwsjxh/bilibili-video-download/backend/internal/messaging"
)

type Downloader struct {
	client *http.Client
}

func New() *Downloader {
	return &Downloader{
		client: &http.Client{
			Timeout: 30 * time.Minute,
			Transport: &http.Transport{
				MaxIdleConns:    10,
				IdleConnTimeout: 30 * time.Second,
			},
		},
	}
}

type ProgressFn func(track string, loaded, total int64, done bool, msg string)

func (d *Downloader) DownloadTracks(ctx context.Context, jobID string, video, audio messaging.TrackInfo, outputDir string, onProgress ProgressFn) (videoPath, audioPath string, err error) {
	videoPath = filepath.Join(outputDir, ".bili-video-tmp-"+jobID+"-video.mp4")
	audioPath = filepath.Join(outputDir, ".bili-video-tmp-"+jobID+"-audio.mp3")

	errCh := make(chan error, 2)

	go func() {
		errCh <- d.downloadFile(ctx, videoPath, video.URL, video.BackupURLs, "video", onProgress)
	}()

	go func() {
		errCh <- d.downloadFile(ctx, audioPath, audio.URL, audio.BackupURLs, "audio", onProgress)
	}()

	for i := 0; i < 2; i++ {
		if e := <-errCh; e != nil {
			err = e
		}
	}

	return
}

func (d *Downloader) downloadFile(ctx context.Context, dest, primaryURL string, backupURLs []string, track string, onProgress ProgressFn) error {
	urls := append([]string{primaryURL}, backupURLs...)
	var lastErr error

	for i, url := range urls {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if i > 0 {
			onProgress(track, 0, 0, false, fmt.Sprintf("切换备用线路 %d/%d", i, len(urls)-1))
		}
		err := d.downloadURL(ctx, dest, url, track, onProgress)
		if err == nil {
			return nil
		}
		lastErr = err
		log.Printf("%s download failed (url %d/%d): %v", track, i+1, len(urls)-1, err)
	}

	return fmt.Errorf("all URLs failed for %s: %w", track, lastErr)
}

func (d *Downloader) downloadURL(ctx context.Context, dest, url, track string, onProgress ProgressFn) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Referer", "https://www.bilibili.com/")
	req.Header.Set("Origin", "https://www.bilibili.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer out.Close()

	total := resp.ContentLength
	if total < 0 {
		total = 0
	}
	var loaded int64
	buf := make([]byte, 32*1024)
	lastReport := time.Now()

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := out.Write(buf[:n])
			if writeErr != nil {
				return fmt.Errorf("write file: %w", writeErr)
			}
			loaded += int64(n)
			if time.Since(lastReport) > 200*time.Millisecond {
				onProgress(track, loaded, total, false, "")
				lastReport = time.Now()
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("read body: %w", readErr)
		}
	}

	onProgress(track, loaded, total, true, "")
	return nil
}
