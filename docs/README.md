# 문서

| 폴더 | 내용 |
|---|---|
| [`decisions/`](decisions/) | 결정 기록(ADR, MADR 형식). 왜 지금처럼 만들었는지 |
| [`guides/`](guides/) | 구조와 동작을 설명하는 문서. 코드가 바뀌면 함께 고친다 |
| [`reports/`](reports/) | 특정 날짜의 실험·회귀 테스트·점검 결과. 그 시점의 기록이라 고치지 않는다 |
| `private/` | 비공개 작업 목록과 조사 보고서. 별도 비공개 저장소의 clone이며 이 저장소에는 올라가지 않는다(`.claude/CLAUDE.md` 참고) |

## 새 문서를 넣을 때

- 동작 원리나 사용법 설명은 `guides/`에 넣는다. 날짜는 파일 이름에 넣지 않아도 된다.
- 실험, 회귀 테스트, 점검 결과는 `reports/<주제>/`에 넣고 파일 이름 끝에 날짜(`-YYYY-MM-DD`)를 붙인다. 한국어 문서는 `.ko.md`로 끝낸다.
  - 주제 폴더: `feedback`(문장 피드백), `coach`(AI 코치), `diary`(영어일기), `prompts`(질문 데이터 검토), `project`(프로젝트 전체 점검)
- 결정이 담긴 내용은 보고서와 별도로 ADR로 남긴다(`decisions/README.md`).
- 공개 저장소다. 고치지 않은 취약점, 운영 주소, 비밀값은 `private/`에만 적는다.
- 문서와 코드가 다르면 코드가 기준이다. 문서를 고친다.

## guides

| 문서 | 내용 |
|---|---|
| [writeloop-project-onboarding-guide-2026-04-02.ko.md](guides/writeloop-project-onboarding-guide-2026-04-02.ko.md) | 코드 중심의 상세 온보딩 가이드 |
| [writeloop-tech-stack-architecture-for-diagram-2026-04-22.ko.md](guides/writeloop-tech-stack-architecture-for-diagram-2026-04-22.ko.md) | 기술 스택과 배포 구조 |
| [answer-loop-explained.md](guides/answer-loop-explained.md) | 답변 루프 개념 |
| [english-feedback-flow.md](guides/english-feedback-flow.md) | 영어 피드백 처리 흐름 |
| [writeloop-feedback-logic-skill-guide-2026-05-06.ko.md](guides/writeloop-feedback-logic-skill-guide-2026-05-06.ko.md) | 피드백 로직 Skill 상세 설명서 |
| [coach-ai-backend-flow.md](guides/coach-ai-backend-flow.md) | AI 코치 백엔드 흐름 |
| [coach-used-expression-extraction.md](guides/coach-used-expression-extraction.md) | 코치 표현 사용 추출 |
| [backend-security-deployment-checklist-2026-04-15.ko.md](guides/backend-security-deployment-checklist-2026-04-15.ko.md) | 백엔드 보안 배포 체크리스트 |

## reports

### feedback — 문장 피드백

