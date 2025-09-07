package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.AuthRequest;
import com.chat_orchestrator.chat_orchestrator.dto.AuthResponse;
import com.chat_orchestrator.chat_orchestrator.dto.RegisterRequest;
import com.chat_orchestrator.chat_orchestrator.service.AuthService;
import jakarta.annotation.security.PermitAll;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // ---------- DEV ONLY ----------
    public record ResetDev(String email, String password) {}

    @PostMapping("/reset-password-dev")
    @PermitAll // <-- rendre SEULEMENT cet endpoint public
    public ResponseEntity<Void> resetPasswordDev(@RequestBody ResetDev body) {
        authService.resetPasswordDev(body.email(), body.password());
        return ResponseEntity.noContent().build();
    }
}
