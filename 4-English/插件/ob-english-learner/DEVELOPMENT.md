# OB English Learner - 开发方案文档

## 项目概述

OB English Learner 是一个专为英语学习者设计的 Obsidian 插件，提供语音录制、文本转语音、AI 翻译和音频管理功能。

**版本**: 1.0.0  
**作者**: kevin+ai  
**许可证**: MIT

## 技术架构

### 核心技术栈
- **语言**: TypeScript 4.7.4
- **构建工具**: esbuild 0.17.3
- **运行时**: Obsidian Plugin API
- **AI 服务**: 阿里云通义千问、百炼大模型

### 架构设计原则
1. **模块化**: 功能按模块划分，职责清晰
2. **配置化**: 通过 config.json 管理默认配置
3. **简洁性**: 移除冗余代码，保持代码精简
4. **可扩展性**: 预留接口，便于后续功能扩展

## 模块设计

### 1. 核心模块 (main.ts)
**职责**: 插件生命周期管理、命令注册、设置界面

**关键功能**:
- 插件初始化和销毁
- 命令注册（录音、TTS、翻译、清理）
- 设置界面渲染
- 自动清理调度

**代码行数**: ~790 行

### 2. 语音录制模块 (voice/)

#### audio-recorder.ts
**职责**: 音频录制控制

**核心类**: `AudioRecorder`
- 支持 WAV、WebM、MP3 格式
- 录音控制（开始、暂停、恢复、停止）
- 音频数据处理和编码

**代码行数**: ~257 行

#### recording-modal.ts
**职责**: 录音界面 UI

**核心类**: `RecordingModal`
- 波形可视化
- 计时器显示
- 录音控制按钮

**代码行数**: ~351 行

#### transcription-service.ts
**职责**: 语音转文字服务

**核心类**: `TranscriptionService`
- 调用阿里云 ASR API
- 音频格式转换
- 转录结果处理

**代码行数**: ~59 行

#### audio-cleaner.ts
**职责**: 音频文件清理

**核心类**: `AudioCleaner`
- 扫描音频文件夹
- 检测文档引用
- 删除未引用文件
- 支持白名单和预览模式

**代码行数**: ~202 行

### 3. TTS 模块 (tts/)

#### tts-manager.ts
**职责**: 文本转语音管理

**核心类**: `TTSManager`
- 调用 Qwen-Audio-TTS API
- 音频播放控制
- 音频文件缓存和保存
- 播放状态管理

**代码行数**: ~403 行

**关键特性**:
- 12 种音色支持
- 播放速度调节（0.5x - 2.0x）
- 自动保存到指定目录
- 文件名模板支持

### 4. 类型定义 (types.ts)

**核心接口**:
- `LinguaSyncSettings`: 插件设置
- `AudioFileInfo`: 音频文件信息

**代码行数**: ~50 行

### 5. 配置文件 (config.json)

**配置项**:
- TTS 配置（workspace、model、defaultVoice）
- AI 配置（model、baseUrl、maxTokens）
- 路径配置（audioFolder、ttsAudioFolder）
- 模板配置（audioFilename、ttsFilename）

## API 集成方案

### 1. 语音转文字 (STT)
**服务商**: 阿里云通义千问  
**端点**: `https://llm-k2xjlgq4u73czbcj.cn-beijing.maas.aliyuncs.com`  
**模型**: whisper-1  
**认证**: Bearer Token

### 2. 文本转语音 (TTS)
**服务商**: 阿里云通义千问  
**端点**: `https://llm-k2xjlgq4u73czbcj.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`  
**模型**: qwen-audio-3.0-tts-flash  
**认证**: Bearer Token  
**特性**: 
- 支持 12 种音色
- 输出格式：WAV
- 采样率：24000 Hz

### 3. AI 翻译
**服务商**: 阿里云百炼  
**端点**: `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic`  
**模型**: qwen3.8-max  
**认证**: x-api-key + anthropic-version  
**特性**:
- 智能语言检测
- 优化的翻译提示词
- 最大 token 数：1500

## 功能实现细节

### 1. 语音录制流程
```
用户触发录音
  ↓
AudioRecorder.startRecording()
  ↓
显示 RecordingModal
  ↓
用户控制录音（暂停/恢复/停止）
  ↓
AudioRecorder.stopRecording()
  ↓
保存音频文件到指定目录
  ↓
调用 TranscriptionService.transcribe()
  ↓
插入音频引用和转录文本到文档
```

