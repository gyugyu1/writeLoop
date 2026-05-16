UPDATE app_version_settings
SET optional_title_ko = '새 버전이 나왔어요',
    forced_title_ko = '업데이트가 필요해요',
    optional_message_ko = '더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요.',
    forced_message_ko = '현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요.',
    release_notes_ko = '안정성 개선과 사용성 개선이 포함되어 있어요.'
WHERE platform IN ('ios', 'android');
