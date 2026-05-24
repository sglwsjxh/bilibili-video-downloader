package job

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/sglwsjxh/bilibili-video-download/backend/internal/downloader"
	"github.com/sglwsjxh/bilibili-video-download/backend/internal/ffmpeg"
	"github.com/sglwsjxh/bilibili-video-download/backend/internal/messaging"
)

type Manager struct {
	mu      sync.Mutex
	jobs    map[string]*Job
	stopCh  chan struct{}
	cancels map[string]context.CancelFunc
}

type Job struct {
	ID      string
	Payload messaging.DownloadStartPayload
	State   string
}

func NewManager() *Manager {
	return &Manager{
		jobs:    make(map[string]*Job),
		stopCh:  make(chan struct{}),
		cancels: make(map[string]context.CancelFunc),
	}
}

func (m *Manager) StartJob(id string, payload messaging.DownloadStartPayload) {
	m.mu.Lock()
	m.jobs[id] = &Job{ID: id, Payload: payload, State: "starting"}
	m.mu.Unlock()

	go m.runJob(id, payload)
}

func (m *Manager) CancelJob(id string) {
	m.mu.Lock()
	cancel, ok := m.cancels[id]
	if ok {
		cancel()
	}
	m.mu.Unlock()
	log.Printf("job %s: cancelled", id)
}

func (m *Manager) runJob(id string, payload messaging.DownloadStartPayload) {
	ctx, cancel := context.WithCancel(context.Background())
	m.mu.Lock()
	m.cancels[id] = cancel
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		delete(m.cancels, id)
		m.mu.Unlock()
		cancel()
	}()

	log.Printf("job %s: starting download for %s", id, payload.Title)

	if ctx.Err() != nil {
		messaging.WriteMessageSafe(os.Stdout, messaging.NewError(id, "cancelled"))
		return
	}

	dl := downloader.New()

	onProgress := func(track string, loaded, total int64, done bool, msg string) {
		msgType := messaging.MsgTypeDownloadProgress
		if done {
			msgType = messaging.MsgTypeDownloadDone
		}
		messaging.WriteMessageSafe(os.Stdout, messaging.NewMessage(
			msgType, id,
			messaging.DownloadProgressPayload{
				Track:  track,
				Loaded: loaded,
				Total:  total,
				Done:   done,
				Msg:    msg,
			},
		))
	}

	videoPath, audioPath, err := dl.DownloadTracks(ctx, id, payload.Video, payload.Audio, payload.OutputDir, onProgress)
	if err != nil {
		log.Printf("job %s: download failed: %v", id, err)
		messaging.WriteMessageSafe(os.Stdout, messaging.NewError(id, err.Error()))
		return
	}

	log.Printf("job %s: downloads complete, merging", id)

	messaging.WriteMessageSafe(os.Stdout, messaging.NewMessage(
		messaging.MsgTypeMergeProgress, id,
		messaging.MergeProgressPayload{Done: false, Msg: "正在合成..."},
	))

	merger := ffmpeg.New()
	outputPath, err := merger.Merge(videoPath, audioPath, payload.Title)
	if err != nil {
		log.Printf("job %s: merge failed: %v", id, err)
		messaging.WriteMessageSafe(os.Stdout, messaging.NewError(id, err.Error()))
		return
	}

	messaging.WriteMessageSafe(os.Stdout, messaging.NewMessage(
		messaging.MsgTypeMergeDone, id,
		messaging.MergeProgressPayload{Done: true},
	))

	log.Printf("job %s: complete -> %s", id, outputPath)
	messaging.WriteMessageSafe(os.Stdout, messaging.NewMessage(
		messaging.MsgTypeJobDone, id,
		messaging.JobDonePayload{OutputPath: outputPath},
	))
}

func (m *Manager) Stop() {
	close(m.stopCh)
}
