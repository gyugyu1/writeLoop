# Coach 1000 Query Audit Round (2026-03-27)

2026-03-27에 진행한 `AI 표현 코치` 백엔드 강화 작업을 정리한 문서입니다.

이 라운드의 목적은 두 가지였습니다.

1. 올바른 문장과 비문을 섞은 대규모 질문 세트로 현재 엔진을 실제처럼 흔들어 보기
2. 그 결과를 보고 `meaning lookup` / `writing support` 분기와 의미 family 분류 로직을 강화하기

---

## 1. 이번에 정확히 한 일

이번 라운드에서 실제로 수행한 작업은 아래와 같습니다.

1. 서브에이전트를 활용해 취약 구간을 먼저 분석
2. 백엔드 테스트 코드에 1000건 질문 감사 하네스를 추가
3. 감사 결과를 보고 `CoachQueryAnalyzer` 중심으로 의미 추출 로직 보강
4. 회귀 테스트 추가
5. 감사 테스트를 반복 실행하면서 suspicious rate를 낮춤

즉, 단순히 “몇 개 케이스를 하드코딩으로 추가”한 것이 아니라,
`대량 질의 -> 감사 -> 취약점 파악 -> 로직 수정 -> 재감사`
사이클을 한 번 돌린 작업입니다.

---

## 2. 사용한 서브에이전트

이번 작업에서는 기존에 열려 있던 서브에이전트 중 아래 둘을 활용했습니다.

- `coach_refactor_design`
  - 현재 코드 기준으로 어디를 고쳐야 가장 효과가 큰지 분석
  - 특히 `socialize`, `state_change`, `hybrid` 오분류 원인 정리

- `coach_refactor_test_matrix`
  - 어떤 질의 family를 대량 생성해야 하는지 제안
  - 감사 버킷 구성이 현실적인지 점검

서브에이전트 결과를 바탕으로 메인 에이전트가 실제 코드 수정과 테스트 재실행을 진행했습니다.

---

## 3. 1000건 감사 하네스

이번에 추가/활용한 핵심 테스트는 아래 파일입니다.

- [CoachBatchAuditTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachBatchAuditTest.java)

이 테스트는 단순 unit test가 아니라,
`질의 생성 + 코치 응답 실행 + suspicious 판단 + 리포트 저장`
까지 한 번에 수행합니다.

### 버킷 구성

1000건은 아래 버킷으로 나눠 생성했습니다.

- `learn_lookup`
- `socialize_lookup`
- `sleep_lookup`
- `state_change_lookup`
- `visit_interest_lookup`
- `reason_support`
- `example_support`
- `opinion_support`
- `compare_support`
- `structure_support`
- `balance_support`
- `hybrid_ambiguous`

### 생성 데이터 특징

- 정상 문장과 비문/띄어쓰기 변형을 함께 섞음
- `말 하고싶어`, `하고 싶어`, `어케 말해`, `표현 알려줘`, `뭐가 자연스러워` 같은 변형 포함
- lookup 계열과 support 계열이 비슷한 표면을 가지는 질문도 섞음

예:

- `친구를 만난다는 표현 뭐가 자연스러워?`
- `스페인어를 배우고 싶다를 어떻게 표현해?`
- `온라인 만남이 전보다 자연스럽다 영어로 뭐라해`
- `잔다고 말하고 싶은데 구조도 같이 알려줘`

### 결과 저장 위치

감사 결과는 아래 경로에 저장됩니다.

- [summary.md](C:/WriteLoop/apps/backend/build/reports/coach-batch-audit/summary.md)
- [results.json](C:/WriteLoop/apps/backend/build/reports/coach-batch-audit/results.json)

---

## 4. 가장 먼저 드러난 문제

초기 감사에서는 다음 문제가 크게 드러났습니다.

1. `meaning lookup`이어야 할 질문이 `writing support`로 새는 문제
2. `state_change`가 `socialize`나 `rest`로 잘못 잡히는 문제
3. `prompt fallback intent`가 사용자 질문 해석을 오염시키는 문제
4. `표현 알려줘`, `자연스러워?` 류 질문이 너무 generic하게 처리되는 문제
5. `hybrid` 질문에서 `구조`, `예시` 같은 support 단서가 lookup을 죽이는 문제

대표적인 실패 예:

- `친구를 만난다는 표현 뭐가 자연스러워?`
- `온라인 만남이 전보다 자연스럽다를 어떻게 말해?`
- `잔다고 말하고 싶은데 구조도 같이 알려줘`

---

## 5. 이번 라운드에서 고친 핵심 로직

핵심 수정 파일:

