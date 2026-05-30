CREATE TABLE app_version_settings (
    platform VARCHAR(16) NOT NULL,
    latest_version VARCHAR(32) NOT NULL,
    minimum_supported_version VARCHAR(32) NOT NULL,
    store_url VARCHAR(512) NULL,
    optional_title_ko VARCHAR(120) NOT NULL,
    forced_title_ko VARCHAR(120) NOT NULL,
    optional_message_ko VARCHAR(512) NOT NULL,
    forced_message_ko VARCHAR(512) NOT NULL,
    release_notes_ko VARCHAR(512) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (platform)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_version_settings (
    platform,
    latest_version,
    minimum_supported_version,
    store_url,
    optional_title_ko,
    forced_title_ko,
    optional_message_ko,
    forced_message_ko,
    release_notes_ko
) VALUES
    (
        'ios',
        '1.0.2',
        '1.0.0',
        'https://apps.apple.com/kr/app/%EB%9D%BC%EC%9D%B4%ED%8A%B8%EB%A3%A8%ED%94%84/id6763569959',
        '새 버전이 나왔어요',
        '업데이트가 필요해요',
        '더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요.',
        '현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요.',
        '안정성 개선과 사용성 개선이 포함되어 있어요.'
    ),
    (
        'android',
        '1.0.2',
        '1.0.0',
        'https://play.google.com/store/apps/details?id=kr.writeloop',
        '새 버전이 나왔어요',
        '업데이트가 필요해요',
        '더 안정적인 학습 경험을 위해 최신 버전으로 업데이트해 주세요.',
        '현재 버전에서는 일부 기능이 원활하지 않을 수 있어요. 업데이트 후 이용해 주세요.',
        '안정성 개선과 사용성 개선이 포함되어 있어요.'
    )
ON DUPLICATE KEY UPDATE
    latest_version = VALUES(latest_version),
    minimum_supported_version = VALUES(minimum_supported_version),
    store_url = VALUES(store_url),
    optional_title_ko = VALUES(optional_title_ko),
    forced_title_ko = VALUES(forced_title_ko),
    optional_message_ko = VALUES(optional_message_ko),
    forced_message_ko = VALUES(forced_message_ko),
    release_notes_ko = VALUES(release_notes_ko);
