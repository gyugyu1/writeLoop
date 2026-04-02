# WriteLoop 프로젝트 온보딩 가이드

이 문서는 `WriteLoop` 프로젝트에 새로 합류한 신입 개발자가 "이 프로젝트가 무엇을 하는지", "어떤 파일부터 읽어야 하는지", "코드가 어떤 흐름으로 연결되는지"를 빠르게 이해할 수 있도록 만든 온보딩 문서입니다.

목표는 두 가지입니다.

1. 프로젝트의 큰 구조를 먼저 이해한다.
2. 실제 코드 파일을 읽을 때 길을 잃지 않도록 파일별 역할을 잡아 준다.

---

## 1. 프로젝트 한 줄 요약

WriteLoop는 사용자가 영어 작문 답변을 쓰면:

1. 질문을 고른다.
2. 답변을 제출한다.
3. AI 피드백을 받는다.
4. 그 피드백을 바탕으로 다시 쓴다.
5. 나중에 기록, 자주 틀리는 부분, 잘 쓴 표현, 코치 추천 표현까지 다시 본다.

즉 이 프로젝트의 중심은 단순한 채점 앱이 아니라:

- `작문 루프`
- `피드백 루프`
- `다시쓰기 루프`
- `학습 기록 축적`

을 하나의 제품 흐름으로 묶는 것입니다.

---

## 2. 저장소 구조 한눈에 보기

```text
C:\WriteLoop
├─ apps
│  ├─ backend      # Spring Boot REST API
│  └─ frontend     # Next.js App Router + Capacitor
├─ docs            # 설계/회고/분석 문서
├─ infra
│  ├─ mysql        # 스키마/마이그레이션
│  └─ nginx        # reverse proxy 설정
├─ env_files       # 배포/실행용 환경변수 템플릿
├─ scripts         # 운영/보조 스크립트
├─ docker-compose.yml
└─ README.md
```

실제로 가장 많이 읽게 될 곳은 아래 4군데입니다.

- `apps/backend/src/main/java/com/writeloop`
- `apps/frontend`
- `infra/mysql/schema`
- `docs`

---

## 3. 제품 흐름 기준으로 먼저 이해하기

코드를 읽을 때는 "패키지 기준"보다 "사용자 행동 기준"으로 먼저 이해하는 편이 쉽습니다.

### 3-1. 작문 피드백 흐름

1. 프론트가 질문 목록을 불러온다.
2. 사용자가 답변을 입력한다.
3. 프론트가 `/api/feedback` 으로 답변을 보낸다.
4. 백엔드가:
   - 프롬프트와 힌트를 읽고
   - 답변을 진단하고
   - answer band를 정하고
   - 필요한 섹션만 생성하고
   - 검증/정제 후 응답한다.
5. 프론트가:
   - 문법 피드백
   - 개선 포인트
   - refinement 카드
   - rewrite guide
   - model answer
   - inline diff
   를 화면에 렌더링한다.
6. 사용자가 다시 쓰기를 제출하면 같은 루프가 한 번 더 돈다.

이 흐름의 핵심 파일:

- Backend
  - `FeedbackController.java`
  - `FeedbackService.java`
  - `OpenAiFeedbackClient.java`
  - `AnswerProfileBuilder.java`
  - `SectionPolicySelector.java`
  - `FeedbackSectionPolicyApplier.java`
  - `FeedbackSectionValidators.java`
- Frontend
  - `apps/frontend/app/answer-loop.tsx`
  - `apps/frontend/lib/api.ts`
  - `apps/frontend/lib/types.ts`
  - `apps/frontend/lib/inline-feedback.ts`

### 3-2. AI 코치 흐름

