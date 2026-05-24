package messaging

const (
	MsgTypeDownloadStart    = "download.start"
	MsgTypeDownloadProgress = "download.progress"
	MsgTypeDownloadDone     = "download.done"
	MsgTypeMergeProgress    = "merge.progress"
	MsgTypeMergeDone        = "merge.done"
	MsgTypeJobDone          = "job.done"
	MsgTypeJobError         = "job.error"
	MsgTypeSelectDir        = "select.dir"
	MsgTypeSelectDirResult  = "select.dir.result"
	MsgTypeCancel           = "cancel"
	MsgTypeParseResult      = "parse.result"
)

type Envelope struct {
	Version int    `json:"v"`
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Payload any    `json:"payload,omitempty"`
	Error   string `json:"error,omitempty"`
}

type TrackInfo struct {
	ID         int      `json:"id"`
	URL        string   `json:"url"`
	BackupURLs []string `json:"backupUrls,omitempty"`
	Bandwidth  int      `json:"bandwidth,omitempty"`
	Width      int      `json:"width,omitempty"`
	Height     int      `json:"height,omitempty"`
	Codecs     string   `json:"codecs,omitempty"`
	MimeType   string   `json:"mimeType,omitempty"`
	QualityLbl string   `json:"qualityLabel,omitempty"`
}

type ParseResultPayload struct {
	Title       string      `json:"title"`
	VideoTracks []TrackInfo `json:"videoTracks"`
	AudioTracks []TrackInfo `json:"audioTracks"`
	SelectedVid *TrackInfo  `json:"selectedVideo,omitempty"`
	SelectedAud *TrackInfo  `json:"selectedAudio,omitempty"`
}

type DownloadStartPayload struct {
	Title        string     `json:"title"`
	Video        TrackInfo  `json:"video"`
	Audio        TrackInfo  `json:"audio"`
	OutputDir    string     `json:"outputDir"`
}

type DownloadProgressPayload struct {
	Track  string `json:"track"`
	Loaded int64  `json:"loaded"`
	Total  int64  `json:"total"`
	Done   bool   `json:"done"`
	Msg    string `json:"msg,omitempty"`
}

type MergeProgressPayload struct {
	Done  bool   `json:"done"`
	Msg   string `json:"msg,omitempty"`
}

type JobDonePayload struct {
	OutputPath string `json:"outputPath"`
}

type CancelPayload struct {
	JobID string `json:"jobId,omitempty"`
}

type SelectDirPayload struct {
	DefaultPath string `json:"defaultPath,omitempty"`
}

type SelectDirResultPayload struct {
	Path   string `json:"path"`
	Cancel bool   `json:"cancel"`
}
