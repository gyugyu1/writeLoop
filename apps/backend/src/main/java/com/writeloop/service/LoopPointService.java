package com.writeloop.service;

import com.writeloop.dto.LoopPointsRewardDto;
import com.writeloop.dto.LoopPointsSummaryDto;
import com.writeloop.persistence.LoopPointBalanceEntity;
import com.writeloop.persistence.LoopPointBalanceRepository;
import com.writeloop.persistence.LoopPointEntryEntity;
import com.writeloop.persistence.LoopPointEntryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 룹: 쓰기로 모으고 라룹 홈쇼핑에서 쓰는 포인트.
 * 계정마다 처음 다룰 때 시작 선물을 주고, 세 활동(질문 답하기·영어일기·지금 영어로)을 서울 날짜 기준 하루 한도 안에서 한 번씩 적립한다.
 * 같은 계정의 적립은 잔액 행을 잠가 하나씩 처리하므로, 같은 출처를 두 번 적립하거나 한도를 넘지 않는다.
 */
@Slf4j
@Service
public class LoopPointService {

    public static final int START_GIFT = 200;
    static final String START_GIFT_REASON = "START_GIFT";
    static final String START_GIFT_SOURCE = "start";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 적립하는 활동: 응답에 쓰는 이름, 1번에 쌓이는 룹, 하루 한도. */
    public enum Activity {
        QUESTION("question", 30, 3),
        DIARY("diary", 30, 1),
        NOW_IN_ENGLISH("nowInEnglish", 10, 5);

        private final String key;
        private final int points;
        private final int dailyLimit;

        Activity(String key, int points, int dailyLimit) {
            this.key = key;
            this.points = points;
            this.dailyLimit = dailyLimit;
        }

        public String key() {
            return key;
        }

        public int points() {
            return points;
        }

        public int dailyLimit() {
            return dailyLimit;
        }
    }

    private final LoopPointBalanceRepository balanceRepository;
    private final LoopPointEntryRepository entryRepository;
    private final TransactionTemplate separateTransaction;
    private final Clock clock;

    public LoopPointService(
            LoopPointBalanceRepository balanceRepository,
            LoopPointEntryRepository entryRepository,
            PlatformTransactionManager transactionManager,
            ObjectProvider<Clock> clockProvider
    ) {
        this.balanceRepository = balanceRepository;
        this.entryRepository = entryRepository;
        this.separateTransaction = new TransactionTemplate(transactionManager);
        this.separateTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clockProvider.getIfAvailable(() -> Clock.system(SEOUL));
    }

    /** 잔액과 오늘 활동별 적립 횟수. 처음 부르면 시작 선물을 준다. */
    @Transactional
    public LoopPointsSummaryDto getSummary(Long userId) {
        LoopPointBalanceEntity balance = lockAccount(userId);
        LocalDate today = today();
        return new LoopPointsSummaryDto(
                balance.getBalance(),
                new LoopPointsSummaryDto.Today(
                        todayOf(userId, Activity.QUESTION, today),
                        todayOf(userId, Activity.DIARY, today),
                        todayOf(userId, Activity.NOW_IN_ENGLISH, today)
                )
        );
    }

    /**
     * 활동 하나를 적립한다. 원래 활동과 따로(새 트랜잭션) 처리해, 적립이 실패해도 원래 활동은 그대로 끝난다.
     * 이미 적립한 출처면 null, 실패해도 null이다. 하루 한도에 닿았으면 0룹 결과를 돌려준다.
     */
    public LoopPointsRewardDto earnQuietly(Long userId, Activity activity, String sourceId) {
        if (userId == null || sourceId == null || sourceId.isBlank()) {
            return null;
        }
        try {
            return separateTransaction.execute(status -> earn(userId, activity, sourceId));
        } catch (RuntimeException exception) {
            log.warn("Loop points for {} {} of user {} were not recorded", activity, sourceId, userId, exception);
            return null;
        }
    }

    private LoopPointsRewardDto earn(Long userId, Activity activity, String sourceId) {
        LoopPointBalanceEntity balance = lockAccount(userId);
        String reason = activity.name();
        if (entryRepository.existsByUserIdAndReasonAndSourceKey(userId, reason, sourceId)) {
            return null;
        }
        LocalDate today = today();
        long earnedToday = entryRepository.countByUserIdAndReasonAndRewardDateAndAmountGreaterThan(userId, reason, today, 0);
        boolean limitReached = earnedToday >= activity.dailyLimit();
        int amount = limitReached ? 0 : activity.points();
        Instant now = clock.instant();
        // 한도에 닿아 0룹이어도 남겨, 다음 날 같은 출처를 다시 적립하지 않게 한다
        entryRepository.save(new LoopPointEntryEntity(userId, reason, sourceId, amount, today, now));
        if (amount > 0) {
            balance.change(amount, now);
            balanceRepository.save(balance);
        }
        return new LoopPointsRewardDto(activity.key(), amount, balance.getBalance(), limitReached);
    }

    /** 잔액 행을 잠가 읽는다. 없으면 시작 선물을 넣어 만들고 그 기록을 남긴다(계정마다 한 번). */
    LoopPointBalanceEntity lockAccount(Long userId) {
        Instant now = clock.instant();
        if (balanceRepository.insertIfAbsent(userId, START_GIFT, now) == 1) {
            entryRepository.save(new LoopPointEntryEntity(userId, START_GIFT_REASON, START_GIFT_SOURCE, START_GIFT, today(), now));
        }
        return balanceRepository.findForUpdate(userId)
                .orElseThrow(() -> new IllegalStateException("룹 잔액을 찾지 못했어요."));
    }

    private LoopPointsSummaryDto.Activity todayOf(Long userId, Activity activity, LocalDate today) {
        long count = entryRepository.countByUserIdAndReasonAndRewardDateAndAmountGreaterThan(userId, activity.name(), today, 0);
        return new LoopPointsSummaryDto.Activity(count, activity.dailyLimit(), activity.points());
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(SEOUL));
    }
}
