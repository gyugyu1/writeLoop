package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * [spec] 작업 086 ② 홈쇼핑 서버, 시나리오 02-qa-scenarios.md "테스트로 확인할 수 없는 것"의 할인 가격 내림.
 * 지금 가격표는 80%가 늘 정수라 API로는 내림을 볼 수 없어, 할인 가격 계산 함수로 본다(원래 가격의 80%를 1룹 단위로 내림).
 */
class HomeShoppingServiceSpecTest {

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            // 명세의 예
            "300, 240",
            "50, 40",
            "70, 56",
            // 내림이 일어나는 값
            "33, 26",
            "59, 47",
            "99, 79",
            "1, 0"
    })
    void salePriceIsEightyPercentRoundedDown(int price, int salePrice) {
        assertThat(HomeShoppingService.salePriceOf(price)).isEqualTo(salePrice);
    }
}
