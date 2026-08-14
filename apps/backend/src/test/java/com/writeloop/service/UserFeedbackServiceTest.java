package com.writeloop.service;

import com.writeloop.dto.UserFeedbackRequestDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.UserFeedbackEntity;
import com.writeloop.persistence.UserFeedbackRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserFeedbackServiceTest {

    @Test
    void storesNormalizedFeedbackWithoutLearnerWritingContext() {
        UserFeedbackRepository repository = mock(UserFeedbackRepository.class);
        when(repository.save(any(UserFeedbackEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        UserFeedbackService service = new UserFeedbackService(repository);

        var response = service.submit(42L, new UserFeedbackRequestDto(
                " bug ",
                "  버튼을 누르면 화면이 멈춰요.  ",
                " learner@example.com ",
                " practice_write ",
                " 1.0.5 ",
                " Android ",
                " 35 ",
                " Pixel 9 ",
                " PRACTICE_SCREEN_ERROR "
        ));

        ArgumentCaptor<UserFeedbackEntity> captor = ArgumentCaptor.forClass(UserFeedbackEntity.class);
        verify(repository).save(captor.capture());
        UserFeedbackEntity saved = captor.getValue();
        assertThat(response.accepted()).isTrue();
        assertThat(saved.getUserId()).isEqualTo(42L);
        assertThat(saved.getCategory()).isEqualTo("BUG");
        assertThat(saved.getMessage()).isEqualTo("버튼을 누르면 화면이 멈춰요.");
        assertThat(saved.getContactEmail()).isEqualTo("learner@example.com");
        assertThat(saved.getSourceScreen()).isEqualTo("practice_write");
        assertThat(saved.getPlatform()).isEqualTo("android");
        assertThat(saved.getErrorCode()).isEqualTo("PRACTICE_SCREEN_ERROR");
        assertThat(saved.getStatus()).isEqualTo("NEW");
    }

    @Test
    void rejectsShortMessageAndInvalidContactEmail() {
        UserFeedbackService service = new UserFeedbackService(mock(UserFeedbackRepository.class));

        assertThatThrownBy(() -> service.submit(null, new UserFeedbackRequestDto(
                "IDEA", "짧음", null, null, null, null, null, null, null
        )))
                .isInstanceOf(ApiException.class)
                .hasMessage("의견을 5자 이상 입력해 주세요.");

        assertThatThrownBy(() -> service.submit(null, new UserFeedbackRequestDto(
                "OTHER", "충분히 긴 의견입니다.", "wrong-email", null, null, null, null, null, null
        )))
                .isInstanceOf(ApiException.class)
                .hasMessage("답변받을 이메일 주소를 확인해 주세요.");
    }
}
