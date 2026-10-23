# WriteLoop 복합 오류 100건 추론 수준 low·medium 비교 보고서

## 1. 결론

동일한 복합 오류 답변 100건을 OpenAI `gpt-5.6-luna`에 요청하고 추론 수준만 `low`와 `medium`으로 바꿔 비교했다.

현재 코드에서 수행한 통제 비교 결과는 다음과 같다.

| 추론 수준 | 공식 통과 | 성공 응답 기준 정확도 | 요청 실패 | 판정 오류 |
|---|---:|---:|---:|---:|
| `low` | 93/100, 93.0% | 93/95, 97.9% | 5건 | 2건 |
| `medium` | **98/100, 98.0%** | **98/98, 100%** | 2건 | **0건** |
| 차이 | **+5건, +5.0%p** | **+2.1%p** | -3건 | -2건 |

이번 한 번의 실행에서는 `medium`이 분명히 더 좋았다. 특히 성공 응답 98건의 미션 종류와 `targetSlot`이 모두 정답표와 일치했다. `low`가 문장 구조를 일반 문법으로 처리하거나, 문법적으로 깨진 슬롯 증거를 누락으로 처리한 두 경계 사례도 `medium`은 정확히 판정했다.

그러나 응답 속도는 느려졌다.

- 성공 응답 p50: 10.97초 → 15.78초, **43.9% 증가**
- 성공 응답 p95: 16.32초 → 25.05초, **53.5% 증가**
- 100건 전체 실행 시간: 603.7초 → 804.4초, **33.2% 증가**

또한 `medium`에서도 문법 근거가 원문과 일치하지 않는 계약 오류가 2건 발생했다. 두 입력은 즉시 재실행했을 때 모두 정상화됐다. 따라서 `medium`은 의미 판정에는 도움이 됐지만, LLM 출력의 비결정성과 계약 `502`를 제거하지는 못했다.

현재 개발 백엔드의 추론 수준은 요청대로 `medium`으로 유지했다.

## 2. 비교 설계

### 2.1 고정한 조건

| 항목 | 값 |
|---|---|
| 테스트 데이터 | `scripts/feedback-quality/cases.mixed-errors-100.json` |
| 데이터 SHA-256 | `5ADC0EBB4EC48D76DCA770FA7FD4F3BF8B0C7B73E87AA5BB3AFDE8C582D86CA8` |
| 고유 답변 | 100개 |
| 사용한 활성 질문 | 25개 |
| 답변당 오류 유형 | 2~5개 |
| 오류 라벨 | 31종 |
| 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| 동시 실행 수 | 2 |
| 요청 제한 시간 | 120초 |
| API | 개발 백엔드 `http://localhost` |

정상 문장, 오프토픽, 단일 오류 대조군은 넣지 않았다. 모든 입력은 두 가지 이상의 오류가 섞인 동일한 100개 답변이다.

### 2.2 비교한 세 실행

| 이름 | 코드 상태 | 추론 수준 | 결과 |
|---|---|---|---:|
| 기존 보고서 low | 문법 근거 복원 적용 전 | `low` | 95/100 |
| 통제용 현재-code low | 현재 코드 | `low` | 93/100 |
| 공식 medium | 현재 코드 | `medium` | 98/100 |

기존 95점 low 이후 `grammarIssues.originalText` 제한 복원과 프롬프트 반례가 추가됐다. 따라서 **medium의 순수한 효과를 판단할 때는 기존 95점이 아니라 현재 코드로 다시 실행한 93점 low와 비교하는 것이 맞다.**

기존 95점과 medium을 단순 비교하면 3%p 개선이지만, 이 값에는 코드 변경과 LLM 실행 변동이 섞여 있다.

## 3. 통제 비교 결과

### 3.1 유형별 통과율

| 유형 | 현재-code low | medium | 차이 |
|---|---:|---:|---:|
| `MULTI_LOCAL_GRAMMAR` | 23/25 | 24/25 | +1 |
| `FRAGMENT_PLUS_ERRORS` | 24/25 | **25/25** | +1 |
| `DENSE_MULTI_GRAMMAR` | 21/25 | **25/25** | +4 |
| `MISSING_SLOT_PLUS_ERRORS` | **25/25** | 24/25 | -1 |
| **전체** | **93/100** | **98/100** | **+5** |

`medium`의 가장 큰 개선은 오류가 조밀한 문법 답변이었다. `DENSE_MULTI_GRAMMAR`가 21/25에서 25/25로 올라갔다. 문장 구조 케이스도 성공 응답에서는 전부 정확했다.

`MISSING_SLOT_PLUS_ERRORS`의 1건 하락은 슬롯 오판이 아니라 계약 `502`였다. 같은 입력 재실행에서는 기대한 `SLOT/SOLUTION`을 반환했다.

