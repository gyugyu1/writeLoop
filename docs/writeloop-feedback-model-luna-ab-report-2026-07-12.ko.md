# WriteLoop 질문 답변 피드백 GPT-5.6 Luna 전환 A/B 테스트 보고서

> 이 문서는 Luna 최적화 전 초기 기준선 기록이다. 최종 구현과 재실행 결과는 `writeloop-feedback-luna-optimized-prompt-ab-report-2026-07-12.ko.md`를 기준으로 한다.

작성일: 2026-07-12  
대상 기능: 질문 답변형 영어 피드백  
기준 모델: `gpt-5.4-mini`  
실험 모델: `gpt-5.6-luna`  
추론 강도: `low`

## 1. 결론

동일한 프롬프트와 동일한 50개 평가 사례로 두 모델을 각각 실제 호출했다.

`gpt-5.6-luna`는 평균 응답 시간을 약 25% 줄였고 한국어 스켈레톤 생성 품질도 개선했다. 그러나 엄격 통과 건수는 38건에서 34건으로 감소했고, 완료 판정 정확도는 90%에서 78%로 하락했다. 사례별 비교에서도 개선 3건, 회귀 8건으로 회귀가 더 많았다.

또한 공식 토큰 단가는 Luna가 현재 기준 모델보다 약 33% 높다. 따라서 현재 프롬프트 그대로라면 Luna는 **더 빠르지만 더 비싸고, 자동 품질은 낮은 결과**를 보였다.

모델 설정은 요청에 따라 Luna로 전환했지만, 이번 결과만 놓고 보면 프롬프트와 완료 상태 계약을 보강하기 전 운영 배포는 권장하기 어렵다.

## 2. 공식 모델 특성

| 항목 | GPT-5.4 mini | GPT-5.6 Luna |
|---|---:|---:|
| 모델 ID | `gpt-5.4-mini` | `gpt-5.6-luna` |
| 입력 100만 토큰 | $0.75 | $1.00 |
| 출력 100만 토큰 | $4.50 | $6.00 |
| 컨텍스트 윈도 | 400K | 1.05M |
| 최대 출력 | 128K | 128K |
| Responses API | 지원 | 지원 |
| Structured Outputs | 지원 | 지원 |

Luna는 GPT-5.6 계열에서 비용 민감·대량 처리용으로 설계됐고, 이전 GPT 계열의 nano 등급과 대략 대응하는 모델로 설명돼 있다.

- GPT-5.4 mini: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- GPT-5.6 Luna: https://developers.openai.com/api/docs/models/gpt-5.6-luna

## 3. 테스트 방법

### 3.1 통제 조건

- 같은 백엔드 빌드 사용
- 같은 developer prompt와 JSON user context 사용
- 같은 Structured Outputs 스키마 사용
- 같은 50개 질문·답변 사용
- reasoning effort `low` 사용
- 동시성 1로 순차 호출
- 요청 제한 시간 180초
- 성공 payload도 모두 저장
- 모델 변경 시 백엔드 컨테이너 환경변수를 교체하고 실제 호출 로그의 모델명을 확인

### 3.2 평가 사례

평가셋은 일반적인 이유, 내용 부족, 가벼운 문법 오류, 의미를 막는 문법 오류, 짧은 답변, 질문과 무관한 답변, 필수 내용 누락, 충분히 좋은 답변, 일반적인 계획 등을 포함한 50건이다.

평가 파일: `scripts/feedback-quality/cases.prompt-refactor-50.json`

## 4. 정량 비교

| 지표 | GPT-5.4 mini | GPT-5.6 Luna | 변화 |
|---|---:|---:|---:|
| 요청 성공 | 50/50 | 50/50 | 동일 |
| 엄격 통과 | 38/50, 76% | 34/50, 68% | -4건, -8%p |
| 허용 가능한 미션 선택 | 39/50 | 34/50 | -5건 |
| 핵심 코치 필드 완성 | 50/50 | 50/50 | 동일 |
| 미션 지원 정보 완성 | 50/50 | 50/50 | 동일 |
| 완료 판정 정확도 | 90% | 78% | -12%p |
| 콘텐츠 스캐폴드 제공률 | 100% | 100% | 동일 |
| 근거 있는 before/after | 100% | 100% | 동일 |
| 평균 품질 점수 | 6.68/7 | 6.36/7 | -0.32 |
| 평균 추천 표현 수 | 1.62개 | 1.04개 | -0.58개 |
| 평균 응답 시간 | 7.561초 | 5.675초 | -24.9% |
| P50 응답 시간 | 7.544초 | 5.635초 | -25.3% |
| P95 응답 시간 | 9.960초 | 8.358초 | -16.1% |