### 2. TTS 播放流程
```
用户选中文本
  ↓
触发 TTS 命令
  ↓
TTSManager.playSelection()
  ↓
检查音频缓存
  ↓
[缓存命中] → 直接播放
[缓存未命中] → 调用 API
  ↓
保存音频文件到 AloudFiles 目录
  ↓
插入音频引用到文档
  ↓
播放音频
```

### 3. AI 翻译流程
```
用户选中文本
  ↓
触发翻译命令
  ↓
检测语言方向（中→英 或 英→中）
  ↓
构建优化的提示词
  ↓
调用百炼 API
  ↓
解析响应
  ↓
插入翻译结果到文档
```

### 4. 音频清理流程
```
用户触发清理命令
  ↓
AudioCleaner.scanAudioFiles()
  ↓
扫描指定目录的所有音频文件
  ↓
AudioCleaner.findReferencedAudio()
  ↓
搜索所有 Markdown 文档中的引用
  ↓
AudioCleaner.markReferencedFiles()
  ↓
标记已引用的文件
  ↓
过滤未引用的文件（排除白名单）
  ↓
[预览模式] → 显示将被删除的文件
[执行模式] → 删除未引用的文件
```

## 配置管理

### 默认配置
通过 `config.json` 文件管理默认配置，支持以下配置项：

```json
{
  "tts": {
    "workspace": "llm-k2xjlgq4u73czbcj",
    "model": "qwen-audio-3.0-tts-flash",
    "defaultVoice": "longanfengyue",
    "voices": [...]
  },
  "ai": {
    "model": "qwen3.8-max",
    "baseUrl": "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    "maxTokens": 1500,
    "apiVersion": "2023-06-01"
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

### 用户配置
用户可以在插件设置界面中覆盖默认配置，配置保存在 Obsidian 的 `data.json` 文件中。

## 优化策略

### 1. 代码优化
- 移除未使用的文件和代码
- 精简类型定义
- 优化导入语句
- 移除冗余功能（视频处理、Vault QA 等）

### 2. 性能优化
- TTS 音频缓存，避免重复请求
- 异步处理，不阻塞 UI
- 批量处理音频清理

### 3. 用户体验优化
- 简洁的设置界面
- 清晰的错误提示
- 快捷键支持
- 右键菜单集成

## 测试策略

### 1. 功能测试
- 语音录制和转录
- TTS 播放和保存
- AI 翻译准确性
- 音频清理正确性

### 2. 兼容性测试
- 不同 Obsidian 版本
- 不同操作系统
- 不同音频格式

### 3. 性能测试
- 大文件处理
- 并发请求处理
- 内存占用

## 部署方案

### 构建流程
```bash
npm install          # 安装依赖
npm run build        # 构建生产版本
```

### 部署文件
- `main.js`: 编译后的插件代码
- `manifest.json`: 插件清单
- `config.json`: 默认配置

### 安装方式
1. 手动复制到 `.obsidian/plugins/ob-english-learner/`
2. 在 Obsidian 设置中启用插件

## 后续扩展方向

### 1. 功能扩展
- 支持更多 AI 服务商
- 添加语音识别语言选择
- 支持批量翻译
- 添加翻译历史记录

### 2. 体验优化
- 流式输出翻译结果
- 添加翻译质量评估
- 支持自定义翻译提示词
- 添加音频播放进度条

### 3. 集成扩展
- 与 Obsidian 其他插件集成
- 支持导出翻译结果
- 添加统计面板

## 已知限制

1. **网络依赖**: 需要网络连接才能使用 AI 功能
2. **API 限制**: 受限于阿里云 API 的调用频率和配额
3. **翻译质量**: AI 翻译仍有局限性，专业内容需人工校对
4. **音频格式**: 部分功能仅支持特定音频格式

## 维护指南

### 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 添加必要的注释
- 保持函数职责单一

### 版本管理
- 遵循语义化版本控制
- 更新 CHANGELOG.md
- 创建 Git 标签

### 问题处理
- 及时响应 Issue
- 添加错误日志
- 提供详细的错误信息

## 总结

OB English Learner 是一个功能完整、架构清晰的 Obsidian 插件，为英语学习者提供了强大的语音和翻译功能。通过模块化设计和配置化管理，插件具有良好的可维护性和可扩展性。

**核心优势**:
- 集成多种 AI 服务
- 简洁易用的界面
- 灵活的配置选项
- 完善的音频管理

**适用场景**:
- 英语学习和练习
- 语音笔记记录
- 文档翻译
- 音频内容管理
