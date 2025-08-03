package com.chat_orchestrator.chat_orchestrator.controller;


import com.chat_orchestrator.chat_orchestrator.dto.UserSettingsDto;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import com.chat_orchestrator.chat_orchestrator.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    @GetMapping("/me")
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
    }


    @PostMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody UserSettingsDto dto) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean success = userService.updateSettings(dto, email);
        return success ? ResponseEntity.ok().build() : ResponseEntity.badRequest().body("Ancien mot de passe incorrect");
    }
}