1. 사용자가 질문 옆에서 "이 표현을 영어로 어떻게 말해?" 같은 코치 질문을 한다.
2. 프론트가 `/api/coach/help` 로 보낸다.
3. 백엔드가 질문 의도를 분석한다.
4. `WRITING_SUPPORT`, `IDEA_SUPPORT`, `MEANING_LOOKUP` 중 어떤 모드인지 나눈다.
5. 필요하면 OpenAI를 쓰고, 아니면 deterministic fallback도 쓴다.
6. 추천 표현과 예문, 사용 가이드를 준다.
7. 사용자가 실제 답변에 그 표현을 썼는지 `/api/coach/usage-check` 로 검증한다.

핵심 파일:

- `CoachController.java`
- `CoachService.java`
- `CoachQueryAnalyzer.java`
- `OpenAiCoachClient.java`
- `OpenAiCoachEvaluationClient.java`

### 3-3. 기록/내 정보 흐름

1. 사용자는 `내 정보` 페이지에서:
   - 프로필 수정
   - 회원 탈퇴
   - 작문 기록
   - 월별/일별 상태
   - 자주 틀리는 포인트
   - 잘 쓴 표현 기록
   를 본다.
2. 프론트는 `/api/history`, `/api/auth/me`, `/api/drafts` 등을 호출한다.
3. 백엔드는 세션 사용자 기준으로 기록을 조합해서 내려준다.

핵심 파일:

- `AnswerHistoryController.java`
- `AnswerHistoryService.java`
- `DraftController.java`
- `DraftService.java`
- `AuthController.java`
- `AuthService.java`
- `apps/frontend/components/my-page-client.tsx`

---

## 4. 신입이 읽는 추천 순서

아래 순서대로 읽으면 가장 빠릅니다.

1. `README.md`
2. `apps/frontend/app/answer-loop.tsx`
3. `apps/frontend/lib/types.ts`
4. `apps/frontend/lib/api.ts`
5. `apps/backend/src/main/java/com/writeloop/controller/FeedbackController.java`
6. `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
7. `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
8. `apps/backend/src/main/java/com/writeloop/service/AnswerProfileBuilder.java`
9. `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionPolicyApplier.java`
10. `apps/backend/src/main/java/com/writeloop/service/FeedbackSectionValidators.java`
11. `apps/backend/src/main/java/com/writeloop/service/CoachService.java`
12. `apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java`
13. `apps/backend/src/main/java/com/writeloop/service/AuthService.java`
14. `apps/backend/src/main/java/com/writeloop/service/AnswerHistoryService.java`
15. `infra/mysql/schema`

---

## 5. Backend 구조 설명

Backend는 크게 아래 층으로 이해하면 됩니다.

```text
Controller
  -> Service
      -> OpenAI Client / Domain Builder / Validator
          -> Repository / Entity
              -> MySQL
```

### 5-1. 애플리케이션 진입점

#### `apps/backend/src/main/java/com/writeloop/WriteLoopApplication.java`

- Spring Boot 메인 엔트리입니다.
- `@EnableScheduling` 이 있어서 코치 평가 배치 같은 스케줄러도 여기서 함께 활성화됩니다.

### 5-2. Config 패키지

#### `PasswordConfig.java`

- 비밀번호 인코더 등 인증 관련 기본 설정을 둡니다.

#### `PromptSeedConfig.java`

- 프롬프트 테이블이 비어 있을 때 starter prompt를 초기 시드로 넣는 역할입니다.

#### `RememberLoginFilter.java`

- remember-login 쿠키를 보고 자동 로그인 세션을 복원하는 필터입니다.

#### `WebConfig.java`

- CORS, MVC 관련 공통 웹 설정을 담당합니다.

---

## 6. Controller 파일별 설명

Controller는 "HTTP 요청을 받아서 Service로 넘기는 입구"입니다.

### `AuthController.java`

- `/api/auth/*` 담당
- 회원가입, 로그인, 이메일 인증, 비밀번호 재설정, 프로필 수정, 회원탈퇴, 소셜 로그인 진입/콜백까지 모두 묶여 있습니다.

### `FeedbackController.java`

- `/api/feedback`
- 사용자의 답변을 받아 피드백을 생성하는 핵심 API입니다.

### `CoachController.java`

