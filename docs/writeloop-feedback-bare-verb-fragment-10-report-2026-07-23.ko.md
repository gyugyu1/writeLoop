# WriteLoop 기본형 동사 문장 조각 10건 LLM 테스트 보고서

## 1. 목적

`Nap on weekend.`처럼 기본형 동사로 시작해 명령문으로도 해석될 수 있지만, 개인 경험을 묻는 질문의 답변으로는 주어가 빠진 문장 10건을 실제 LLM에 전송했다.

모든 사례는 다음 질문에 대한 답변으로 고정했다.

```text
How do you usually spend your weekend?
```

현재 WriteLoop 계약은 모든 답변 구간이 독립적인 답변 문장이어야 한다고 규정한다. 따라서 이번 정답표는 열 문장 모두 `FRAGMENT`, 최종 미션은 `STRUCTURE_FIX`로 설정했다.

## 2. 실행 조건

| 항목 | 값 |
|---|---|
| 실행일 | 2026-07-23 |
| 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| reasoning effort | `low` |
| 테스트 수 | 10 |
| 동시 요청 | 2 |
| 요청 실패 | 0 |
| 평균 응답 시간 | 10,151ms |
| p95 응답 시간 | 11,396ms |

## 3. 공식 결과

엄격 채점 결과는 **8/10, 80%**다.

| 번호 | 학습자 답변 | 실제 미션 | 교정 결과 | 판정 |
|---:|---|---|---|---|
| 1 | `Nap on weekend.` | `STRUCTURE_FIX` | `I nap on weekends.` | 통과 |
| 2 | `Sleep late on weekends.` | `STRUCTURE_FIX` | `I sleep late on weekends.` | 통과 |
| 3 | `Rest at home on Sundays.` | `COMPLETE` | 원문 유지 | 실패 |
| 4 | `Watch movies on Saturday nights.` | `STRUCTURE_FIX` | `I watch movies on Saturday nights.` | 통과 |
| 5 | `Play games after lunch.` | `STRUCTURE_FIX` | `I play games after lunch on weekends.` | 통과 |
| 6 | `Read books at a cafe.` | `STRUCTURE_FIX` | `I read books at a cafe.` | 통과 |
| 7 | `Meet friends on Saturdays.` | `STRUCTURE_FIX` | `I meet friends on Saturdays.` | 통과 |
| 8 | `Go hiking on Sunday mornings.` | `STRUCTURE_FIX` | `I go hiking on Sunday mornings.` | 통과 |
| 9 | `Cook dinner with my family.` | `STRUCTURE_FIX` | `I cook dinner with my family.` | 통과 |
| 10 | `Clean my room every weekend.` | `SLOT / ADDITIONAL_ACTION` | 원문 유지 | 실패 |

### 실패 1: 명령문을 완전한 답변으로 인정

```text
Rest at home on Sundays.
```

LLM은 이를 주어가 생략된 개인 답변이 아니라 문법적으로 독립 가능한 명령문으로 읽어 `COMPLETE`로 처리했다. 그 결과 문장 구조 교정 없이 루프까지 완료했다.

### 실패 2: 구조보다 내용 슬롯을 먼저 처리

```text
Clean my room every weekend.
```

LLM은 문장 구조를 완전하다고 본 뒤 `ACTION`은 충족됐지만 추가 주말 활동이 없다고 판단해 `SLOT / ADDITIONAL_ACTION`을 선택했다. 원문을 그대로 `correctedAnswer`로 반환했으므로 주어가 빠진 구조는 교정되지 않았다.

## 4. 반복 실행 비교

공식 실행 전에 첫 문장을 `Nap on weekends.`로 둔 예비 10건도 한 번 실행했다. 예비 실행은 9/10이었지만 `Sleep late on weekends.`가 `SLOT / ACTION`으로 실패했다.

두 실행에서 문장이 완전히 같았던 9건 중 다음 3건의 구조 판정이 바뀌었다.

| 답변 | 예비 실행 | 공식 실행 |
|---|---|---|
| `Sleep late on weekends.` | `SLOT / ACTION` | `STRUCTURE_FIX` |
| `Rest at home on Sundays.` | `STRUCTURE_FIX` | `COMPLETE` |
| `Clean my room every weekend.` | `STRUCTURE_FIX` | `SLOT / ADDITIONAL_ACTION` |

