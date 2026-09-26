# OB English Learner

一个专为英语学习者设计的 Obsidian 插件，集成了语音录制、文本转语音（TTS）、AI 翻译和音频管理功能。

## 功能特性

### 🎙️ 语音录制 (STT)
- 一键录制语音并自动转文字
- 支持多种音频格式（WAV、WebM、MP3）
- 可自定义录音文件命名模板
- 支持仅录音模式（不进行语音转文字）

### 🔊 文本转语音 (TTS)
- 基于阿里云通义千问 Qwen-Audio-TTS 模型
- 提供 12 种自然音色选择
- 支持音频缓存，避免重复请求
- 可调节播放速度（0.5x - 2.0x）
- 音频文件自动保存到指定目录

### 🌐 AI 翻译
- 基于阿里云百炼大模型
- 智能检测语言方向（中英互译）
- 优化的翻译提示词，输出更自然
- 翻译结果直接插入文档

### 🧹 音频清理
- 自动扫描未引用的音频文件
- 支持预览模式（Dry Run）
- 可设置白名单保护重要文件
- 手动清理或定时自动清理

## 安装方法

### 方法一：手动安装
1. 下载 `main.js` 和 `manifest.json` 文件
2. 将文件复制到你的 Obsidian 库的 `.obsidian/plugins/ob-english-learner/` 目录
3. 在 Obsidian 设置中启用插件

### 方法二：从源码构建
```bash
# 克隆仓库
git clone <repository-url>
cd ob-english-learner

# 安装依赖
npm install

# 构建插件
npm run build

# 复制构建文件到 Obsidian 插件目录
# main.js 和 manifest.json 会自动生成
```

## 配置指南

### API 配置
插件使用统一的阿里云 API 密钥：
- **API Key**: 在插件设置中填写你的阿里云 API Key
- **TTS Workspace**: 默认使用 `llm-k2xjlgq4u73czbcj`
- **AI Translation Base URL**: 默认使用 `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic`

### TTS 配置
- **音色选择**: 从 12 种音色中选择（详见下方音色列表）
- **播放速度**: 0.5x - 2.0x
- **音频保存目录**: 默认 `AloudFiles`
- **文件命名模板**: 支持 `{{title}}`、`{{date}}`、`{{time}}`、`{{seq}}` 变量

### 录音配置
- **音频格式**: WAV（推荐）、WebM、MP3
- **保存目录**: 默认 `01-音频/Recordings`
- **文件命名模板**: 支持 `{{date}}`、`{{seq}}` 变量

### 音频清理配置
- **启用清理**: 开启/关闭音频清理功能
- **预览模式**: 仅显示将被删除的文件，不实际删除
- **自动清理**: 每日自动执行清理
- **白名单**: 添加需要保护的文件路径

## 使用方法

### 语音录制
1. 点击左侧工具栏的麦克风图标，或使用快捷键 `Ctrl/Cmd + Shift + R`
2. 在弹出的录制界面中控制录制
3. 录制完成后，音频文件和转录文本会自动插入到当前文档

### 文本转语音
1. 选中需要朗读的文本
2. 右键选择 "Speak Selection" 或使用快捷键 `Ctrl/Cmd + Space`
3. 音频会自动播放并保存到指定目录
4. 音频引用会自动插入到文档中

### AI 翻译
1. 选中需要翻译的文本
2. 右键选择 "Translate Selection" 或使用快捷键 `Ctrl/Cmd + Shift + T`
3. 翻译结果会直接插入到选中文本的下方

### 音频清理
1. 打开命令面板（`Ctrl/Cmd + P`）
2. 搜索 "Clean Unused Audio Files"
3. 执行命令查看清理结果

## 可用音色列表

