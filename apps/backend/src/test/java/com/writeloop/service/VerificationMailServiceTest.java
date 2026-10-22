package com.writeloop.service;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VerificationMailServiceTest {

    @Test
    void sendVerificationCode_usesConfiguredFromName() throws Exception {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory(Map.of(
                "mailSender", mailSender
        ));

        VerificationMailService service = new VerificationMailService(
                beanFactory.getBeanProvider(JavaMailSender.class),
                "sender@gmail.com",
                "WriteLoop",
                "smtp.gmail.com"
        );

        service.sendVerificationCode("learner@example.com", "123456");

        verify(mailSender).send(mimeMessage);
        assertThat(mimeMessage.getFrom()).hasSize(1);
        assertThat(mimeMessage.getFrom()[0].toString())
                .contains("WriteLoop")
                .contains("sender@gmail.com");
    }

    @Test
    void sendVerificationCode_does_not_invoke_mail_sender_when_smtp_is_missing() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        StaticListableBeanFactory beanFactory = new StaticListableBeanFactory(Map.of(
                "mailSender", mailSender
        ));

        VerificationMailService service = new VerificationMailService(
                beanFactory.getBeanProvider(JavaMailSender.class),
                "sender@gmail.com",
                "WriteLoop",
                ""
        );

        service.sendVerificationCode("learner@example.com", "123456");

        verify(mailSender, never()).send(org.mockito.ArgumentMatchers.any(MimeMessage.class));
    }

    @Test
    void maskEmail_keeps_only_the_first_letter_and_domain_for_logs() {
        assertThat(VerificationMailService.maskEmail("user@example.com")).isEqualTo("u***@example.com");
        assertThat(VerificationMailService.maskEmail(" a@b.kr ")).isEqualTo("a***@b.kr");
    }

    @Test
    void maskEmail_hides_values_that_are_not_emails() {
        assertThat(VerificationMailService.maskEmail("not-an-email")).isEqualTo("***");
        assertThat(VerificationMailService.maskEmail("@example.com")).isEqualTo("***");
        assertThat(VerificationMailService.maskEmail(null)).isEqualTo("(empty)");
    }
}
