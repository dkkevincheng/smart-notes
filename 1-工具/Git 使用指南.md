---
uid: 20260926-git-guide
title: Git 使用指南
tags:
  - 工具
  - Git
  - 版本控制
created: 2026-09-26
updated: 2026-09-26
type: guide
description: Git 配置与双平台推送通用指南
---

# Git 使用指南

> 本仓库 Git + Gitee + GitHub 双平台同步配置指南

---

## 📁 主目录

```
D:\文案文件夹\提示词1\smart-notes\
```

这是 Git 仓库的根目录。

---

## ⚙️ 配置模板

### 1. 添加远程仓库

```bash
# 添加 GitHub
git remote add origin https://github.com/你的用户名/仓库名.git

# 添加 Gitee（同一个 origin）
git remote set-url --add origin https://gitee.com/你的用户名/仓库名.git
```

### 2. 配置代理

```bash
git config --global http.proxy http://127.0.0.1:你的代理端口
git config --global https.proxy http://127.0.0.1:你的代理端口
```

### 3. 查看配置

```bash
git remote -v              # 查看远程仓库
git config --global -l     # 查看所有全局配置
```

---

## 🚀 日常使用

### 提交并推送

```bash
git add .
git commit -m "提交描述"
git push origin master
```

> 每次 push 会自动推送到 origin 下的所有平台

### 查看状态

```bash
git status              # 工作区状态
git log --oneline      # 提交历史
```

---

## 🔧 修改代理端口

```bash
git config --global http.proxy http://127.0.0.1:【新端口】
git config --global https.proxy http://127.0.0.1:【新端口】
```

---

## 📋 提交规范

| 类型 | 说明 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | 修复bug |
| `docs:` | 文档修改 |
| `refactor:` | 重构 |

---

## ⚠️ 安全注意

以下信息**不要**提交到 Git：
- 代理端口和地址
- 用户名、邮箱
- API Token、密钥
- 个人文件路径

这类配置放本地，不写入文档。

---

## ❓ 常见问题

### 连接超时
- 检查代理是否开启
- 确认代理端口是否正确

### 推送被拒绝
- 确认仓库是否存在
- 检查权限配置

---

*最后更新: 2026-09-26*
