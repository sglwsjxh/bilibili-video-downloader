function findVideoAudioUrls() {
  const scriptTags = document.querySelectorAll('script');
  let videoUrl = null;
  let audioUrl = null;

  for (let script of scriptTags) {
    const content = script.textContent || script.innerText;
    if (content.includes('dash') && (content.includes('video') || content.includes('audio'))) {
      const videoMatch = content.match(/"video"\s*:\s*\[\s*\{[\s\S]*?"base_?url"\s*:\s*"([^"]+)"[\s\S]*?\}/i);
      if (videoMatch?.[1]) videoUrl = videoMatch[1].replace(/\\\//g, '/');

      const audioMatch = content.match(/"audio"\s*:\s*\[\s*\{[\s\S]*?"base_?url"\s*:\s*"([^"]+)"[\s\S]*?\}/i);
      if (audioMatch?.[1]) audioUrl = audioMatch[1].replace(/\\\//g, '/');

      if (videoUrl && audioUrl) break;
    }
  }

  if (videoUrl || audioUrl) {
    const cleanTitle = document.title.replace(/\s*[-_ ]?哔哩哔哩_bilibili\s*$/i, '').trim();
    chrome.storage.local.set({
      [location.href]: { videoUrl, audioUrl, title: cleanTitle }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findVideoAudioUrls);
} else {
  setTimeout(findVideoAudioUrls, 800);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    fetch(request.url, {
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
        'Origin': 'https://www.bilibili.com'
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = request.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      sendResponse({ success: true });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});