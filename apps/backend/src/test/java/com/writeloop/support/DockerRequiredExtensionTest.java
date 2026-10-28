package com.writeloop.support;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DockerRequiredExtensionTest {

    @Test
    void failsWithTheCauseAndHowToStartDockerWhenDockerIsUnavailable() {
        DockerRequiredExtension extension = new DockerRequiredExtension(() -> false);

        assertThatThrownBy(() -> extension.beforeAll(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Docker에 연결할 수 없어")
                .hasMessageContaining("docker desktop start")
                .hasMessageContaining("bash scripts/dev/ensure-docker.sh");
    }

    @Test
    void passesWhenDockerIsAvailable() {
        DockerRequiredExtension extension = new DockerRequiredExtension(() -> true);

        assertThatCode(() -> extension.beforeAll(null)).doesNotThrowAnyException();
    }
}