### 4.1 사례별 변화

- Luna 개선: 3건
- 동일: 39건
- Luna 회귀: 8건
- 전체 품질 차원 점수 변화: -16점

## 5. Luna에서 개선된 부분

### 5.1 응답 속도

평균과 중앙값 응답 시간이 모두 약 25% 줄었다. P95도 약 16% 줄어 대부분의 요청이 기준 모델보다 빠르게 완료됐다.

단, 한 사례에서 16.8초 지연이 발생해 항상 빠른 것은 아니었다.

### 5.2 한국어 스켈레톤

내용 미션에서 `skeletonKo`가 사실상 영어 문장인 사례는 다음과 같았다.

- GPT-5.4 mini: 21건
- GPT-5.6 Luna: 0건

Luna는 영문 스켈레톤과 한국어 안내를 더 안정적으로 구분했다.

### 5.3 구체성 판단 일부 개선

Luna는 다음 사례에서 기준 모델보다 나은 미션을 선택했다.

- 일반적인 영화 이유를 `COMPLETE`가 아닌 `DETAIL`로 선택
- 모호한 말하기 연습 계획을 `COMPLETE`가 아닌 `DETAIL`로 선택
- 잘못된 `prepare for go out` 표현을 `REASON`이 아닌 `GRAMMAR_FIX`로 선택

## 6. Luna에서 회귀한 부분

### 6.1 완료 상태 모순

Luna 응답에서 완료 관련 필드가 서로 모순되는 사례가 7건 발생했다.

- `coachMove.focusType=COMPLETE`인데 `loopComplete=false`: 5건
- `loopComplete=true`인데 교정 `fixPoint`가 남음: 2건

기준 모델에서는 같은 유형의 모순이 0건이었다.

이는 `missionDecision.chosenType`, `coachMission.missionType`, `finishable`, `taskCompletion`, 점수와 최종 완료 상태가 하나의 계약으로 충분히 묶이지 않았음을 의미한다.

### 6.2 과도한 완료

Luna는 다음 답변을 너무 일찍 완료했다.

- `I feel good`처럼 지나치게 일반적인 이유
- `fresh mood`처럼 명확히 어색한 결합 표현
- `makes my stress disappear`처럼 다듬을 가치가 있는 표현
- 질문이 요구한 이유의 개수나 구체성을 충족하지 못한 답변

### 6.3 표현 교정 감소

미션 분포에서 Luna는 `EXPRESSION_POLISH`를 한 번도 선택하지 않았다.

- GPT-5.4 mini: 2건
- GPT-5.6 Luna: 0건

어색하지만 의미가 통하는 표현을 교정하기보다 완료하는 경향이 나타났다.

### 6.4 공통 결함 유지

두 모델 모두 다음 문제를 반복했다.

- 이유를 묻지 않는 질문에서 `REASON` 선택
- 전치사나 국소 표현 교정보다 선택적 이유를 우선
- 주말 습관 시제 오류보다 이유 추가를 우선

이 문제는 모델 교체만으로 해결되지 않으므로 프롬프트 또는 질문 메타데이터 개선이 필요하다.

## 7. 도출된 프롬프트 개선점

### 7.1 `COMPLETE`를 원자적 계약으로 정의

현재도 완료 규칙이 있지만 Luna가 관련 필드를 서로 다르게 출력했다. 다음 조건을 하나의 불변식으로 더 명시해야 한다.

```text
If chosenType is COMPLETE:
- taskCompletion must be COMPLETE.
- finishable must be true.
- chosenSlot must be NONE.
- missingSlots must contain no required slot.
- coachMission.missionType must be COMPLETE.
- fixPoints must be empty.
- no correction, scaffold, or optional mission may remain.

If any correction or missing required content remains, COMPLETE is forbidden.
```

