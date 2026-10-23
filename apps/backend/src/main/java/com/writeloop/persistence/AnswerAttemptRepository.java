package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnswerAttemptRepository extends JpaRepository<AnswerAttemptEntity, Long> {

    int countBySessionId(String sessionId);

    Optional<AnswerAttemptEntity> findBySessionIdAndAttemptNo(String sessionId, Integer attemptNo);

    Optional<AnswerAttemptEntity> findBySessionIdAndSubmissionId(String sessionId, String submissionId);

    // 첫 답변의 재시도 확인. 첫 제출은 세션 id가 없어서 소유자 + 질문 + 제출 id로 찾는다.
    @Query("""
            select a
            from AnswerSessionEntity s, AnswerAttemptEntity a
            where s.userId = :userId and s.promptId = :promptId
              and a.sessionId = s.id and a.submissionId = :submissionId
            """)
    List<AnswerAttemptEntity> findUserSubmissions(
            @Param("userId") Long userId,
            @Param("promptId") String promptId,
            @Param("submissionId") String submissionId
    );

    @Query("""
            select a
            from AnswerSessionEntity s, AnswerAttemptEntity a
            where s.userId is null and s.guestId = :guestId and s.promptId = :promptId
              and a.sessionId = s.id and a.submissionId = :submissionId
            """)
    List<AnswerAttemptEntity> findGuestSubmissions(
            @Param("guestId") String guestId,
            @Param("promptId") String promptId,
            @Param("submissionId") String submissionId
    );

    Optional<AnswerAttemptEntity> findFirstBySessionIdOrderByAttemptNoDesc(String sessionId);

    List<AnswerAttemptEntity> findBySessionIdOrderByAttemptNoAsc(String sessionId);

    List<AnswerAttemptEntity> findBySessionIdInOrderByCreatedAtAsc(List<String> sessionIds);

    @Query("""
            select count(a)
            from AnswerAttemptEntity a
            where exists (
                select 1
                from AnswerSessionEntity s
                where s.id = a.sessionId and s.userId = :userId
            )
            """)
    long countByUserId(@Param("userId") Long userId);

    @Query("""
            select count(distinct a.sessionId)
            from AnswerAttemptEntity a
            where exists (
                select 1
                from AnswerSessionEntity s
                where s.id = a.sessionId and s.userId = :userId
            )
            """)
    long countDistinctSessionsByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("""
            delete from AnswerAttemptEntity a
            where a.sessionId in (
                select s.id
                from AnswerSessionEntity s
                where s.userId = :userId
            )
            """)
    int purgeByUserId(@Param("userId") Long userId);
}