- `/api/coach/help`
- `/api/coach/usage-check`
- 코치 추천과 추천 표현 사용 검증을 담당합니다.

### `PromptController.java`

- `/api/prompts`
- `/api/prompts/daily`
- `/api/prompts/{promptId}/hints`
- 질문 목록/일일 추천/힌트를 내려줍니다.

### `DraftController.java`

- `/api/drafts/{promptId}`
- 답변 초안과 다시쓰기 초안을 저장/조회/삭제합니다.

### `AnswerHistoryController.java`

- `/api/history`
- `/api/history/today-status`
- `/api/history/month-status`
- `/api/history/common-mistakes`
- 학습 기록과 통계를 보여주는 API입니다.

### `AdminPromptController.java`

- 관리자용 프롬프트 CRUD
- 관리자용 힌트 CRUD
- topic catalog 조회

### `AdminCoachEvaluationController.java`

- 코치 품질 평가 요약 조회
- 평가 작업 실행

### `HealthController.java`

- `/health`
- 배포/운영 상태 체크용입니다.

### `GlobalExceptionHandler.java`

- 공통 예외를 HTTP 응답으로 바꾸는 최후 방어선입니다.

---

## 7. 피드백 시스템 핵심 서비스 설명

이 프로젝트에서 제일 중요한 영역입니다.

### `FeedbackService.java`

역할:

- 피드백 생성 전체 오케스트레이션
- prompt/hint 조회
- attempt 번호 계산
- OpenAI 사용 여부 결정
- `AnswerProfile` 생성
- 섹션 policy 적용
- 결과 저장

쉽게 말하면:

> "피드백 생성 유즈케이스의 메인 서비스"

입니다.

### `OpenAiFeedbackClient.java`

역할:

- OpenAI feedback 생성 전용 클라이언트
- 현재 구조는 단일 giant prompt가 아니라:
  - diagnosis
  - section generation
  - selective retry
  - deterministic fallback
  을 섞는 hybrid 구조입니다.

핵심 책임:

- diagnosis call 구성
- generation call 구성
- LLM 응답 JSON 파싱
- failed section retry
- authoritative metadata 정리

### `AnswerProfileBuilder.java`

역할:

- 사용자의 답변을 backend 관점에서 구조화합니다.
- top-level 4 block:
  - `task`
  - `grammar`
  - `content`
  - `rewrite`

이 파일이 중요한 이유:

- answer band를 정하는 기반이 여기서 만들어집니다.
- `TOO_SHORT_FRAGMENT`, `CONTENT_THIN`, `GRAMMAR_BLOCKING` 같은 분기가 여기와 직접 연결됩니다.

### `AnswerProfile.java`

역할:

- 피드백 routing용 domain model
- 실제 설명용 DTO가 아니라 의사결정용 프로필입니다.

포함 구조:

- `TaskProfile`
- `GrammarProfile`
- `ContentProfile`
- `RewriteProfile`

### `AnswerContext.java`

역할:

- diagnosis/generation/build 단계에서 쓰는 입력 컨텍스트 묶음
- prompt, learner answer, attempt index, 이전 답변, hint 등을 담습니다.

### `SectionPolicy.java`

역할:

- answer band에 따라 어떤 섹션을 얼마나 보여줄지 정하는 정책 객체

예시:

- strengths 보여줄지
- grammar 몇 개까지 보여줄지
- refinement focus가 detail-building인지 grammar-pattern인지
- model answer를 one-step-up으로 줄지 optional로 숨길지

### `SectionPolicySelector.java`

역할:

- `AnswerProfile`을 받아 적절한 `SectionPolicy`를 고릅니다.

즉:

> "이 답변은 어느 band니까 어떤 UI 섹션 구성이 맞는가?"

를 결정하는 파일입니다.

### `FeedbackSectionPolicyApplier.java`

역할:

- raw feedback 응답과 `AnswerProfile`, `SectionPolicy`를 합쳐서
- 실제 사용자에게 보여 줄 `FeedbackResponseDto` 형태로 조립합니다.

