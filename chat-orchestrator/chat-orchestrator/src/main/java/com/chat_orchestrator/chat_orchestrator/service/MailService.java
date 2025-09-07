package com.chat_orchestrator.chat_orchestrator.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class MailService {
    public void sendPasswordReset(String to, String link) {
        log.info("[MAIL] Password reset to {} -> {}", to, link);
    }
}
