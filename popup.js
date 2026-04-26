async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadVideoInfo() {
  const tab = await getCurrentTab();
  const titleEl = document.getElementById('videoTitle');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusEl = document.getElementById('statusMsg');

  if (!tab?.url?.includes('bilibili.com')) {
    titleEl.innerText = '请在B站视频页面使用';
    downloadBtn.style.display = 'none';
    statusEl.innerText = '';
    return;
  }

  const result = await chrome.storage.local.get(tab.url);
  const data = result[tab.url];

  if (!data || !data.videoUrl || !data.audioUrl) {
    titleEl.innerText = '未检测到完整视频流，请刷新页面重试';
    downloadBtn.style.display = 'none';
    statusEl.innerText = '可尝试按F5刷新页面';
    return;
  }

  titleEl.innerText = data.title || 'B站视频';
  downloadBtn.style.display = 'flex';
  window.currentData = data;
  statusEl.innerText = '';
}

function sanitize(title) {
  return (title || 'video').replace(/[\\/*?:"<>|]/g, '_').substring(0, 80);
}

function downloadViaContent(url, filename) {
  return new Promise((resolve, reject) => {
    getCurrentTab().then(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'download', url, filename }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else if (response?.success) {
          resolve();
        } else {
          reject(response?.error || '下载失败');
        }
      });
    });
  });
}

function runFFmpegMerge(videoFile, audioFile, outputFile) {
  const downloadsDir = 'C:\\Users\\mark3\\Downloads';
  const cmd = `cd /d "${downloadsDir}" && ffmpeg -y -i "${videoFile}" -i "${audioFile}" -c copy "${outputFile}" && del "${videoFile}" "${audioFile}" && exit`;
  const encodedCmd = encodeURIComponent(cmd);
  const ffmpegUrl = `ffmpeg-run://${encodedCmd}`;

  const a = document.createElement('a');
  a.href = ffmpegUrl;
  a.click();
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const data = window.currentData;
  if (!data?.videoUrl || !data?.audioUrl) {
    showStatus('没有可下载的完整资源', true);
    return;
  }

  showStatus('开始下载视频流...', false);
  try {
    await downloadViaContent(data.videoUrl, 'video.mp4');
    showStatus('视频下载完成，开始下载音频流...', false);
    await downloadViaContent(data.audioUrl, 'audio.mp3');
    
    const outputFile = sanitize(data.title) + '.mp4';
    showStatus('下载完成，调用ffmpeg合成...', false);
    
    setTimeout(() => {
      runFFmpegMerge('video.mp4', 'audio.mp3', outputFile);
      showStatus('ffmpeg合成命令已执行', false);
    }, 1000);
  } catch (err) {
    showStatus('下载失败：' + err, true);
  }
});

function showStatus(msg, isError) {
  const el = document.getElementById('statusMsg');
  el.innerText = msg;
  el.style.color = isError ? '#ff9999' : '#aaa';
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  showStatus('刷新中...', false);
  chrome.tabs.reload(undefined, { bypassCache: true }, () => {
    setTimeout(loadVideoInfo, 1500);
  });
});

loadVideoInfo();