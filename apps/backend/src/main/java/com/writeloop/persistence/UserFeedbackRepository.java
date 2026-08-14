package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserFeedbackRepository extends JpaRepository<UserFeedbackEntity, Long> {
}