동일 문장 9건 중 3건, 33.3%가 실행 사이에 다른 미션을 받았다. 또한 이전 150건 테스트에서 `Nap on weekend.`는 `SLOT / ACTION`이었지만 이번 공식 실행에서는 `STRUCTURE_FIX`였다.

따라서 특정 동사 하나만의 문제가 아니라, **기본형 동사 문장을 명령문으로 볼지 문답 맥락의 생략문으로 볼지 LLM 판정이 흔들리는 문제**다.

## 5. 프롬프트 개선

명령문 자체를 금지하지 않고, 질문이 요구하는 행위 주체가 명령문 해석으로 바뀌는 경우만 문장 조각으로 처리하도록 다음 규칙을 추가했다.

```text
An imperative sentence can be structurally complete. However, when the question
asks the learner to describe the learner's own action or thought, an imperative
reading that changes the actor to implicit "you" does not make the answer complete.
In that case, set structureAssessment.status to FRAGMENT and minimally restore
the learner as the subject.
```

이 규칙은 다음 두 판단을 동시에 보존한다.

- 실제 지시·명령을 요구하는 질문의 정상 명령문은 완전한 문장이다.
- 학습자 자신의 행동이나 생각을 묻는 질문에서 암묵적 `you`로 주체가 바뀌는 명령문 해석은 답변을 완성하지 못한다.

프롬프트 문구를 고정하는 `CanonicalFeedbackContractTest`도 추가했다.

## 6. 동일 10건 재실행

백엔드를 새 소스로 재빌드한 뒤 모델과 추론 수준을 그대로 유지하고 동일한 10건을 다시 실행했다.

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| `STRUCTURE_FIX` 일치 | 8/10, 80% | 10/10, 100% |
| 실패 | 2건 | 0건 |
| 요청 실패 | 0건 | 0건 |
| 평균 응답 시간 | 10,151ms | 11,693ms |
| p95 응답 시간 | 11,396ms | 14,654ms |

변경 전에 실패했던 두 문장도 다음처럼 교정됐다.

| 답변 | 변경 전 | 변경 후 교정 |
|---|---|---|
| `Rest at home on Sundays.` | `COMPLETE` | `I usually rest at home on Sundays.` |
| `Clean my room every weekend.` | `SLOT / ADDITIONAL_ACTION` | `I clean my room every weekend.` |

나머지 8건도 모두 `STRUCTURE_FIX`를 유지했다. 열 교정문 모두 질문에 답하는 학습자를 명시적 주체 `I`로 복원했다.

응답 시간은 평균 1,542ms 증가했지만 표본이 10건뿐이므로 프롬프트 변경의 직접적인 지연 효과라고 단정할 수 없다.

## 7. 종합 판단

이번 표본에서는 문맥 기반 명령문 규칙을 추가한 뒤 **80%에서 100%로 개선**됐다. 이전에 호출마다 바뀌었던 `Rest`, `Clean`, `Sleep` 유형도 이번 실행에서는 모두 일관되게 구조 교정됐다.

다만 변경 후 실행은 한 번뿐이므로 확률적 일관성이 완전히 해결됐다고 단정할 수 없다. 또한 조언·지시·직접 발화를 요구하는 질문에서 `Believe in yourself.` 같은 정상 명령문을 여전히 `COMPLETE`로 인정하는지 별도 회귀 테스트가 필요하다.

## 8. 산출물

- 테스트 케이스: `scripts/feedback-quality/cases.ambiguous-bare-verb-fragments-10.json`
- 변경 후 원본 결과: `.codex_logs/feedback-ambiguous-bare-verb-fragments-10-after-imperative-rule-2026-07-23/latest.json`
- 변경 전 공식 원본 결과: `.codex_logs/feedback-ambiguous-bare-verb-fragments-10-exact-2026-07-23/latest.json`
- 변경 전 예비 원본 결과: `.codex_logs/feedback-ambiguous-bare-verb-fragments-10-2026-07-23/latest.json`