- [CoachQueryAnalyzer.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java)
- [CoachService.java](C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java)
- [CoachQueryAnalyzerTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachQueryAnalyzerTest.java)
- [CoachServiceTest.java](C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java)

### 5.1 user intent와 prompt fallback intent 분리

이전에는 `detectLookup()`가 사용자 질문 intent가 아니라
`prompt fallback intent`까지 함께 보고 있었습니다.

그래서 사용자가 뜻 조회를 했는데도,
현재 프롬프트가 `이유/예시` 성격이면 support로 오분류될 수 있었습니다.

이번 수정 후에는:

- lookup 판정은 우선 `userQuestion`에서 직접 추론한 intent만 사용
- prompt fallback intent는 support 표현 생성 쪽에서만 사용

이 수정이 `socialize_lookup` 대량 실패를 크게 줄였습니다.

### 5.2 lookup cue 강화

`hasLookupSayCue(...)`를 강화해서 아래 변형을 더 잘 잡도록 했습니다.

- `말 하고싶어`
- `라고 하고 싶어`
- `다고 하고 싶어`
- `어떻게 표현해`
- `어떻게 말해`

즉 `말하고 싶어` 한 형태만 보는 것이 아니라,
띄어쓰기/활용형이 달라도 `MEANING_LOOKUP`으로 더 안정적으로 잡습니다.

### 5.3 meaning expression cue와 support meta cue 분리

`표현`, `단어`가 들어간다고 무조건 lookup으로 보내면 support 질문이 많이 오분류됩니다.

그래서 이번에:

- `hasMeaningExpressionCue(...)`
- `hasSupportMetaCue(...)`

를 분리했습니다.

예:

- `친구를 만난다는 표현 뭐가 자연스러워?`
  - lookup
- `습관 말할 때 표현 알려줘`
  - support
- `의견 표현 알려줘`
  - support

### 5.4 family 우선순위 조정

`STATE_CHANGE`와 `SOCIALIZE`가 겹치는 질문에서,
예전에는 `SOCIALIZE`가 먼저 잡히는 경우가 있었습니다.

이번에는 family 분류 순서를 조정해서:

- `LEARN`
- `SLEEP`
- `STUDY`
- `REST`
- `STATE_CHANGE`
- `SOCIALIZE`

순으로 보도록 바꿨습니다.

그 결과:

- `온라인에서 사람 만나는 게 쉬워졌다`
- `인터넷에서의 만남이 자연스러워졌다`

같은 문장이 `STATE_CHANGE`로 더 잘 들어갑니다.

### 5.5 state-change qualifier 강화

`STATE_CHANGE` 쪽에 아래 표현을 더 잘 잡도록 보강했습니다.

- `자연스럽다`
- `자연스러워졌다`
- `익숙해졌다`
- `쉬워졌다`
- `덜 어색하다`
- `부담없다`

특히 `쉬워졌다`는 예전엔 `REST`와 충돌할 여지가 있었는데,
이제 `online + relationship + qualifier` 문맥이면 `STATE_CHANGE`로 더 잘 갑니다.

### 5.6 socialize family 확장

`SOCIALIZE`는 단순히 `친구를 만나다`만 보지 않도록 넓혔습니다.

포함 예:

- `친구들이랑 논다`
- `시간을 보낸다`
- `연락한다`
- `대화한다`
- `친해진다`

### 5.7 learn family 확장

`LEARN`은 아래 활용형을 더 잘 받도록 했습니다.

- `배워야`
- `배우려고`
- `익히고`
- `익혀야`

### 5.8 sleep family 확장

`SLEEP`은 아래 변형도 더 잘 받도록 했습니다.

- `자러 가다`
- `침대에 바로 가다`
- `잠들다`

### 5.9 hybrid query 개선

예전에는 `구조도 같이`, `예시도 같이` 같은 보조 요청이 들어가면
강한 lookup cue가 있어도 support로 넘어가는 경우가 있었습니다.

이번 라운드에서는:

- 강한 lookup cue가 먼저 보이면 lookup을 우선 살리고
- support cue는 보조 정보로 남기는 방향으로 조정했습니다

다만 이 부분은 아직 완전히 끝난 상태는 아니고,
현재 남은 suspicious case의 상당수가 hybrid 버킷에 몰려 있습니다.

---

## 6. 테스트 추가

아래 종류의 테스트를 추가/보강했습니다.

### `CoachQueryAnalyzerTest`

추가된 회귀 테스트 예:

