package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.ResetPasswordRequest;
import com.chat_orchestrator.chat_orchestrator.entity.PasswordResetToken;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.PasswordResetTokenRepository;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final MailService mail;

    // anti-spam (optionnel)
    private static final Duration THROTTLE = Duration.ofSeconds(30);
    private final ConcurrentHashMap<String, Instant> lastRequest = new ConcurrentHashMap<>();

    /**
     * @param devShortcut si true => on renvoie l'URL au front (mode local, sans email)
     * @return reset URL si devShortcut, sinon null
     */
    @Transactional
    public String start(String email, String appBaseUrl, boolean devShortcut) {
        final Instant now = Instant.now();
        final String key = email.toLowerCase();
        final Instant last = lastRequest.getOrDefault(key, Instant.EPOCH);
        if (Duration.between(last, now).compareTo(THROTTLE) < 0) {
            // trop de demandes rapprochées — on reste silencieux
            return devShortcut ? null : null;
        }
        lastRequest.put(key, now);

        final String[] linkHolder = { null };

        users.findByEmail(email).ifPresent(user -> {
            // 1) invalider toute demande active précédente
            tokens.deleteActiveForUser(user);

            // 2) créer un nouveau token
            String token = generateToken();
            PasswordResetToken prt = PasswordResetToken.builder()
                    .token(token)
                    .user(user)
                    .createdAt(Instant.now())
                    .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                    .build();
            tokens.save(prt);

            String link = appBaseUrl + "/reset-password?token=" + token;
            linkHolder[0] = link;

            // 3) email (prod) ou retour d'URL (dev)
            if (!devShortcut) {
                mail.sendPasswordReset(email, link);
            }
        });

        return devShortcut ? linkHolder[0] : null;
    }

    public boolean isValid(String token) {
        return tokens.findByToken(token)
                .filter(t -> !t.isExpired() && !t.isUsed())
                .isPresent();
    }

    @Transactional
    public void reset(ResetPasswordRequest req) {
        PasswordResetToken t = tokens.findByToken(req.token())
                .orElseThrow(() -> new IllegalArgumentException("invalid token"));
        if (t.isExpired() || t.isUsed()) throw new IllegalArgumentException("invalid token");

        User u = t.getUser();
        u.setPassword(encoder.encode(req.password()));
        users.save(u);

        t.setUsedAt(Instant.now());
        tokens.save(t);
    }

    private String generateToken() {
        byte[] buf = new byte[32];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