백엔드에서도 이 조합이 어긋나면 응답을 거부하거나 한 번 재생성하는 계약 검증이 필요하다.

### 7.2 필수 슬롯의 개수와 품질을 검사

`REASON`이 존재하는지만 보지 말고 질문이 요구한 개수와 구체성을 확인하도록 강화해야 한다.

```text
- A generic evaluation such as good, nice, fun, or I feel good does not satisfy a why requirement.
- If the prompt asks for two reasons, one reason cannot complete the task.
- Do not mark the task complete while any required slot count is unmet.
```

### 7.3 실제 질문을 메타데이터보다 우선

이유를 묻지 않는 자유시간 질문에서도 `REASON`이 선택됐다. 질문 문장과 메타데이터가 충돌할 때 실제 질문을 우선하도록 해야 한다.

```text
- The literal question is the source of truth for required content.
- Never require REASON unless the question explicitly asks why or a reason is essential to the communicative task.
- Treat conflicting task metadata as advisory, not authoritative.
```

### 7.4 문법·표현 교정과 선택적 내용의 경계 강화

```text
- When required content is present, repair one objective local grammar or collocation issue before adding optional content.
- Use EXPRESSION_POLISH for understandable but clearly non-idiomatic core phrases.
- Do not choose COMPLETE when a high-value correction appears in fixPoints.
```

### 7.5 한 번에 한 행동만 요구

교정 예시에서 문법 수정과 질문 프레임 추가가 동시에 요구되는 사례가 있었다. 하나의 미션에서는 한 가지 변환만 지시하도록 제한해야 한다.

### 7.6 필드 간 의미 일치

다음 필드가 같은 의미를 유지하도록 명시해야 한다.

- `modelAnswer`와 `modelAnswerKo`
- `skeletonEn`과 `skeletonKo`
- `suggestedPhrases.phrase`와 `meaningKo`
- `originalText`, `revisedText`, `whyKo`

### 7.7 Luna용 프롬프트 압축

Luna는 이전 세대의 nano 등급에 가까운 비용 중심 모델이다. 복합적인 교육 판단을 한 번에 처리할 때 긴 예외 목록보다 짧은 결정표와 강한 불변식이 더 적합할 가능성이 있다.

현재 프롬프트를 다음 세 블록 중심으로 더 압축하는 실험이 필요하다.

1. required content 판정
2. grammar/content/complete 결정표
3. 선택된 미션과 모든 출력 필드의 정합성 계약

## 8. 설정 변경 범위

질문 답변 피드백 모델만 Luna로 전환했다.

- `openai.feedback-model` 기본값: `gpt-5.6-luna`
- Docker Compose `OPENAI_FEEDBACK_MODEL` 기본값: `gpt-5.6-luna`
- 개발 예제 환경: `gpt-5.6-luna`
- 로컬 개발 환경: `gpt-5.6-luna`
- 운영 환경 파일: `gpt-5.6-luna`

일기 피드백과 AI 코치 모델은 질문 답변 모델을 자동 상속하지 않도록 기본값을 분리했다.

## 9. 배포 판단

현재 설정 파일은 Luna로 변경됐지만 다음 품질 게이트를 만족하기 전에는 운영 반영을 보류하는 편이 안전하다.

- 엄격 통과율이 기준 모델 이상
- 완료 판정 정확도 90% 이상
- `COMPLETE` 상태 모순 0건
- 명확한 표현 교정 누락 0건
- 영문·한국어 의미 불일치 자동 검사 통과

속도가 최우선이면 Luna를 사용할 수 있지만, 현재 WriteLoop의 핵심 가치인 정교한 미션 선택을 우선하면 `gpt-5.4-mini` 유지 또는 `gpt-5.6-terra` 비교가 더 안전하다.

## 10. 결과 파일

- GPT-5.4 mini 50건: `.codex_logs/feedback-model-ab-2026-07-12/before-gpt-5.4-mini/latest.json`
- GPT-5.6 Luna 50건: `.codex_logs/feedback-model-ab-2026-07-12/after-gpt-5.6-luna/latest.json`
- 모델 비교: `.codex_logs/feedback-model-ab-2026-07-12/comparison.json`
- 평가셋: `scripts/feedback-quality/cases.prompt-refactor-50.json`