핵심 처리:

- strengths 정제
- grammar section 구성
- improvement 선택
- refinement 정렬
- rewrite guide 조합
- model answer non-regression 적용
- summary dedupe

### `FeedbackSectionValidators.java`

역할:

- 각 섹션의 품질 검사와 정제를 담당합니다.

중요 규칙:

- no-op grammar 제거
- refinement placeholder 제거
- rewriteGuide/modelAnswer 중복 감소
- modelAnswer regression 방지
- summary/improvement 중복 축소

### `FeedbackGenerationModels.java`

역할:

- feedback generation 내부 모델 모음

예:

- `FeedbackDiagnosisResult`
- `GeneratedSections`
- `ValidationResult`
- `ValidationFailure`
- `RegenerationRequest`
- `RefinementCard`

### `FeedbackRetryPolicy.java`

역할:

- 어떤 섹션 실패는 retry할지
- 어떤 건 그냥 숨길지
- 어떤 건 deterministic fallback으로 갈지

를 정합니다.

### `FeedbackDeterministicCorrectionResolver.java`

역할:

- 최소 교정문(minimal correction)을 backend에서 더 안전하게 정리하는 레이어
- bare verb, broken connector, awkward phrasing 같은 걸 보정합니다.

### `FeedbackDeterministicSectionGenerator.java`

역할:

- LLM 응답이 약하거나 retry가 실패했을 때도 섹션을 완전히 비우지 않도록
- improvement / rewrite guide / summary / repair refinement / one-step-up fallback을 만들어 줍니다.

### `FeedbackLexicalChoiceNormalizer.java`

- awkward lexical choice를 별도 레이어로 관리합니다.
- 특정 개별 화면 patch가 아니라 재사용 가능한 lexical normalization 역할입니다.

### `AttemptOverlayPolicy.java`

- 몇 번째 시도인지에 따라 feedback 톤과 노출 강도를 조절합니다.

예:

- 2차 시도 이상이면 progress-aware overlay 적용
- 이미 해결된 문법은 덜 강조

### `RefinementFocus.java`

- refinement 카드가 어떤 목적에 더 맞춰질지 나타내는 enum입니다.

예:

- `GRAMMAR_PATTERN`
- `DETAIL_BUILDING`
- `NATURALNESS`

### `ModelAnswerMode.java`

- model answer의 모드를 나타내는 enum입니다.

예:

- `MINIMAL_CORRECTION`
- `ONE_STEP_UP`
- `TASK_RESET`
- `OPTIONAL_IF_ALREADY_GOOD`

---

## 8. 코치 시스템 핵심 서비스 설명

### `CoachService.java`

- 코치 기능의 메인 유즈케이스 서비스입니다.
- 질문/힌트/프롬프트 컨텍스트를 읽고
- `CoachQueryAnalyzer` 결과에 따라
  - writing support
  - idea support
  - meaning lookup
  을 분기합니다.
- 추천 표현 사용 검증도 여기서 처리합니다.

### `CoachQueryAnalyzer.java`

- 사용자의 코치 질문을 해석하는 분석기입니다.
- QueryMode, intent, meaning lookup target 등을 추출합니다.

이 파일을 읽을 때는 아래를 보면 됩니다.

- 질문이 어떤 모드로 분기되는지
- 한국어 의도를 어떻게 normalized question으로 바꾸는지
- 의미 조회 질문을 어떤 slot 기반 구조로 바꾸는지

### `OpenAiCoachClient.java`

- 코치용 OpenAI 호출 담당
- 표현 추천과 아이디어 지원 응답 생성

### `CoachEvaluationService.java`

- 코치 품질을 관리자/운영 관점에서 평가하는 서비스

### `OpenAiCoachEvaluationClient.java`

- 코치 평가를 위한 OpenAI 호출 전용 클라이언트

### `CoachEvaluationJob.java`

- 스케줄링/배치 관점에서 코치 평가 작업을 돌리는 잡

---

