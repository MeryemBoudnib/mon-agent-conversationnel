package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.CreateConversationRequest;
import com.chat_orchestrator.chat_orchestrator.dto.MessageDto;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import com.chat_orchestrator.chat_orchestrator.service.ConversationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@CrossOrigin(origins = "http://localhost:4200")
public class ConversationController {

    private final ConversationService conversationService;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    public ConversationController(ConversationService conversationService,
                                  UserRepository userRepository,
                                  ConversationRepository conversationRepository) {
        this.conversationService = conversationService;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
    }

    private User currentUserOr401() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable: " + email));
    }

    private void assertOwnerOr403(Long conversationId, User user) {
        Conversation c = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation introuvable"));
        if (c.getOwner() == null || !c.getOwner().getId().equals(user.getId())) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    @PostMapping(
            path = "/create",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Conversation> createConversation(@RequestBody CreateConversationRequest request) {
        User owner = currentUserOr401();
        Conversation conv = conversationService.saveConversationFor(owner, request.getUserMessage(), request.getBotReply());
        return ResponseEntity.ok(conv);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Conversation>> getHistory() {
        User owner = currentUserOr401();
        return ResponseEntity.ok(conversationService.getAllConversationsFor(owner));
    }

    // ✅ Accepte /message ET /messages (compat front)
    // ✅ accepte /message et /messages
    @PostMapping(path = {"/{id}/message", "/{id}/messages"}, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> addMessage(@PathVariable Long id, @RequestBody Map<String,String> payload) {
        String role = payload.get("role");
        String content = payload.get("content");
        conversationService.saveMessage(id, role, content);
        return ResponseEntity.ok().build();
    }


    @GetMapping("/{id}/messages")
    public ResponseEntity<List<MessageDto>> getMessages(@PathVariable Long id) {
        User owner = currentUserOr401();
        assertOwnerOr403(id, owner);
        return ResponseEntity.ok(conversationService.getMessagesByConversation(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        User owner = currentUserOr401();
        assertOwnerOr403(id, owner);
        conversationService.deleteConversationById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAllConversations() {
        // Optionnel: ne laisser que l'ADMIN ici, sinon on efface tout le monde
        User owner = currentUserOr401();
        // Si tu veux restreindre: vérifier role ADMIN avant.
        conversationService.deleteAllConversations();
        return ResponseEntity.noContent().build();
    }
}
