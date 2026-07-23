# WriteLoop 질문 메타데이터 전수 수동 검토 보고서

- 검토일: 2026-07-13
- 대상: `prompts` 테이블의 질문 1,446개 전체
- 목적: 정규식·ID 접두사 중심 분류를 질문별 명시적 학습 계약으로 교체

## 결론

기존 메타데이터는 질문 문구의 특정 단어나 ID 계열을 기준으로 답변 유형과 슬롯을 일괄 추론했기 때문에, 실제로 학습자가 써야 하는 내용과 어긋나는 사례가 있었다. 이번 작업에서는 1,446개 질문을 한 건씩 읽어 `answerMode`, 필수 슬롯, 보강 슬롯, `minimumDepthSlots`를 다시 판정했다. 별도 감사자가 같은 1,446개를 다시 읽어 121건의 문제를 찾아 교정했으며, 최종 결과는 개발 DB에 명시적으로 반영했다.

## 검토 방식

1. 개발 DB의 질문 1,446개를 원문·난이도·활성 상태와 함께 12개 구간으로 나눴다.
2. 각 질문에서 학습자가 실제로 작성해야 하는 응답 구조를 기준으로 답변 유형을 선택했다.
3. 질문이 직접 요구하는 내용만 `REQUIRED`로 두고, 질문에 이미 주어진 전제는 필수 슬롯에서 제외했다.
4. 답변을 한 단계 풍부하게 만드는 관련 정보만 `OPTIONAL`로 두고 우선순위를 정했다.
5. 질문의 범위, 이미 요구한 필수 슬롯 수, 난이도를 함께 고려해 보강 슬롯 최소 개수를 0~2로 정했다.
6. 독립 감사자 6명이 각자 맡은 구간의 모든 질문을 원문과 1차 결과를 대조해 다시 검토했다.

독립 감사 범위 검증 결과는 12개 구간, 1,446개로 정확히 일치했다. 감사에서는 오류 109건과 경계 사례 12건, 총 121건을 보고했으며 모든 권고를 최종 메타데이터에 반영했다.

## 전후 변화

| 항목 | 결과 |
| --- | ---: |
| 전체 질문 | 1,446 |
| 메타데이터가 변경된 질문 | 1,426 |
| 변경되지 않은 질문 | 20 |
| 답변 유형 변경 | 478 |
| 필수 슬롯 변경 | 767 |
| 보강 슬롯 변경 | 1,422 |
| 최소 보강 깊이 변경 | 468 |

최종 답변 유형 분포는 `ROUTINE` 393, `GENERAL_DESCRIPTION` 278, `PREFERENCE` 263, `GOAL_PLAN` 148, `OPINION_REASON` 120, `PROBLEM_SOLUTION` 98, `CHANGE_REFLECTION` 94, `BALANCED_OPINION` 52개다.

### 난이도별 최소 보강 슬롯

| 난이도 | 0개 | 1개 | 2개 |
| --- | ---: | ---: | ---: |
| I | 724 | 126 | 0 |
| A | 91 | 36 | 0 |
| B | 178 | 31 | 0 |
| C | 151 | 88 | 21 |

난이도만으로 일괄 증가시키지는 않았다. 입문 질문이라도 질문 범위가 넓으면 보강 1개를 요구하고, B/C 질문이라도 이미 두세 개의 필수 내용을 직접 요구하면 추가 보강은 0개로 두었다. 반대로 C 난이도에서 필수 답만으로 논지 전개가 부족한 21개 질문은 보강 2개를 요구한다.

## 대표 교정 사례

### 넓은 일상 질문

`How do you usually spend your weekend?`는 `ACTION`을 필수로 하되 `minimumDepthSlots=1`로 유지했다. 따라서 `I usually take a nap.`처럼 활동 하나만 쓴 답변은 질문에는 맞지만 루프 완료 전 시간, 장소, 이유, 추가 활동, 감정, 결과 중 하나를 더 붙이도록 안내한다.

### 질문의 모든 절을 필수로 반영

`When do you need to focus, where do you like to study, and why?`는 처음에 `PLACE`, `REASON`만 잡혀 있었으나, `언제` 역시 학습자가 답해야 하는 직접 질문이다. 최종 필수 슬롯은 `SPECIFIC_TIME`, `PLACE`, `REASON`이다.

### 가정형 행동과 취향 분리

`If you could be invisible, what would you do?`는 선택 취향이 아니라 가정 속 행동을 쓰는 질문이다. `PREFERENCE`가 아닌 `GENERAL_DESCRIPTION`, 필수 슬롯 `ACTION`, 보강 1개로 교정했다.

### 질문에 주어진 전제는 중복 요구하지 않음

`Describe one plan you have for keeping a daily journal this year and explain how you will stay consistent.`에서는 일기 쓰기라는 목표가 질문에 이미 주어져 있다. 학습자에게 `GOAL`을 다시 말하도록 요구하지 않고 `PLAN`만 필수로 두며, B 난이도에 맞게 시간·장애물·결과·이유·장소 중 하나를 보강하도록 했다.

### 좁은 입문 질문은 과도하게 늘리지 않음

`When your battery is low, what do you usually do?`에서는 배터리 부족이 이미 문제 전제다. 학습자는 대응 행동인 `SOLUTION` 하나만 쓰면 되므로 `minimumDepthSlots=0`으로 낮췄다.

## 구현 변경

- 최종 명시 데이터: `infra/mysql/data/prompt-task-metadata-reviewed.json`
- DB 반영 마이그레이션: `infra/mysql/schema/087-apply-manually-reviewed-prompt-task-metadata.sql`
- 1차 검토 원본: `scripts/prompt-metadata-review/reviews/part-01.json`~`part-12.json`
- 독립 감사 원본: `scripts/prompt-metadata-review/audits/audit-01.json`~`audit-06.json`
- 생성·검증 도구: `scripts/prompt-metadata-review/*.mjs`

087은 정규식을 사용하지 않고 1,446개 질문의 결정을 명시적 행으로 기록한다. 답변 유형 변경에 맞춰 예상 시제와 관점도 함께 갱신하며, 기존 슬롯을 모두 비활성화한 뒤 최종 필수·보강 슬롯만 활성화한다.

애플리케이션 시작 시 모든 프로필을 다시 정규식으로 덮어쓰던 동작도 제거했다. 이제 기존 DB 프로필은 보존하고, 메타데이터가 전혀 없는 신규 질문에만 기본 분류를 생성한다.

## 검증 결과

- 독립 감사 커버리지: 1,446/1,446
- 감사 권고 반영: 121/121
- 임시 MySQL에서 087 두 번 실행 후 일치: 프로필 1,446개, 활성 슬롯 8,474개
- 동일 슬롯의 중복 활성 역할: 0건
- 개발 DB 내보내기와 JSON 완전 대조: 1,446개 프로필과 8,474개 슬롯 모두 일치
- 백엔드 전체 테스트: 성공
- 개발 DB 적용 전 백업: `.codex_logs/prompt-metadata-review/backups/dev-before-087-clean-20260713-133234.sql`

운영 DB에는 이번 작업을 적용하지 않았다.
