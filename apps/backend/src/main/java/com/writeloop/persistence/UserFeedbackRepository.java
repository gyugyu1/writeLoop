package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserFeedbackRepository extends JpaRepository<UserFeedbackEntity, Long> {

    @Modifying
    @Query("delete from UserFeedbackEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);
}