- `말 하고싶어` spacing variant
- `친구들이랑 논다고 말하고 싶어`
- `영어를 배우고 싶다를 어떻게 표현해?`
- `습관 말할 때 표현 알려줘`는 support여야 함
- `의견 표현 알려줘`는 support여야 함
- `샘플 넣을 때 표현 있어?`는 support여야 함
- `온라인에서 사람 만나는 게 쉬워졌다`는 state-change여야 함
- `잔다고 말하고 싶은데 구조도 같이 알려줘`는 lookup 유지

### `CoachServiceTest`

기존 support/lookup 기대값과 충돌하지 않는지 다시 확인했습니다.

---

## 7. 감사 결과 개선 수치

이번 라운드에서 suspicious rate는 아래처럼 내려갔습니다.

1. 초기: `26.4%`
2. 1차 수정 후: `13.4%`
3. 2차 수정 후: `7.9%`
4. 3차 수정 후: `5.4%`
5. 최종: `4.5%`

최종 결과 기준:

- `learn_lookup`: `0.0%`
- `socialize_lookup`: `0.0%`
- `sleep_lookup`: `0.0%`
- `state_change_lookup`: `0.0%`
- `visit_interest_lookup`: `0.0%`
- `reason_support`: `0.0%`
- `example_support`: `0.0%`
- `opinion_support`: `0.0%`
- `compare_support`: `0.0%`
- `structure_support`: `10.0%`
- `balance_support`: `20.0%`
- `hybrid_ambiguous`: `30.0%`

즉 현재 남은 이슈는 대부분
`완전히 틀린 분류`보다는
`혼합 질의 정책`과 `균형/구조 support wording` 쪽입니다.

---

## 8. 지금 남아 있는 이슈

### 8.1 hybrid ambiguity

예:

- `잔다고 말하고 싶은데 구조도 같이 알려줘`
- `온라인 만남 자연스러워졌단거 말하고 구조도 알려줘`

이런 질문은 lookup도 맞고 support도 맞습니다.

현재 엔진은:

- 일부는 lookup 우선
- 일부는 structure support 우선

으로 갈리고 있습니다.

이건 버그라기보다 `정책을 어떻게 정할지`가 아직 덜 정리된 상태에 가깝습니다.

### 8.2 balance support

예:

- `균형 있게 말할 때 쓰는 표현 알려줘`
- `균형답변 표현 있어?`

이 계열은 아직 일부가 lookup으로 잘못 보이거나,
support로는 가더라도 기대 표현(`On the one hand`, `Overall`)이 아닌
opinion 계열이 먼저 나오는 경우가 있습니다.

### 8.3 structure support

예:

- `무엇부터 쓰면 좋을지 가이드 줘`

이건 mode는 맞지만 표현 inventory가 기대와 조금 어긋납니다.
즉 분기 버그보다 `support 표현 세트 구성` 문제에 더 가깝습니다.

---

## 9. 이번 라운드에서 하지 않은 것

이번 라운드에서는 아래는 하지 않았습니다.

- DB 스키마 변경
- 새 테이블 추가
- 프론트 UI 변경
- OpenAI prompt 자체의 대규모 재설계

즉 이번 작업은 거의 전부
`백엔드 analyzer / service / test 강화`
에 집중했습니다.

---

## 10. 실행한 주요 명령

### 회귀 테스트

```powershell
cmd /c gradlew.bat test --tests com.writeloop.service.CoachQueryAnalyzerTest --tests com.writeloop.service.CoachServiceTest
```

### 1000건 감사 테스트

```powershell
cmd /c gradlew.bat test --tests com.writeloop.service.CoachBatchAuditTest
```

---

## 11. 다음 라운드 추천 작업

다음으로 가장 가치가 큰 작업은 아래 순서입니다.

1. `hybrid_ambiguous` 정책 정리
   - lookup 우선 + support 1~2개 보조로 붙일지 결정

2. `balance_support` inventory 개선
   - `On the one hand`, `On the other hand`, `Overall` 조합 강화

3. `structure_support` inventory 개선
   - `First`, `To start with`, `My main point is ...` 계열 우선화

4. 감사 리포트를 기준으로
   - `실제 버그`
   - `정책적으로 허용 가능한 응답`
   를 분리하는 후속 문서화

---

## 12. 한 줄 요약

이번 라운드는

> “1000건 대량 질의 감사로 AI 코치 백엔드의 분기/의미 추출 약점을 찾고, `CoachQueryAnalyzer`를 중심으로 `meaning lookup` 정확도를 크게 끌어올린 작업”

입니다.

결과적으로,
`learn/socialize/sleep/state-change/visit-interest` 계열은 거의 안정권으로 들어왔고,
지금 남은 과제는 `hybrid`, `balance`, `structure`처럼 정책 경계가 있는 support 영역입니다.
