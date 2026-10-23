# 영어일기 피드백 생성 순서 변경 후 실제 LLM 확인 (2026-10-23)

## 목적

`2f0f6af`에서 영어일기 피드백 스키마를 바꾼 뒤, 실제 OpenAI 응답의 품질을 확인한다.

- 생성 순서: 교정 포인트·흐름 분석을 먼저 쓰고 등급·점수를 나중에 정한다.
- 교정 일기·모범 일기·번역은 웹 요청에서만 생성한다.
- 기분과 직전 일기에 사용법을 적었다.

## 방법

- 모델 `gpt-6-luna`, 추론 강도 `medium`(운영과 같음)
- 서버와 같은 프롬프트·스키마 코드로 OpenAI를 직접 호출했다(일회용 테스트, 커밋하지 않음).
- 일기 4편

| 일기 | 특징 |
|---|---|
| past-tense | 현재형으로 쓴 과거 일, 대문자 실수 |
| grammar-flow | 흐름은 있지만 관사·시제가 흔들림 |
| rewrite | 2차 시도. 직전 버전: "I cook dinner. It is pasta. Taste good." |
| too-short | "work. tired. sleep early." |

- 1차: 4편 × 모바일·웹 요청 = 8회
- 2·3차: 프롬프트를 고친 뒤 모바일 요청만 7회

## 1차 결과

| 일기 | 요청 | 시간 | 출력 토큰 | 등급 | 교정 포인트 |
|---|---|---|---|---|---|
| past-tense | 모바일 | 14.1초 | 1,447 | CLEAR_BASIC | 1(세 문장을 하나로 묶음) |
| past-tense | 웹 | 16.7초 | 1,575 | CLEAR_BASIC | 3 |
| grammar-flow | 모바일 | 16.0초 | 1,587 | CLEAR_BASIC | 4 |
| grammar-flow | 웹 | 22.3초 | 2,222 | CLEAR_BASIC | 4 |
| rewrite | 모바일 | 13.2초 | 1,332 | NATURAL_COMPLETE | 0 |
| rewrite | 웹 | 19.6초 | 1,730 | NATURAL_COMPLETE | 0 |
| too-short | 모바일 | 12.2초 | 1,271 | TOO_SHORT | 1 |
| too-short | 웹 | 14.4초 | 1,512 | TOO_SHORT | 1 |

- 8회 모두 성공했고, 생성 순서가 `fixPoints → diaryFlow → diaryAnswerBand → score`로 나왔다.
- 모바일 요청이 웹 요청보다 평균 약 4초 빠르고 출력 토큰이 약 20% 적었다(일기 3편을 만들지 않음).
- 다시 쓴 일기에서 두 요청 모두 직전 버전보다 나아진 점(과거형, 이유와 감정 추가)을 칭찬했다. 새로 넣은 직전 일기 사용법이 동작한다.
- 칭찬과 미션이 실제 내용(떡볶이, 비 맞은 고양이 농담 등)에 맞았고 없는 사실을 지어내지 않았다.

### 발견한 문제

1. 모바일 요청 한 번에서 세 문장의 과거형 실수를 교정 포인트 하나로 묶었다. 모바일은 교정 포인트만 보여 주므로 문장별로 나뉘어야 한다.
2. `kind` 값이 `grammar`, `article`, `past_tense`, `문장 완성`처럼 제각각이었다. 화면에서는 쓰지 않지만 집계하려면 값이 일정해야 한다.
3. 교정한 문장이 원래 뜻보다 더 바뀌는 경우가 있었다. 예: "sleep early." → "I wanted to go to bed early."

## 고친 것

- 교정 포인트는 고칠 문장 하나당 하나. 여러 문장을 묶지 않고, 5개를 넘으면 가장 중요한 5개만 남긴다.
- `kind`를 `GRAMMAR`, `WORD_CHOICE`, `NATURALNESS`, `FLOW`, `SENTENCE_FORM` 다섯 값으로 고정했다(스키마 enum).
- revisedText는 틀린 부분만 고치고 학습자의 단어와 뜻을 유지한다. 행동·감정·세부를 더하지 않는다.

## 2·3차 결과(모바일 요청)

- past-tense를 두 번 돌렸고, 두 번 모두 문장별 교정 3개가 나왔다.
- `kind`는 정해진 값만 나왔다(GRAMMAR, SENTENCE_FORM).
- 뜻 유지 규칙 후: "sleep early." → "I went to bed early.", "I was wet when I arrive at office" → "I got wet when I arrived at the office."

## 남은 점

- 점수는 같은 일기라도 요청마다 6점 정도 달랐다(78·84). 점수는 화면에 보이지 않고 저장만 된다.
- 표본이 4편이라 넓은 회귀 평가는 아니다. 문장 피드백처럼 일기 평가셋을 만들면 더 확실하게 비교할 수 있다.
