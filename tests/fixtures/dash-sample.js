export const mockDashData = {
  code: 0,
  data: {
    dash: {
      video: [
        { id: 80, baseUrl: 'https://up.bilivideo.com/video/80.mp4', bandwidth: 300000, width: 640, height: 360, codecs: 'avc1.64001e', mimeType: 'video/mp4' },
        { id: 64, baseUrl: 'https://up.bilivideo.com/video/64.mp4', bandwidth: 600000, width: 852, height: 480, codecs: 'avc1.64001e', mimeType: 'video/mp4' },
        { id: 32, baseUrl: 'https://up.bilivideo.com/video/32.mp4', bandwidth: 1200000, width: 1280, height: 720, codecs: 'avc1.64001f', mimeType: 'video/mp4' },
        { id: 16, baseUrl: 'https://up.bilivideo.com/video/16.mp4', bandwidth: 3000000, width: 1920, height: 1080, codecs: 'avc1.640028', mimeType: 'video/mp4' },
      ],
      audio: [
        { id: 30280, baseUrl: 'https://up.bilivideo.com/audio/30280.mp4', bandwidth: 128000, codecs: 'mp4a.40.2', mimeType: 'audio/mp4' },
        { id: 30232, baseUrl: 'https://up.bilivideo.com/audio/30232.mp4', bandwidth: 192000, codecs: 'mp4a.40.2', mimeType: 'audio/mp4' },
        { id: 30216, baseUrl: 'https://up.bilivideo.com/audio/30216.mp4', bandwidth: 320000, codecs: 'mp4a.40.2', mimeType: 'audio/mp4' },
      ]
    }
  }
}

export const mockDashDataWithBackup = {
  code: 0,
  data: {
    dash: {
      video: [{
        id: 16,
        baseUrl: 'https://up.bilivideo.com/video/16.mp4',
        backupUrl: ['https://backup1.bilivideo.com/video/16.mp4', 'https://backup2.bilivideo.com/video/16.mp4'],
        bandwidth: 3000000,
        width: 1920,
        height: 1080,
        codecs: 'avc1.640028',
        mimeType: 'video/mp4'
      }],
      audio: [{
        id: 30216,
        baseUrl: 'https://up.bilivideo.com/audio/30216.mp4',
        backup_url: ['https://backup1.bilivideo.com/audio/30216.mp4'],
        bandwidth: 320000,
        codecs: 'mp4a.40.2',
        mimeType: 'audio/mp4'
      }]
    }
  }
}

export const mockDashDataEscapedUrl = {
  code: 0,
  data: {
    dash: {
      video: [{
        id: 16,
        baseUrl: 'https:\\/\\/up.bilivideo.com\\/video\\/16.mp4',
        bandwidth: 3000000,
        width: 1920,
        height: 1080,
        codecs: 'avc1.640028',
        mimeType: 'video/mp4'
      }],
      audio: [{
        id: 30216,
        baseUrl: 'https:\\/\\/up.bilivideo.com\\/audio\\/30216.mp4',
        bandwidth: 320000,
        codecs: 'mp4a.40.2',
        mimeType: 'audio/mp4'
      }]
    }
  }
}

export function buildScriptContent(dashJson) {
  return `<script>window.__INITIAL_STATE__ = ${JSON.stringify(dashJson)};</script>`
}