### 3.2 케이스별 변화

두 실행 모두 통과한 답변은 91건이었다.

| 변화 | 건수 |
|---|---:|
| low 실패 → medium 통과 | 7건 |
| low 통과 → medium 실패 | 2건 |
| 두 실행 모두 실패 | 0건 |

medium에서 개선된 7건은 다음과 같다.

| 번호 | 답변 유형 | low | medium |
|---:|---|---|---|
| 8 | 기술 변화 다중 문법 | `502` | `GRAMMAR_FIX` |
| 25 | 영어 학습 다중 문법 | `502` | `GRAMMAR_FIX` |
| 44 | 셀프 계산대 문장 구조 | `GRAMMAR_FIX` | `STRUCTURE_FIX` |
| 55 | 집중 문제 조밀 문법 | `SLOT/PROBLEM` | `GRAMMAR_FIX` |
| 61 | 장보기 조밀 문법 | `502` | `GRAMMAR_FIX` |
| 64 | 장소 조밀 문법 | `502` | `GRAMMAR_FIX` |
| 67 | 시간 관리 조밀 문법 | `502` | `GRAMMAR_FIX` |

medium에서 새로 실패한 2건은 다음과 같다.

| 번호 | 답변 유형 | low | medium |
|---:|---|---|---|
| 11 | 장보기 일상 다중 문법 | `GRAMMAR_FIX` | `502` |
| 92 | 시간 관리 해결책 누락 | `SLOT/SOLUTION` | `502` |

두 medium 실패는 모두 재실행에서 정상화됐다. 이는 케이스 자체의 지속적인 판정 실패가 아니라 LLM 출력 계약의 비결정적 흔들림이라는 뜻이다.

## 4. medium이 개선한 판정

### 4.1 구조 오류를 구조 미션으로 선택

답변:

```text
Reducing waiting time but machines is confusing and overall helpful.
```

low는 전체 문장을 `GRAMMAR_FIX`로 처리했다. medium은 `Reducing waiting time`과 `overall helpful`에 완전한 서술 구조가 없다고 보고 우선순위에 맞는 `STRUCTURE_FIX`를 선택했다.

medium 교정문:

```text
Self-checkout kiosks reduce waiting time, but the machines are confusing;
overall, they are helpful.
```

현재 정책인 `OFF_TOPIC → STRUCTURE_FIX → BLOCKING 문법 → 필수 슬롯 → LOCAL 문법`을 더 정확히 적용한 결과다.

### 4.2 문법적으로 깨졌지만 존재하는 PROBLEM을 인정

답변:

```text
Notifications makes me cannot focusing,
so I turn off it and puts my phone away.
```

low는 직장이나 학교에서 겪는 문제라는 점이 답변에 반복되지 않았다는 이유로 `PROBLEM` 누락을 선택했다. 이는 질문이 이미 제공한 고정 맥락을 상속하는 전역 규칙과 충돌한다.

medium은 `Notifications makes me cannot focusing`에서 집중을 방해하는 문제를 인식하고 `GRAMMAR_FIX`를 선택했다.

```text
Notifications make it difficult for me to focus,
so I turn it off and put my phone away.
```

medium이 질문 맥락 상속과 문법 오류 속 슬롯 의미를 함께 처리하는 데 더 안정적이었던 사례다.

## 5. 계약 오류 분석

medium의 공식 실패 2건은 모두 백엔드 로그에서 다음 오류로 확인됐다.

```text
Every grammar issue must quote an exact learner-answer span
```

실패 입력은 다음과 같다.

```text
After shopping, I goes home and puts the foods away
because they needs refrigeration.
```

```text
I has too many task and always forgets deadliness.
```

모델이 반환한 `grammarIssues.originalText` 중 하나가 학습자 원문의 정확한 부분 문자열이 아니었고, 제한적 복원 조건에도 맞지 않아 백엔드가 안전하게 거부했다. 두 입력을 medium으로 한 번씩 다시 실행했을 때는 각각 `GRAMMAR_FIX`, `SLOT/SOLUTION`으로 정상 처리됐다.

통제용 low에서는 같은 계약 오류가 다른 입력 5건에서 발생했다. low와 medium의 실패 입력이 겹치지 않았다는 점도 계약 오류가 특정 질문에 고정된 결함이 아니라 생성 시점에 따라 이동하는 비결정적 문제임을 보여 준다.

따라서 이번 실행에서 `502`가 5건에서 2건으로 감소했더라도, 이를 medium의 확정적인 효과로 해석하면 안 된다. 추론 수준을 올리는 것과 별개로 다음 조치가 여전히 필요하다.

