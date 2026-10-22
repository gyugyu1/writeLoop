# 결정 기록 (ADR)

WriteLoop의 중요한 결정과 그 이유를 [MADR 4.0](https://adr.github.io/madr/) 형식으로 남긴다.

## 작성 규칙

- 결정 하나당 파일 하나를 만든다. 이름은 `NNNN-짧은-영어-제목.md`다.
- [`adr-template.md`](adr-template.md)를 복사해 다음 번호로 만든다.
- 채택한 ADR은 내용을 고치지 않는다. 결정이 바뀌면 새 ADR을 쓰고, 예전 ADR의 `status`만 `superseded by ADR-NNNN`으로 바꾼다.
- 섹션 제목은 MADR 원문을 따르고, 본문은 한국어로 쓴다.

## 목록

| 번호 | 결정 | 상태 | 날짜 |
|---|---|---|---|
| [0000](0000-use-markdown-architectural-decision-records.md) | 결정 기록은 MADR 형식의 ADR로 남긴다 | accepted | 2026-10-22 |
| [0001](0001-llm-diagnoses-backend-decides-mission.md) | 문장 피드백에서 LLM은 진단, 미션은 백엔드가 결정 | accepted | 2026-07-28 |
| [0002](0002-jpa-ddl-auto-validate.md) | 모든 환경에서 ddl-auto validate, 스키마는 SQL 마이그레이션으로만 | accepted | 2026-10-20 |
| [0003](0003-purge-user-data-on-account-deletion.md) | 회원 탈퇴 시 사용자 데이터를 명시적으로 모두 삭제 | accepted | 2026-10-20 |
| [0004](0004-apple-login-signed-email-only.md) | Apple 로그인은 서명된 인증 이메일만 사용 | accepted | 2026-10-20 |
| [0005](0005-openai-gpt-6-luna-models.md) | OpenAI 모델을 gpt-6-luna로 통일 | accepted | 2026-10-21 |
| [0006](0006-ordered-maps-for-llm-requests.md) | LLM 요청은 순서를 보장하는 맵으로만 생성 | accepted | 2026-10-21 |
| [0007](0007-feedback-schema-generation-order.md) | 문장 피드백 스키마는 진단 → 학습 자료 순서 | accepted | 2026-10-21 |
| [0008](0008-feedback-attempt-timeout-and-retry.md) | 피드백 호출 40초 + 시간 초과 1회 재시도 | accepted | 2026-10-22 |
| [0009](0009-atomic-recommendation-exposure-insert.md) | 추천 노출 기록은 원자적 INSERT + 사용자별 이름 잠금 | accepted | 2026-10-22 |
| [0010](0010-slot-verdict-and-single-mission-support.md) | 슬롯 판정 필드 + 미션 슬롯 하나에만 지원 내용 생성 | accepted | 2026-10-22 |
| [0011](0011-keep-optional-slots-and-enrichment-suggestion.md) | 선택 슬롯 유지 + 완성 답변 "더 풍부하게 써 보기" 제안 | accepted | 2026-10-22 |
| [0012](0012-allow-production-access-in-any-permission-mode.md) | 운영 서버·DB 접근을 권한 모드와 관계없이 허용 | accepted | 2026-10-22 |
| [0013](0013-adopt-flyway-with-production-baseline.md) | DB 마이그레이션을 Flyway로 관리, 운영 덤프를 기준선(V107)으로 | accepted | 2026-10-22 |
