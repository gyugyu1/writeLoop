package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AppVersionSettingRepository extends JpaRepository<AppVersionSettingEntity, String> {
}
