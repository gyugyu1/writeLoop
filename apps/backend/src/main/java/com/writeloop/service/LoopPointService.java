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
    private final TransactionTemplate readTransaction;
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
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
        this.clock = clockProvider.getIfAvailable(() -> Clock.system(SEOUL));
    }

    /** 잔액과 오늘 활동별 적립 횟수. 처음 부르면 시작 선물을 준다. */
    public LoopPointsSummaryDto getSummary(Long userId) {
        ensureAccount(userId);
        return readTransaction.execute(status -> {
            LoopPointBalanceEntity balance = balanceRepository.findById(userId)
                    .orElseThrow(() -> new IllegalStateException("룹 잔액을 찾지 못했어요."));
            LocalDate today = today();
            return new LoopPointsSummaryDto(
                    balance.getBalance(),
                    new LoopPointsSummaryDto.Today(
                            todayOf(userId, Activity.QUESTION, today),
                            todayOf(userId, Activity.DIARY, today),
                            todayOf(userId, Activity.NOW_IN_ENGLISH, today)
                    )
            );
        });
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
            ensureAccount(userId);
            return separateTransaction.execute(status -> earn(userId, activity, sourceId));
        } catch (RuntimeException exception) {
            log.warn("Loop points for {} {} of user {} were not recorded", activity, sourceId, userId, exception);
            return null;
        }
    }

    private LoopPointsRewardDto earn(Long userId, Activity activity, String sourceId) {
        // 트랜잭션의 첫 문장으로 잔액 행을 잠근다. 그 뒤의 읽기(이미 적립했는지, 오늘 횟수)는 잠금을 얻은 뒤의 최신 값이다
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

    /**
     * 잔액 행이 없으면 시작 선물을 넣어 만들고 그 기록을 남긴다(계정마다 한 번).
     * 잠그는 트랜잭션과 따로, 짧은 트랜잭션에서 만든다. 같은 트랜잭션에서 INSERT IGNORE(겹치면 공유 잠금) 뒤에
     * 배타 잠금으로 올리면 같은 계정의 요청 둘이 서로를 기다려 교착이 나기 때문이다. 처음 요청이 동시에 와도
     * 한 요청만 만들고, 다른 요청의 INSERT IGNORE는 그 커밋을 기다렸다가 아무것도 하지 않는다.
     */
    public void ensureAccount(Long userId) {
        // 있는지 보는 읽기도 따로 한다. 바깥 트랜잭션(예: 질문 완료)에 붙어 실패하면 바깥까지 되돌려지기 때문이다
        separateTransaction.executeWithoutResult(status -> {
            if (balanceRepository.existsById(userId)) {
                return;
            }
            Instant now = clock.instant();
            if (balanceRepository.insertIfAbsent(userId, START_GIFT, now) == 1) {
                entryRepository.save(new LoopPointEntryEntity(userId, START_GIFT_REASON, START_GIFT_SOURCE, START_GIFT, today(), now));
            }
        });
    }

    /** 잔액 행을 잠가 읽는다(ensureAccount로 먼저 만들어 둔다). 부르는 트랜잭션의 첫 문장으로 부른다. */
    public LoopPointBalanceEntity lockAccount(Long userId) {
        return balanceRepository.findForUpdate(userId)
                .orElseThrow(() -> new IllegalStateException("룹 잔액을 찾지 못했어요."));
    }

    /**
     * 잠근 잔액에서 룹을 쓴다(홈쇼핑 주문). 장부에 음수 한 줄을 남긴다. 부르는 쪽이 잔액이 넉넉한지 먼저 확인하고,
     * 같은 트랜잭션에서 lockAccount로 잠근 잔액을 넘긴다.
     */
    public void spend(LoopPointBalanceEntity balance, int amount, String reason, String sourceKey) {
        Instant now = clock.instant();
        balance.change(-amount, now);
        balanceRepository.save(balance);
        entryRepository.save(new LoopPointEntryEntity(balance.getUserId(), reason, sourceKey, -amount, today(), now));
    }

    /** 서버의 서울 날짜(홈쇼핑 오늘의 방송 상품도 이 날짜를 쓴다). */
    public LocalDate seoulToday() {
        return today();
    }

    private LoopPointsSummaryDto.Activity todayOf(Long userId, Activity activity, LocalDate today) {
        long count = entryRepository.countByUserIdAndReasonAndRewardDateAndAmountGreaterThan(userId, activity.name(), today, 0);
        return new LoopPointsSummaryDto.Activity(count, activity.dailyLimit(), activity.points());
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(SEOUL));
    }
}
