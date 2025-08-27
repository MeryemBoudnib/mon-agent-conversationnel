// CHEMIN : src/main/java/com/chat_orchestrator/chat_orchestrator/controller/HistoryController.java
package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import com.chat_orchestrator.chat_orchestrator.service.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class HistoryController {

    private final ConversationService conversationService;
    private final UserRepository userRepository;

    @GetMapping
    public List<Conversation> getAll(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return List.of();
        }
        String email = auth.getName();
        User owner = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
        return conversationService.getAllConversationsFor(owner);
    }

    @GetMapping("/{id}")
    public Conversation getOne(@PathVariable Long id) {
        // Si tu veux aussi vérifier l’appartenance ici, on peut le faire via un service dédié
        return conversationService.getAllConversations().stream()
                .filter(c -> c.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