## 9. 인증/사용자/기록 서비스 설명

### `AuthService.java`

- 인증/회원가입/세션 사용자/프로필/계정 삭제 전체 담당
- 일반 로그인 + 이메일 인증 + 비밀번호 재설정 + 소셜 로그인 흐름까지 포함합니다.

### `GoogleOAuthService.java`

- Google OAuth 처리

### `NaverOAuthService.java`

- Naver OAuth 처리

### `KakaoOAuthService.java`

- Kakao OAuth 처리

### `RememberLoginService.java`

- remember-login 토큰 발급/검증/정리

### `VerificationMailService.java`

- 이메일 인증 메일 발송

### `AnswerHistoryService.java`

- 답안 이력 조회
- 오늘 상태
- 월간 상태
- common mistakes 집계
- 피드백 payload 재구성

### `DraftService.java`

- 답변 초안과 rewrite 초안을 prompt별로 저장/조회/삭제

### `PromptService.java`

- 프롬프트 조회
- daily prompt 추천
- prompt hint 조회

### `AdminPromptService.java`

- 관리자용 prompt/hint 관리 로직

---

## 10. Support/Metadata 계열 서비스 설명

이 파일들은 직접 API 엔드포인트 중심은 아니지만, 프롬프트 메타데이터를 더 똑똑하게 쓰기 위한 기반입니다.

### `PromptCoachProfileSupport.java`

- prompt별 coach profile을 정리/포맷팅하는 보조 로직

### `PromptHintItemSupport.java`

- hint item 해석 및 보조 처리

### `PromptOpenAiContextFormatter.java`

- OpenAI prompt에 넣을 프롬프트 문맥을 정리합니다.

### `PromptTaskMetaCatalog.java`

- 질문이 요구하는 task profile 메타의 카탈로그

### `PromptTaskMetaSupport.java`

- task meta를 해석/활용하는 보조 로직

### `PromptTopicCatalog.java`

- 프롬프트 topic 분류 카탈로그

### `PromptTopicSupport.java`

- topic 비교, 분류, 정규화 보조 로직

---

## 11. Persistence 계층 설명

Persistence는 "DB 스키마와 자바 코드가 만나는 곳"입니다.

### 11-1. 사용자/인증 관련

- `UserEntity.java` / `UserRepository.java`
  - 사용자 기본 정보
- `EmailVerificationTokenEntity.java` / `EmailVerificationTokenRepository.java`
  - 이메일 인증 토큰
- `PasswordResetTokenEntity.java` / `PasswordResetTokenRepository.java`
  - 비밀번호 재설정 토큰
- `RememberLoginTokenEntity.java` / `RememberLoginTokenRepository.java`
  - remember-login 토큰

### 11-2. 프롬프트/힌트/메타 관련

- `PromptEntity.java` / `PromptRepository.java`
  - 질문 본체
- `PromptHintEntity.java` / `PromptHintRepository.java`
  - prompt hint 묶음
- `PromptHintItemEntity.java` / `PromptHintItemRepository.java`
  - hint item 세부 정보
- `PromptCoachProfileEntity.java` / `PromptCoachProfileRepository.java`
  - 코치용 프로필 데이터
- `PromptAnswerModeEntity.java` / `PromptAnswerModeRepository.java`
  - prompt의 답변 모드/성격 메타
- `PromptTaskProfileEntity.java` / `PromptTaskProfileRepository.java`
  - task profile
- `PromptTaskProfileSlotEntity.java`
  - task profile 세부 슬롯
- `PromptTaskSlotEntity.java` / `PromptTaskSlotRepository.java`
  - task slot 메타
- `PromptTopicCategoryEntity.java` / `PromptTopicCategoryRepository.java`
  - 상위 topic
- `PromptTopicDetailEntity.java` / `PromptTopicDetailRepository.java`
  - 세부 topic

### 11-3. 답안/세션/기록 관련

- `AnswerSessionEntity.java` / `AnswerSessionRepository.java`
  - 하나의 질문에 대한 작문 세션