| 音色 ID | 描述 |
|---------|------|
| longanfengyue | 龙安风悦 - 自然亲切音（女，30岁） |
| longanyuanfei | 龙安元妃 - 高傲妃子音（女，30岁） |
| longanlingxi | 龙安灵希 - 可爱甜美音（女，25岁） |
| longanxiaoxin | 龙安小昕 - 亲切活泼音（女，22岁） |
| longanhuan_v3.6 | 龙安欢 - 活泼女声（女，25岁） |
| longjielidou_v3.6 | 龙杰力豆 - 天真男童（男，5岁） |
| longpaopao_v3.6 | 龙泡泡 - 软糯可爱音（女，5岁） |
| longhuohuo_v3.6 | 龙火火 - 顽皮少年音（男，8岁） |
| longchuanshu_v3.6 | 龙川叔 - 川普大叔音（男，40岁） |
| loongmary | LoongMary - 温暖英语（女，20岁） |
| loongeva_v3.6 | LoongEva - 高智美音（女，28岁） |
| loongjohn | LoongJohn - 沉稳亲切美音（男，28岁） |

## 技术架构

### 核心模块
- **main.ts**: 插件主入口，管理生命周期和命令注册
- **types.ts**: TypeScript 类型定义
- **config.json**: 默认配置项

### 功能模块
- **voice/**: 语音录制相关
  - `audio-recorder.ts`: 音频录制器
  - `audio-cleaner.ts`: 音频清理器
  - `recording-modal.ts`: 录制界面
  - `transcription-service.ts`: 语音转文字服务

- **tts/**: 文本转语音相关
  - `tts-manager.ts`: TTS 管理器，处理音频播放和缓存

### 技术栈
- **语言**: TypeScript
- **构建工具**: esbuild
- **API**: 阿里云通义千问、百炼大模型
- **框架**: Obsidian Plugin API

## 开发指南

### 环境要求
- Node.js 16+
- npm 或 yarn

### 开发流程
```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run check
```

### 项目结构
```
ob-english-learner/
├── src/
│   ├── main.ts              # 插件主入口
│   ├── types.ts             # 类型定义
│   ├── config.json          # 配置文件
│   ├── voice/               # 语音录制模块
│   └── tts/                 # TTS 模块
├── main.js                  # 构建输出
├── manifest.json            # 插件清单
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
└── esbuild.config.mjs       # 构建配置
```

## 配置说明

插件支持通过 `config.json` 文件自定义默认配置：

```json
{
  "tts": {
    "workspace": "llm-k2xjlgq4u73czbcj",
    "model": "qwen-audio-3.0-tts-flash",
    "defaultVoice": "longanfengyue"
  },
  "ai": {
    "model": "qwen3.8-max",
    "baseUrl": "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    "maxTokens": 1500
  },
  "paths": {
    "audioFolder": "01-音频/Recordings",
    "ttsAudioFolder": "AloudFiles"
  },
  "templates": {
    "audioFilename": "Recording_{{date}}{{seq}}",
    "ttsFilename": "{{title}}_{{date}}{{time}}_{{seq}}"
  }
}
```

## 常见问题

**Q: TTS 播放没有声音？**
A: 请检查 API Key 是否正确配置，以及网络连接是否正常。

**Q: 翻译结果不准确？**
A: 插件使用优化的提示词，但 AI 翻译仍有局限性。对于专业内容，建议人工校对。

**Q: 音频文件占用空间太大？**
A: 使用音频清理功能删除未引用的文件，或调整音频格式为 MP3 以减小文件大小。

## 更新日志

### v1.0.0
- 初始版本发布
- 集成语音录制、TTS、AI 翻译功能
- 实现音频清理功能
- 支持阿里云通义千问和百炼大模型

## 许可证

MIT License

## 作者

kevin+ai

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [Obsidian](https://obsidian.md/) - 强大的知识管理工具
- [阿里云](https://www.aliyun.com/) - 提供 AI 和语音服务
- [通义千问](https://tongyi.aliyun.com/) - Qwen-Audio-TTS 模型