| 문서 | 내용 |
|---|---|
| [writeloop-feedback-contract-retry-150-report-2026-07-24.ko.md](reports/feedback/writeloop-feedback-contract-retry-150-report-2026-07-24.ko.md) | 계약 재호출·medium 추론 적용 후 150건 회귀 |
| [writeloop-feedback-mixed-errors-reasoning-medium-comparison-2026-07-24.ko.md](reports/feedback/writeloop-feedback-mixed-errors-reasoning-medium-comparison-2026-07-24.ko.md) | 복합 오류 100건 추론 수준 low·medium 비교 |
| [writeloop-feedback-mixed-errors-100-report-2026-07-24.ko.md](reports/feedback/writeloop-feedback-mixed-errors-100-report-2026-07-24.ko.md) | 복합 오류 문장 100건 테스트 |
| [writeloop-feedback-grammar-evidence-restoration-150-report-2026-07-23.ko.md](reports/feedback/writeloop-feedback-grammar-evidence-restoration-150-report-2026-07-23.ko.md) | 문법 교정 중 슬롯 증거 복원 후 150건 회귀 |
| [writeloop-feedback-question-context-inheritance-150-report-2026-07-23.ko.md](reports/feedback/writeloop-feedback-question-context-inheritance-150-report-2026-07-23.ko.md) | 질문 맥락 상속 후 150건 회귀 |
| [writeloop-feedback-active-prompt-review-150-report-2026-07-23.ko.md](reports/feedback/writeloop-feedback-active-prompt-review-150-report-2026-07-23.ko.md) | 활성 질문 수동 개편 후 150건 회귀 |
| [writeloop-feedback-bare-verb-fragment-10-report-2026-07-23.ko.md](reports/feedback/writeloop-feedback-bare-verb-fragment-10-report-2026-07-23.ko.md) | 기본형 동사 문장 조각 10건 테스트 |
| [writeloop-feedback-question-specific-slot-contract-210-report-2026-07-19.ko.md](reports/feedback/writeloop-feedback-question-specific-slot-contract-210-report-2026-07-19.ko.md) | 질문별 의미 역할 적용 후 210건 회귀 |
| [writeloop-feedback-priority-fixes-150-report-2026-07-17.ko.md](reports/feedback/writeloop-feedback-priority-fixes-150-report-2026-07-17.ko.md) | 우선순위 개선 후 150건 회귀 |
| [writeloop-feedback-unified-assessments-150-report-2026-07-17.ko.md](reports/feedback/writeloop-feedback-unified-assessments-150-report-2026-07-17.ko.md) | 통합 진단 계약 150건 회귀 |
| [writeloop-feedback-slot-specificity-regression-2026-07-17.ko.md](reports/feedback/writeloop-feedback-slot-specificity-regression-2026-07-17.ko.md) | 슬롯 구체성 강화 회귀 |
| [writeloop-feedback-structure-fix-150-report-2026-07-16.ko.md](reports/feedback/writeloop-feedback-structure-fix-150-report-2026-07-16.ko.md) | `STRUCTURE_FIX` 적용 후 150건 테스트 |
| [writeloop-feedback-canonical-contract-150-report-2026-07-15.ko.md](reports/feedback/writeloop-feedback-canonical-contract-150-report-2026-07-15.ko.md) | canonical 피드백 계약 150건 테스트 |
| [writeloop-feedback-completion-gate-150-v2-oracle-review-2026-07-15.ko.md](reports/feedback/writeloop-feedback-completion-gate-150-v2-oracle-review-2026-07-15.ko.md) | 완료 판정 150건 v2 정답표 검토 |
| [writeloop-feedback-completion-gate-150-comparison-report-2026-07-13.ko.md](reports/feedback/writeloop-feedback-completion-gate-150-comparison-report-2026-07-13.ko.md) | 완료 판정 150건 전후 비교 |
| [writeloop-feedback-completion-gate-150-report-2026-07-13.ko.md](reports/feedback/writeloop-feedback-completion-gate-150-report-2026-07-13.ko.md) | 완료 판정 150건 회귀 |
| [writeloop-feedback-slot-unification-100-report-2026-07-13.ko.md](reports/feedback/writeloop-feedback-slot-unification-100-report-2026-07-13.ko.md) | 통합 슬롯 피드백 100건 품질 |
| [writeloop-feedback-luna-optimized-prompt-ab-report-2026-07-12.ko.md](reports/feedback/writeloop-feedback-luna-optimized-prompt-ab-report-2026-07-12.ko.md) | Luna 최적화 프롬프트·모델 A/B |
| [writeloop-feedback-model-luna-ab-report-2026-07-12.ko.md](reports/feedback/writeloop-feedback-model-luna-ab-report-2026-07-12.ko.md) | GPT-5.6 Luna 전환 A/B(초기 기준선) |
| [writeloop-feedback-prompt-improvement-report-2026-07-12.ko.md](reports/feedback/writeloop-feedback-prompt-improvement-report-2026-07-12.ko.md) | 프롬프트 개선 전후 테스트(초기 단계) |
| [writeloop-feedback-prompt-parallel-2026-06-09.ko.md](reports/feedback/writeloop-feedback-prompt-parallel-2026-06-09.ko.md) | 피드백 프롬프트 병렬 정리 |
| [writeloop-feedback-logic-report-2026-04-24.ko.md](reports/feedback/writeloop-feedback-logic-report-2026-04-24.ko.md) | 질문 답변 피드백 로직(2026-04 시점) |
| [feedback-answer-profile-section-policy-2026-03-31.ko.md](reports/feedback/feedback-answer-profile-section-policy-2026-03-31.ko.md) | 피드백 파이프라인 개선 정리 |
| [feedback-grammar-blocking-followup-2026-03-31.ko.md](reports/feedback/feedback-grammar-blocking-followup-2026-03-31.ko.md) | `GRAMMAR_BLOCKING` 후속 보강 |
| [refinement-example-fallback-issue-2026-03-31.ko.md](reports/feedback/refinement-example-fallback-issue-2026-03-31.ko.md) | 다듬기 예문·의미 대체 이슈 |
| [refinement-root-cause-fix-2026-03-31.ko.md](reports/feedback/refinement-root-cause-fix-2026-03-31.ko.md) | 다듬기 근본 원인 수정 |
| [feedback-grammar-source-of-truth-2026-03-30.ko.md](reports/feedback/feedback-grammar-source-of-truth-2026-03-30.ko.md) | 문법 파이프라인 정리 |

