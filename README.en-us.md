<p align="center">
  <img src="website/static/img/surveyking.svg" alt="SurveyKing" height="76" />
</p>

<h1 align="center">SurveyKing</h1>

<p align="center">
  <strong>A powerful, easy-to-deploy open-source platform for surveys, exams, and question practice</strong>
</p>

<p align="center">
  Create content, collect responses, run exams, practise from question banks, analyse data, and manage access in one system.
</p>

<p align="center">
  <a href="https://gitee.com/surveyking/surveyking/stargazers"><img src="https://gitee.com/surveyking/surveyking/badge/star.svg?theme=dark" alt="Gitee Stars" /></a>
  <a href="https://gitee.com/surveyking/surveyking/members"><img src="https://gitee.com/surveyking/surveyking/badge/fork.svg?theme=dark" alt="Gitee Forks" /></a>
  <a href="https://github.com/javahuang/surveyking/stargazers"><img src="https://img.shields.io/github/stars/javahuang/surveyking?style=flat-square&logo=github" alt="GitHub Stars" /></a>
  <a href="https://github.com/javahuang/surveyking/network/members"><img src="https://img.shields.io/github/forks/javahuang/surveyking?style=flat-square&logo=github" alt="GitHub Forks" /></a>
  <img src="https://img.shields.io/badge/version-v1.13.0-brightgreen?style=flat-square" alt="Version" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://hub.docker.com/r/surveyking/surveyking"><img src="https://img.shields.io/docker/pulls/surveyking/surveyking?style=flat-square&logo=docker" alt="Docker Pulls" /></a>
</p>

<p align="center">
  <a href="https://surveyking.cn/">Website</a> ·
  <a href="https://surveyking.cn/open-source/deploy/">Deployment</a> ·
  <a href="https://surveyking.cn/help/quickstart/">Documentation</a> ·
  <a href="https://s.surveyking.cn/">Live Demo</a> ·
  <a href="https://docs.qq.com/sheet/DZEVveUVMSHpVZkJw">Feature List</a>
</p>

<p align="center">
  <a href="./README.md">简体中文</a> · English
</p>

> **Our goal is to build the easiest-to-deploy and most complete open-source survey and examination system.**
>
> SurveyKing combines surveys, exams, question-bank practice, analytics, administration, AI, internationalisation, and third-party integrations in one self-hosted platform. Its built-in H2 database requires no separate database installation, while Windows packages and BaoTa provide one-click deployment options.

## Three core scenarios

| Surveys | Exams | Question practice |
| --- | --- | --- |
| 20+ question types, conditional logic, themes, publishing controls, and mobile responses | Question banks, correct answers, scoring rules, automatic grading, and result analysis | Sequential, random, and incorrect-answer practice with mobile-friendly progress tracking |
| Create with AI, Excel, plain text, templates, or the visual editor | Reuse questions, randomise questions and options, and configure answer explanations | Reuse the same question bank across exams and self-directed practice |

## Platform capabilities

| Module | Capabilities |
| --- | --- |
| **Data** | Response editing, filters, imports, exports, printing, attachment downloads, and real-time reports |
| **Administration** | Users, roles, departments, positions, organisations, collaboration, and RBAC permissions |
| **AI** | Natural-language survey and exam creation, streaming generation, live preview, and OpenAI-compatible APIs |
| **Internationalisation** | Multilingual UI and prompts, configurable default locale, multilingual AI generation, and extensible locale resources |

## Integrations

| Area | Supported integrations |
| --- | --- |
| **AI providers** | OpenAI-compatible APIs, including SiliconFlow-hosted DeepSeek, Qwen, and Llama models |
| **OAuth** | Google OAuth, WeChat Open Platform QR login, WeChat Official Account authorisation, and account linking |
| **WeChat surveys** | WeChat-only responses with optional nickname and avatar collection |
| **Maps** | Amap key and security-code configuration for location questions |
| **Deployment** | Windows packages, Docker Hub, Alibaba Cloud registry, BaoTa, and EazyDevelop |
| **Storage** | Built-in H2 for evaluation and MySQL for production deployments |

## Why SurveyKing

- **One integrated product:** surveys, exams, and practice share question banks, users, permissions, and analytics.
- **Self-hosted by design:** your organisation controls the application and its data.
- **Low deployment overhead:** use the built-in H2 database with Windows packages, one-click BaoTa deployment, or containers.
- **Complete workflow:** create, publish, respond, grade, practise, report, and export in one platform.
- **Flexible logic:** visibility, branching, calculations, validation, dynamic required fields, and automatic selection.
- **Open and extensible:** AI, OAuth, WeChat, Amap, and locale resources can be configured or extended.

