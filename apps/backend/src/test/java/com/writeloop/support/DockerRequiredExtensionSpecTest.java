package com.writeloop.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.opentest4j.TestAbortedException;

/**
 * [spec] 작업 032 시나리오 A10(2)(4): Docker에 닿지 않으면 통합 테스트는 건너뛰지 않고 실패하고,
 * 실패 메시지에 원인과 켜는 방법(`docker desktop start`, `bash scripts/dev/ensure-docker.sh`)이 글자 그대로 들어 있다.
 * Docker 없이 도는 단위 테스트다. 실제로 Docker에 닿지 않는 실행은 4단계에서 따로 돌린다.
 */
class DockerRequiredExtensionSpecTest {

    @Test
    void a10_failsInsteadOfSkippingWithCauseAndHowToStartDocker() {
        DockerRequiredExtension extension = new DockerRequiredExtension(() -> false);

        Throwable thrown = catchThrowable(() -> extension.beforeAll(mock(ExtensionContext.class)));

        assertThat(thrown).as("Docker unreachable must fail the class").isNotNull();
        assertThat(thrown).as("must not be a skip").isNotInstanceOf(TestAbortedException.class);
        assertThat(thrown.getMessage())
                .contains("Docker")
                .contains("docker desktop start")
                .contains("bash scripts/dev/ensure-docker.sh");
    }
}
