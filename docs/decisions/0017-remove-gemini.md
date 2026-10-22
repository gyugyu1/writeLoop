---
status: accepted
date: 2026-10-23
decision-makers: gyuwon
---

# Gemini 코드와 설정을 지우고, LLM 제공자는 OpenAI 하나로 둔다

## Context and Problem Statement

문장 피드백, 영어일기, 코치에는 OpenAI와 Gemini 구현이 함께 있었다. 환경변수(`LLM_*_PROVIDER`)로 기능마다 제공자를 골랐고, 기본값은 Gemini였다. 운영은 2026-10 기준 모든 기능에 OpenAI를 쓴다(ADR-0005). 앞으로 Gemini를 쓸 계획이 없다.

Gemini 쪽 코드는 쓰이지 않는데도 유지 비용이 있었다.

* 문장 피드백 계약을 바꿀 때 Gemini 구현도 함께 맞춰야 했다.
* 요청 마감(ADR-0016)이나 스키마 순서 같은 개선을 Gemini에는 적용하지 않아, 두 구현이 서로 달라지고 있었다.
* 제공자를 고르는 라우터의 기본값이 Gemini라, 설정이 빠지면 의도와 다른 제공자로 갈 수 있었다.

관리자 코치 평가(`CoachEvaluationService`)는 Gemini로만 구현돼 있었다. 자동 실행은 꺼져 있었고, 운영 코치 대화 35건 중 평가된 것이 없었다(2026-10-23 확인). 웹·모바일 화면도 이 기능을 부르지 않았다.

## Decision Drivers

* 운영에서 쓰는 코드만 남긴다.
* 설정이 빠졌을 때 의도하지 않은 제공자로 가지 않아야 한다.

## Considered Options

* Gemini 구현을 남겨 두고 기본값만 OpenAI로 바꾼다.
* Gemini 구현, 설정, 제공자 선택을 모두 지운다. 쓰이지 않던 관리자 코치 평가도 지운다.
* 관리자 코치 평가는 OpenAI로 옮기고 나머지 Gemini 코드를 지운다.

## Decision Outcome

Chosen option: "모두 지운다", because 앞으로 쓸 계획이 없고, 관리자 코치 평가는 한 번도 쓰이지 않아 옮길 이유가 없기 때문이다. 필요해지면 그때 OpenAI로 다시 만든다.

* 지운 것
  * Gemini 클라이언트: 문장 피드백, 영어일기, 코치, 코치 평가, 공통 출력 도우미
  * 관리자 코치 평가: 컨트롤러, 서비스, 예약 작업, DTO
  * 설정: `gemini.*`, `llm.*-provider`, `app.coach-evaluation.*`. compose와 환경변수 예시의 `GEMINI_*`, `LLM_*_PROVIDER`
* `LlmFeedbackClient`, `LlmCoachClient`, `LlmDiaryFeedbackClient`는 제공자를 고르지 않고 OpenAI 엔진을 바로 쓴다. 엔진 인터페이스는 테스트와 기록(provider 이름)에 쓰여 남긴다.
* DB의 코치 평가 열(`coach_interactions.evaluation_*`)은 그대로 둔다. 지우려면 마이그레이션이 필요하고, 남겨도 해가 없다.

### Consequences

* Good, because 계약·프롬프트를 바꿀 때 한 구현만 맞추면 된다.
* Good, because 설정이 빠져도 다른 제공자로 갈 수 없다.
* Bad, because 다른 제공자로 바꾸려면 구현을 새로 만들어야 한다.
* Bad, because 관리자 코치 평가 API(`/api/admin/coach-evaluations` 계열)가 없어졌다.

### Confirmation

* 백엔드 테스트 325개 통과, 로컬 DB로 백엔드 기동과 `/health` 확인(2026-10-23)

## More Information

* 개인정보 처리방침(웹 `public-legal-documents.ts`, 모바일 `legal-documents.ts`)에는 국외 이전받는 자로 "Google LLC (Gemini API)"가 남아 있다. 처리방침 개정(시행일, 고지)이 따르므로 사용자가 정한다.
* 운영 서버 `.env`의 `GEMINI_*`, `LLM_*_PROVIDER` 값은 더 이상 읽지 않는다. 정리하고, Gemini API 키는 Google AI Studio에서 폐기한다.