## Product preview

### Survey analytics

The four views show the visual editor, its mobile preview, the respondent-facing form, and analytics generated from 45 representative demo responses.

<table>
  <tr>
    <td width="50%" align="center"><a href="docs/readme/survey-editor.webp"><img src="docs/readme/survey-editor.webp" alt="Survey editor" width="100%" /></a><br /><sub>Visual editor</sub></td>
    <td width="50%" align="center"><a href="docs/readme/survey-mobile-preview.webp"><img src="docs/readme/survey-mobile-preview.webp" alt="Mobile survey preview" width="100%" /></a><br /><sub>Mobile preview</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="docs/readme/survey-answer-ui.webp"><img src="docs/readme/survey-answer-ui.webp" alt="Respondent-facing survey" width="100%" /></a><br /><sub>Respondent-facing form</sub></td>
    <td width="50%" align="center"><a href="docs/readme/survey-report.webp"><img src="docs/readme/survey-report.webp" alt="Survey analytics" width="100%" /></a><br /><sub>Survey analytics</sub></td>
  </tr>
</table>

### Exams and automatic grading

The four views show the exam editor, its mobile preview, the candidate-facing exam, and a grade table containing 32 demo submissions with scores ranging from 40 to 100.

<table>
  <tr>
    <td width="50%" align="center"><a href="docs/readme/exam-editor.webp"><img src="docs/readme/exam-editor.webp" alt="Exam editor" width="100%" /></a><br /><sub>Exam editor</sub></td>
    <td width="50%" align="center"><a href="docs/readme/exam-mobile-preview.webp"><img src="docs/readme/exam-mobile-preview.webp" alt="Mobile exam preview" width="100%" /></a><br /><sub>Mobile preview</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="docs/readme/exam-answer-ui.webp"><img src="docs/readme/exam-answer-ui.webp" alt="Candidate-facing exam" width="100%" /></a><br /><sub>Candidate-facing exam</sub></td>
    <td width="50%" align="center"><a href="docs/readme/exam-data.webp"><img src="docs/readme/exam-data.webp" alt="Exam grades" width="100%" /></a><br /><sub>Grade data</sub></td>
  </tr>
</table>

### Practice mode on desktop and mobile

Use the same question bank for exams and self-directed practice. The desktop view provides an answer card, question flags, configurable removal from the incorrect-answer set, and AI explanations. Mobile practice adds instant grading, answer comparison, favourites, notes, and practice settings.

<p align="center">
  <img src="docs/readme/practice-desktop.webp" alt="Practice mode on desktop" width="69%" />
  <img src="docs/readme/practice-mobile.webp" alt="Practice mode on mobile" width="20%" />
</p>

### AI-assisted creation

Describe the survey or exam you need and preview the generated structure before creating the project.

<p align="center">
  <img src="docs/readme/ai-create.webp" alt="AI-assisted creation" width="72%" />
</p>

## Quick start

Start SurveyKing with its built-in H2 database:

```bash
docker run -d \
  --name surveyking \
  -p 1991:1991 \
  surveyking/surveyking:latest
```

If Docker Hub is slow in your region, use the Alibaba Cloud registry:

```bash
docker run -d \
  --name surveyking \
  -p 1991:1991 \
  registry.cn-hangzhou.aliyuncs.com/surveyking/surveyking:latest
```

Open [http://localhost:1991](http://localhost:1991):

- Username: `admin`
- Password: `123456`
- Change the default password immediately after the first login. The new password must be 8-16 characters and contain uppercase letters, lowercase letters, and digits.

For Windows packages, MySQL, Nginx, BaoTa, and other deployment options, see the [deployment documentation](https://surveyking.cn/open-source/deploy/).

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Ant Design, responsive web UI |
| Backend | Java, Spring Boot 2.7, Spring Security, MyBatis-Plus |
| Database | H2, MySQL |
| Deployment | Windows, Docker, Nginx, BaoTa, EazyDevelop |

## Documentation and community

- [Quick start](https://surveyking.cn/help/quickstart/)
- [Deployment guide](https://surveyking.cn/open-source/deploy/)
- [AI configuration](https://surveyking.cn/open-source/docs/ai/)
- [Complete feature list](https://docs.qq.com/sheet/DZEVveUVMSHpVZkJw)
- Issues: [Gitee](https://gitee.com/surveyking/surveyking/issues) · [GitHub](https://github.com/javahuang/surveyking/issues)

If SurveyKing is useful to you, please consider starring the project on Gitee or GitHub.

## Licence

SurveyKing is released under the [MIT License](./LICENSE).