- 제한 복원이 불가능한 계약 오류에 오류 사유를 전달해 한 번만 재호출
- 재호출 여부와 원본 계약 오류 사유 기록
- 같은 입력 반복 실행으로 계약 실패율 측정

## 6. 교정 밀도

| 지표 | 현재-code low | medium |
|---|---:|---:|
| API 성공 응답 | 95 | 98 |
| 전체 수정 포인트 | 174 | 187 |
| 수정 포인트 2개 이상 응답 | 44 | 48 |
| 응답당 평균 수정 포인트 | 1.83 | 1.91 |

문법 유형만 보면 다음과 같다.

| 문법 유형 | low 수정 포인트 | medium 수정 포인트 |
|---|---:|---:|
| `MULTI_LOCAL_GRAMMAR` | 64개/23응답 | 69개/24응답 |
| `DENSE_MULTI_GRAMMAR` | 60개/22응답 | 69개/25응답 |

medium이 더 많은 문법 오류를 포착하는 경향은 있었지만, 현재 스키마는 `grammarIssues`를 최대 3개로 제한한다. 오류가 네 개 이상인 답변에서는 추론 수준과 관계없이 일부 오류가 교정문에 남을 수 있다.

예를 들어 medium 실패 입력 11번을 재실행했을 때 미션은 정상 `GRAMMAR_FIX`였지만, 교정문에는 여전히 `puts the foods`가 남았다. 따라서 **98점은 최우선 미션과 출력 계약 정확도이지, 모든 문법 오류를 완전히 제거한 비율은 아니다.**

## 7. 응답 시간 비교

### 7.1 현재 코드 기준

| 지표 | low | medium | 증가 |
|---|---:|---:|---:|
| 성공 응답 평균 | 12.13초 | 16.04초 | +3.91초, +32.3% |
| 성공 응답 p50 | 10.97초 | 15.78초 | +4.81초, +43.9% |
| 성공 응답 p95 | 16.32초 | 25.05초 | +8.73초, +53.5% |
| 100건 전체 실행 | 603.7초 | 804.4초 | +200.7초, +33.2% |

low에는 81.88초짜리 이상치 한 건이 있었다. 그럼에도 중앙값과 p95 모두 medium이 뚜렷하게 느렸다.

### 7.2 기존 low와 비교

기존 low 성공 응답 p50은 11.22초, p95는 14.55초였다. medium은 각각 15.78초와 25.05초이므로, 기존 결과와 비교해도 중앙 응답시간은 40.7%, p95는 72.1% 증가했다.

테스트 도구가 OpenAI 토큰 사용량을 저장하지 않아 비용 차이는 이번 보고서에서 정량화할 수 없다.

## 8. 객관적 판단

이번 결과만 보면 `medium`을 선택하는 편이 피드백 품질에 유리하다.

- 성공 응답의 미션·슬롯 정확도: 97.9% → 100%
- 구조/문법 경계 오류: 1건 → 0건
- 문법 오류 때문에 슬롯을 놓친 사례: 1건 → 0건
- 조기 완료: 두 설정 모두 0건

반면 대가는 분명하다.

- 중앙 응답시간 약 44% 증가
- p95 약 54% 증가
- 계약 `502`는 여전히 발생
- 최대 3개 문법 오류 제한 때문에 완전 교정은 보장하지 않음

쌍별 결과는 medium 우세 7건, low 우세 2건이었다. 하지만 불일치 사례가 9건뿐인 단일 실행이므로 이 차이만으로 통계적으로 확정적인 우월성을 선언하기에는 표본이 부족하다. 관측된 방향은 medium 우세지만, 운영 결정을 확정하려면 같은 100건을 설정별로 최소 3회 반복해 평균 정확도와 판정 일치율을 비교하는 편이 안전하다.

현재 단계의 권장안은 다음과 같다.

1. 개발환경은 `medium`을 유지한다.
2. 사용자 체감 지연이 허용되는지 실제 앱에서 확인한다.
3. 계약 오류 한 번 재호출을 구현한 뒤 동일 세트를 반복 측정한다.
4. 토큰 사용량을 로그에 추가해 정확도·지연·비용을 함께 비교한다.

## 9. 결과 파일

| 결과 | 경로 |
|---|---|
| 동일 100건 데이터 | `scripts/feedback-quality/cases.mixed-errors-100.json` |
| 기존 low 95점 | `.codex_logs/feedback-mixed-errors-100-reviewed-2026-07-24/latest.json` |
| 현재-code low 93점 | `.codex_logs/feedback-mixed-errors-100-low-current-2026-07-24/latest.json` |
| medium 98점 | `.codex_logs/feedback-mixed-errors-100-medium-2026-07-24/latest.json` |
