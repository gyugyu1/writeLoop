package com.writeloop.support;

import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.DockerClientFactory;

/**
 * Docker에 연결할 수 없으면 통합 테스트 클래스를 건너뛰지 않고 실패시킨다.
 *
 * <p>확인하지 못한 것이 통과로 보이지 않게 하려는 것이다. Spring 컨텍스트를 띄우기 전에 실패시켜,
 * 실패 메시지 맨 위에 원인과 켜는 방법이 보이게 한다. 테스트는 Docker를 켜지 않는다.
 */
public class DockerRequiredExtension implements BeforeAllCallback {

    static final String MESSAGE = "Docker에 연결할 수 없어 통합 테스트를 돌릴 수 없습니다. "
            + "Docker를 켠 뒤 다시 실행하세요: `docker desktop start` 또는 `bash scripts/dev/ensure-docker.sh`";

    private final BooleanSupplier dockerAvailable;

    public DockerRequiredExtension() {
        this(() -> DockerClientFactory.instance().isDockerAvailable());
    }

    DockerRequiredExtension(BooleanSupplier dockerAvailable) {
        this.dockerAvailable = dockerAvailable;
    }

    @Override
    public void beforeAll(ExtensionContext context) {
        if (!dockerAvailable.getAsBoolean()) {
            throw new IllegalStateException(MESSAGE);
        }
    }
}
