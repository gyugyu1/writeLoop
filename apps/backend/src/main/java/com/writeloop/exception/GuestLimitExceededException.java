package com.writeloop.exception;

public class GuestLimitExceededException extends RuntimeException {

    public GuestLimitExceededException() {
        super("게스트는 가이드형 질문 루프를 한 번만 이용할 수 있어요. 계속하려면 로그인해 주세요.");
    }
}
