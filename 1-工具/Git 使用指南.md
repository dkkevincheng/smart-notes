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
description: Git 配置与双平台推送完整指南
---

# Git 使用指南

> 本仓库 Git + Gitee + GitHub 双平台同步配置总结

---

## 📁 主目录

```
D:\文案文件夹\提示词1\smart-notes\
```

这是 Git 仓库的根目录，所有操作都在这里执行。

---

## ⚙️ 当前配置

### 远程仓库

| 平台 | 地址 | 状态 |
|------|------|------|
| GitHub | https://github.com/dkkevincheng/smart-notes | ✅ 已配置 |
| Gitee | https://gitee.com/kevinczl/smart-notes | ✅ 已配置 |

### 代理设置

```bash
http.proxy = http://127.0.0.1:7892
https.proxy = http://127.0.0.1:7892
```

---

## 🚀 日常使用

### 提交更改

```bash
git add .
git commit -m "feat: 描述本次修改"
git push origin master
```

> 每次 `git push` 会自动推送到 GitHub 和 Gitee

### 查看状态

```bash
git status              # 查看工作区状态
git log --oneline      # 查看提交历史
git remote -v          # 查看远程仓库配置
```

### 检查代理

```bash
git config --global http.proxy
git config --global https.proxy
```

---

## 🔧 修改代理端口

如果代理软件端口变了，更新：

```bash
git config --global http.proxy http://127.0.0.1:【新端口】
git config --global https.proxy http://127.0.0.1:【新端口】
```

---

## 📋 提交信息规范

参考 [[Angular 提交规范]]：

| 类型 | 说明 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | 修复bug |
| `docs:` | 文档修改 |
| `style:` | 代码格式 |
| `refactor:` | 重构 |
| `perf:` | 性能优化 |

---

## ❓ 常见问题

### GitHub 连接超时
- 检查代理是否开启
- 确认端口是否正确（当前 `7892`）

### 推送被拒绝
- 确认仓库是否存在
- 检查 SSH Key 或 Token 权限

---

## 🔗 相关链接

- GitHub: https://github.com/dkkevincheng/smart-notes
- Gitee: https://gitee.com/kevinczl/smart-notes

---

*最后更新: 2026-09-26*
