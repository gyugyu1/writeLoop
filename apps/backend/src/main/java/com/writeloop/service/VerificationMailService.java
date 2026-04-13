package com.writeloop.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class VerificationMailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;
    private final String fromName;
    private final String smtpHost;

    public VerificationMailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@writeloop.local}") String fromAddress,
            @Value("${app.mail.from-name:WriteLoop}") String fromName,
            @Value("${spring.mail.host:}") String smtpHost
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.smtpHost = smtpHost;
    }

    public void sendVerificationCode(String email, String code) {
        sendPlainTextMail(
                email,
                "[writeLoop] 이메일 인증 코드",
                """
                        writeLoop 이메일 인증 코드입니다.

                        인증 코드: %s

                        화면에서 이 코드를 입력해 이메일 인증을 완료해 주세요.
                        """.formatted(code),
                code,
                "verification"
        );
    }

    public void sendPasswordResetCode(String email, String code) {
        sendPlainTextMail(
                email,
                "[writeLoop] 비밀번호 재설정 코드",
                """
                        writeLoop 비밀번호 재설정 코드입니다.

                        재설정 코드: %s

                        비밀번호 찾기 화면에서 이 코드를 입력하고 새 비밀번호를 설정해 주세요.
                        """.formatted(code),
                code,
                "password reset"
        );
    }

    private void sendPlainTextMail(
            String email,
            String subject,
            String text,
            String fallbackCode,
            String mailType
    ) {
        if (smtpHost == null || smtpHost.isBlank()) {
            log.info("Email {} code for {} -> {}", mailType, email, fallbackCode);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("Email {} code for {} -> {}", mailType, email, fallbackCode);
            return;
        }

        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            applyFrom(helper);
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(text, false);
            mailSender.send(message);
        } catch (Exception exception) {
            log.warn("Failed to send {} email to {}. Fallback code log: {}", mailType, email, fallbackCode, exception);
        }
    }

    private void applyFrom(MimeMessageHelper helper) throws Exception {
        if (fromName == null || fromName.isBlank()) {
            helper.setFrom(fromAddress);
            return;
        }

        helper.setFrom(fromAddress, fromName);
    }
}
