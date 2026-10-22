---
status: accepted
date: 2026-10-21
decision-makers: gyuwon
---

# 문장 피드백, 코치, 영어일기 모델을 OpenAI gpt-6-luna로 통일한다

## Context and Problem Statement

문장 피드백, 코치, 영어일기, Now in English가 OpenAI 모델을 쓰는데, 저장소 기본값과 운영 서버 설정이 서로 어긋나 있었다. 문장 피드백의 Java 기본값은 `gpt-5-mini`였다. 운영에서 먼저 gpt-6-luna로 바꾼 뒤, 저장소 기본값을 맞출 필요가 있었다.

## Decision Drivers

* 운영 설정과 저장소 기본값이 같아야 한다.
* 이전 모델(gpt-5.6-luna, 추론 강도 low)에서 문장 피드백 실패율이 13.4%였다(2026-10-20 운영 분석).

## Considered Options

* 기능별로 다른 모델 유지
* 모든 OpenAI 기능을 gpt-6-luna로 통일

## Decision Outcome

Chosen option: "gpt-6-luna로 통일", because 운영에서 먼저 적용한 모델과 기본값을 맞추고, 기능 간 설정 차이를 없애기 위해서다. 추론 강도는 문장 피드백 low, 영어일기 medium으로 두고, 코치는 문장 피드백 값을 따른다.

### Consequences

* Good, because 로컬 회귀 150건 × 3회(2026-10-21~22)에서 문장 피드백 계약 오류가 0건이었다.
* Bad, because OpenAI가 응답 없이 멈추는 일이 150건 중 약 1~3건 있었다. 이 문제는 ADR-0008에서 대응했다.

### Confirmation

* `application.yml`, `docker-compose.yml`, `.env.dev.example`의 `OPENAI_*_MODEL` 기본값
* `feedback_diagnosis_logs.llm_model`

## More Information

* 커밋: `8d74ce3`