- `AnswerAttemptEntity.java` / `AnswerAttemptRepository.java`
  - 각 시도(초안, 피드백 후 rewrite 등)
- `AttemptType.java`
  - 시도 종류 enum
- `SessionStatus.java`
  - 세션 상태 enum

### 11-4. 코치/운영 평가 관련

- `CoachInteractionEntity.java` / `CoachInteractionRepository.java`
  - 코치 interaction 기록
- `CoachEvaluationStatus.java`
  - 코치 평가 상태
- `CoachResponseSource.java`
  - 코치 응답이 어디서 왔는지 표시

---

## 12. DTO 패키지 읽는 법

`dto` 패키지는 "API 입출력 계약"이라고 생각하면 됩니다.

### 12-1. Auth DTO

- `LoginRequestDto`
- `RegisterRequestDto`
- `SendRegistrationCodeRequestDto`
- `CompleteRegistrationRequestDto`
- `VerifyEmailRequestDto`
- `ResendVerificationRequestDto`
- `SendPasswordResetCodeRequestDto`
- `VerifyPasswordResetCodeRequestDto`
- `ResetPasswordRequestDto`
- `UpdateProfileRequestDto`
- `DeleteAccountRequestDto`
- `AuthResponseDto`
- `AuthNoticeDto`
- `PasswordResetAvailabilityDto`

역할:

- 인증 관련 요청과 응답 모양을 정의합니다.

### 12-2. Prompt/Admin DTO

- `PromptDto`
- `PromptHintDto`
- `PromptHintItemDto`
- `PromptTaskMetaDto`
- `PromptCoachProfileDto`
- `PromptCoachProfileRequestDto`
- `DailyPromptRecommendationDto`
- `DailyDifficultyDto`
- `AdminPromptDto`
- `AdminPromptRequestDto`
- `AdminPromptHintDto`
- `AdminPromptHintRequestDto`
- `AdminPromptTopicCatalogDto`

역할:

- 질문 본체와 관리자 편집용 계약을 담당합니다.

### 12-3. Feedback DTO

- `FeedbackRequestDto`
- `FeedbackResponseDto`
- `CorrectionDto`
- `InlineFeedbackSegmentDto`
- `GrammarFeedbackItemDto`
- `RefinementExpressionDto`
- `RefinementExpressionType`
- `RefinementExpressionSource`
- `RefinementMeaningType`
- `RefinementExampleSource`

역할:

- 작문 피드백 API의 핵심 계약입니다.

### 12-4. Coach DTO

- `CoachHelpRequestDto`
- `CoachHelpResponseDto`
- `CoachExpressionDto`
- `CoachExpressionUsageDto`
- `CoachUsageCheckRequestDto`
- `CoachUsageCheckResponseDto`
- `CoachSelfDiscoveredCandidateDto`

역할:

- 코치 기능의 입출력 계약입니다.

### 12-5. History / Draft DTO

- `AnswerHistorySessionDto`
- `AnswerHistoryAttemptDto`
- `AnswerHistoryFeedbackDto`
- `AnswerHistoryUsedExpressionDto`
- `TodayWritingStatusDto`
- `MonthWritingStatusDto`
- `MonthWritingStatusDayDto`
- `CommonMistakeDto`
- `WritingDraftDto`
- `SaveWritingDraftRequestDto`
- `WritingDraftTypeDto`

역할:

- 기록 화면과 draft 저장 기능의 계약입니다.

### 12-6. Admin Coach Evaluation DTO

- `AdminCoachEvaluationItemDto`
- `AdminCoachEvaluationSummaryDto`
- `AdminCoachEvaluationRunResponseDto`

역할:

- 코치 품질 평가용 관리자 계약입니다.

---

## 13. Frontend 구조 설명

Frontend는 "상태를 많이 들고 있는 단일 큰 루프 화면"과 "계정/관리 화면"으로 나눠 보면 이해가 쉽습니다.

### 13-1. App Router 엔트리

