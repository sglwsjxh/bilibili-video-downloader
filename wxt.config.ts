import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  webExt: {
    disabled: true
  },
  manifest: {
    name: 'B 站视频下载器',
    description: '提取和下载 B 站音视频流',
    permissions: ['storage', 'activeTab', 'nativeMessaging'],
    host_permissions: ['https://www.bilibili.com/*']
  }
});
