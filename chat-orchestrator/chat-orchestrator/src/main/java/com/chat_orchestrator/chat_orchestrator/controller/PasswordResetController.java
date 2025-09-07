package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.*;
import com.chat_orchestrator.chat_orchestrator.service.PasswordResetService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin
public class PasswordResetController {

    private final PasswordResetService reset;

    @Value("${app.front-base-url:http://localhost:4200}")
    private String frontBaseUrl;

    // ⚠️ DEV local : renvoie resetUrl au front (pas d’email)
    @Value("${app.reset.dev-shortcut:true}")
    private boolean devShortcut;

    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<?> forgot(@RequestBody ForgotPasswordRequest req) {
        String resetUrl = reset.start(req.email(), frontBaseUrl, devShortcut);
        if (devShortcut && resetUrl != null) {
            return ResponseEntity.ok(Map.of("message", "ok", "resetUrl", resetUrl));
        }
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    @PostMapping("/verify-reset-token")
    public ResponseEntity<?> verify(@RequestBody VerifyTokenRequest req) {
        boolean valid = reset.isValid(req.token());
        return ResponseEntity.ok(Map.of("valid", valid));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiMsg> resetPw(@RequestBody ResetPasswordRequest req) {
        reset.reset(req);
        return ResponseEntity.ok(new ApiMsg("Password changed"));
    }
}