#### `apps/frontend/app/layout.tsx`

- 전체 레이아웃 엔트리

#### `apps/frontend/app/page.tsx`

- 홈 페이지 엔트리
- 실제 홈 UI는 `AnswerLoop` 로 이어집니다.

#### `apps/frontend/app/answer-loop.tsx`

- 이 프로젝트 프론트의 핵심 파일
- 질문 선택부터 답변, 피드백, rewrite, complete 화면까지 거의 모두 이 안에 들어 있습니다.

이 파일이 하는 일:

- 현재 step 관리
- prompt 추천/새로고침
- answer / rewrite 상태 관리
- feedback submit
- coach dialog
- draft 저장/복원
- 월간 상태 UI
- completion UI

신입이 프론트를 이해하고 싶으면 가장 먼저 읽어야 하는 파일입니다.

#### `apps/frontend/app/login/page.tsx`

- 로그인 페이지 엔트리

#### `apps/frontend/app/register/page.tsx`

- 회원가입 페이지 엔트리

#### `apps/frontend/app/forgot-password/page.tsx`

- 비밀번호 재설정 페이지 엔트리

#### `apps/frontend/app/me/page.tsx`

- 내 정보 페이지 엔트리

#### `apps/frontend/app/admin/page.tsx`

- 관리자 페이지 엔트리

### 13-2. 주요 컴포넌트

#### `login-page-client.tsx`

- 로그인 폼
- 이메일 인증 재전송
- 소셜 로그인 버튼

#### `register-page-client.tsx`

- 회원가입 폼

#### `forgot-password-page-client.tsx`

- 비밀번호 재설정 UI

#### `my-page-client.tsx`

- 내 정보/작문기록 탭 UI
- 계정 수정
- 회원탈퇴
- 기록 섹션 이동

#### `admin-page-client.tsx`

- 관리자용 prompt/hint 편집 화면

#### `inline-feedback-preview.tsx`

- inline feedback diff를 렌더링하는 컴포넌트

#### `top-navigation.tsx`

- 상단 네비게이션

#### `streak-sparkle-effect.tsx`

- streak/completion 시각 효과

### 13-3. Frontend lib

#### `lib/api.ts`

- 프론트가 백엔드와 통신하는 거의 모든 fetch wrapper가 여기 모여 있습니다.
- API 호출 실체를 찾을 때 가장 먼저 보는 파일입니다.

#### `lib/types.ts`

- 프론트 타입의 단일 소스에 가깝습니다.
- `Feedback`, `Prompt`, `CoachHelpResponse`, `HistorySession`, `AuthUser` 같은 핵심 타입이 여기 있습니다.

#### `lib/inline-feedback.ts`

- diff와 inline segment 렌더링 보조 로직

#### `lib/coach.ts`

- 로컬 코치 fallback / 코치 관련 표현 조합 유틸

#### `lib/refinement-recommendations.ts`

- refinement 추천 보조

#### `lib/feedback-level.ts`

- 점수/루프 완료 상태에 따라 피드백 레벨 표시 보조

#### `lib/home-writing-drafts.ts`

- 홈 화면 초안 보조 로직

#### `lib/difficulty.ts`

- 난이도 관련 보조

---

## 14. Infra / DB 설명

### `docker-compose.yml`

- 전체 개발/배포 컨테이너 실행 진입점

### `infra/nginx/dev.conf`

- 개발용 reverse proxy

### `infra/nginx/prod.conf`

- 운영용 reverse proxy

### `infra/mysql/init/001-create-database.sql`

- DB 초기 생성

### `infra/mysql/schema/*.sql`

- 실제 스키마 이력입니다.
- 번호가 올라갈수록 나중 변경입니다.

처음 읽을 때 추천:

1. `001-create-prompts.sql`
2. `002-create-answer-history.sql`
3. `003-create-users.sql`
4. `005-add-feedback-payload-to-answer-attempts.sql`
5. `011-create-coach-interactions.sql`
6. `012-create-prompt-coach-profiles.sql`
7. `018-create-prompt-hint-items.sql`
8. `028-create-prompt-task-metadata.sql`
9. `029-add-prompt-task-grammar-metadata.sql`
10. `030-add-users-last-login-at.sql`

