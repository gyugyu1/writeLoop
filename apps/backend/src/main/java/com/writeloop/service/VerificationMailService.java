package com.writeloop.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class VerificationMailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;
    private final String smtpHost;

    public VerificationMailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@writeloop.local}") String fromAddress,
            @Value("${spring.mail.host:}") String smtpHost
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
        this.smtpHost = smtpHost;
    }

    public void sendVerificationCode(String email, String code) {
        if (smtpHost == null || smtpHost.isBlank()) {
            log.info("Email verification code for {} -> {}", email, code);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("Email verification code for {} -> {}", email, code);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("[writeLoop] 이메일 인증 코드");
            message.setText("""
                    writeLoop 이메일 인증 코드입니다.

                    인증 코드: %s

                    앱 화면에서 위 코드를 입력해 이메일 인증을 완료해 주세요.
                    """.formatted(code));
            mailSender.send(message);
        } catch (Exception exception) {
            log.warn("Failed to send verification email to {}. Fallback code log: {}", email, code, exception);
        }
    }

    public void sendPasswordResetCode(String email, String code) {
        if (smtpHost == null || smtpHost.isBlank()) {
            log.info("Password reset code for {} -> {}", email, code);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("Password reset code for {} -> {}", email, code);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("[writeLoop] 비밀번호 재설정 코드");
            message.setText("""
                    writeLoop 비밀번호 재설정 코드입니다.

                    재설정 코드: %s

                    비밀번호 찾기 화면에서 위 코드를 입력하고 새 비밀번호를 설정해 주세요.
                    """.formatted(code));
            mailSender.send(message);
        } catch (Exception exception) {
            log.warn("Failed to send password reset email to {}. Fallback code log: {}", email, code, exception);
        }
    }
}
