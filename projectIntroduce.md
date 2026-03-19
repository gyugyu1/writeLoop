# 영어 학습 앱 프로젝트 소개서 (MVP 초안)

## 1. 프로젝트 목표

- 사용자가 매일 짧게 학습할 수 있는 영어 학습 앱을 만든다.
- 핵심은 `짧은 레슨 학습 -> 퀴즈 풀이 -> 진행률 확인` 흐름이다.

## 2. 핵심 사용자 시나리오

1. 사용자는 레슨 목록에서 오늘 학습할 주제를 고른다.
2. 레슨 요약과 핵심 표현을 확인한다.
3. 퀴즈를 풀고 즉시 결과를 확인한다.
4. 학습 누적 현황을 대시보드에서 확인한다.

## 3. MVP 기능 범위

- 레슨 목록 조회
- 객관식/빈칸형 퀴즈
- 점수 계산
- 학습 진행률 대시보드

## 4. 기술 구조 (확정)

- `apps/frontend`: Next.js (App Router)
- `apps/backend`: Spring Boot REST API

## 5. 폴더 구조

```text
.
├─ apps
│  ├─ frontend
│  │  ├─ app
│  │  └─ lib
│  └─ backend
│     └─ src/main
│        ├─ java/com/englishloop/englishlearning
│        └─ resources
```

## 6. 다음 작업

1. Spring Security + JWT 인증 추가
2. JPA + DB(MySQL/PostgreSQL) 연동
3. 퀴즈 제출/채점 API 확장
4. 프론트에서 레슨 상세/퀴즈 화면 분리