이 순서로 보면:

- 질문
- 사용자
- 답안 시도
- 피드백 payload 저장
- 코치 상호작용
- prompt 메타 고도화

가 어떻게 확장됐는지 보입니다.

---

## 15. 이 프로젝트를 읽을 때 꼭 기억할 철학

### 15-1. 피드백은 예쁜 문장이 목적이 아니다

핵심 목표는:

- 사용자가 바로 더 나은 답을 다시 쓸 수 있는가

입니다.

그래서 코드도:

- routing
- answer band
- minimal correction
- rewrite guide
- model answer
- validator

가 중요합니다.

### 15-2. backend는 오케스트레이터다

현재 피드백 구조는:

1. deterministic preprocess
2. diagnosis
3. policy selection
4. section generation
5. validation / sanitization
6. selective retry
7. deterministic fallback

입니다.

즉 LLM이 모든 걸 알아서 쓰는 구조가 아니라:

- backend가 guardrail을 잡고
- LLM은 진단과 생성의 일부를 담당하는

하이브리드 구조입니다.

### 15-3. UI는 섹션을 그대로 믿지 않는다

프론트는 backend 응답을 그대로 그리기만 하지 않고:

- 빈 섹션 숨김
- inline diff 렌더링
- refinement 카드 정렬
- coach 사용 결과 표시

를 추가로 처리합니다.

---

## 16. 신입이 첫 주에 해 보면 좋은 것

### Day 1

- `README.md`
- `answer-loop.tsx`
- `lib/types.ts`

목표:

- 사용자 플로우 이해

### Day 2

- `FeedbackController`
- `FeedbackService`
- `OpenAiFeedbackClient`

목표:

- 피드백 생성 흐름 이해

### Day 3

- `AnswerProfileBuilder`
- `SectionPolicySelector`
- `FeedbackSectionPolicyApplier`
- `FeedbackSectionValidators`

목표:

- answer band와 섹션 정책 이해

### Day 4

- `CoachController`
- `CoachService`
- `CoachQueryAnalyzer`
- `OpenAiCoachClient`

목표:

- 코치 시스템 이해

### Day 5

- `AuthService`
- `AnswerHistoryService`
- `DraftService`
- `infra/mysql/schema`

목표:

- 사용자/기록/저장 구조 이해

---

## 17. 이 문서 다음에 읽으면 좋은 문서

아래 문서들이 이미 repo 안에 있습니다.

- `docs/answer-loop-explained.md`
- `docs/coach-ai-backend-flow.md`
- `docs/feedback-answer-profile-section-policy-2026-03-31.ko.md`
- `docs/feedback-grammar-source-of-truth-2026-03-30.ko.md`
- `docs/refinement-root-cause-fix-2026-03-31.ko.md`

추천 순서:

1. 이 온보딩 문서
2. `answer-loop-explained.md`
3. `coach-ai-backend-flow.md`
4. feedback 관련 설계 문서들

---

## 18. 마지막 요약

이 프로젝트를 한 문장으로 다시 정리하면:

> WriteLoop는 "프롬프트 선택 → 영어 답변 제출 → AI 피드백 → 다시쓰기 → 기록 축적"을 하나의 학습 루프로 만든 영어 작문 서비스입니다.

코드를 읽을 때는 항상 아래 질문을 붙이면 이해가 빨라집니다.

1. 이 파일은 `입구(controller)` 인가?
2. 이 파일은 `유즈케이스(service)` 인가?
3. 이 파일은 `LLM orchestration / validation` 인가?
4. 이 파일은 `DB shape(entity/repository)` 인가?
5. 이 파일은 `프론트 상태/렌더링` 인가?

이 기준만 잡히면, 파일 수가 많아 보여도 구조는 생각보다 일관적입니다.