### coach — AI 코치

| 문서 | 내용 |
|---|---|
| [coach-refinement-benchmark-round-2026-03-30.ko.md](reports/coach/coach-refinement-benchmark-round-2026-03-30.ko.md) | 코치 다듬기 벤치마크(영문판: [.md](reports/coach/coach-refinement-benchmark-round-2026-03-30.md)) |
| [coach-1000-query-audit-round-2026-03-27.md](reports/coach/coach-1000-query-audit-round-2026-03-27.md) | 코치 질의 1000건 감사 |
| [coach-idea-support-hybrid-hardening-2026-03-27.md](reports/coach/coach-idea-support-hybrid-hardening-2026-03-27.md) | `IDEA_SUPPORT`·혼합 질의 보강 |

### diary — 영어일기

| 문서 | 내용 |
|---|---|
| [diary-feedback-schema-order-live-check-2026-10-23.ko.md](reports/diary/diary-feedback-schema-order-live-check-2026-10-23.ko.md) | 생성 순서 변경 후 실제 LLM 확인(교정 포인트 문장별 분리, kind 고정) |
| [diary-feedback-logic-report-2026-04-23.ko.md](reports/diary/diary-feedback-logic-report-2026-04-23.ko.md) | 영어일기 피드백 로직(2026-04 시점) |

### prompts — 질문 데이터 검토

| 문서 | 내용 |
|---|---|
| [writeloop-active-prompt-manual-review-2026-07-23.ko.md](reports/prompts/writeloop-active-prompt-manual-review-2026-07-23.ko.md) | 활성 질문 전수 수동 검토 |
| [writeloop-minimum-depth-review-2026-07-17.ko.md](reports/prompts/writeloop-minimum-depth-review-2026-07-17.ko.md) | `minimumDepthSlots=2` 문항 재검토 |
| [writeloop-prompt-metadata-manual-review-2026-07-13.ko.md](reports/prompts/writeloop-prompt-metadata-manual-review-2026-07-13.ko.md) | 질문 메타데이터 전수 수동 검토 |

### project — 프로젝트 전체 점검

| 문서 | 내용 |
|---|---|
| [writeloop-project-review-2026-09-05.ko.md](reports/project/writeloop-project-review-2026-09-05.ko.md) | 코드·성능·보안 점검(2026-09). 여기 적힌 문제 중 일부는 이후 고쳤다 |
