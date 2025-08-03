package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.CreateConversationRequest;
import com.chat_orchestrator.chat_orchestrator.dto.MessageDto;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.service.ConversationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@CrossOrigin(origins = "http://localhost:4200")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/create")
    public ResponseEntity<Conversation> createConversation(
            @RequestBody CreateConversationRequest request) {
        Conversation conversation = conversationService
                .saveConversation(request.getUserMessage(), request.getBotReply());
        return ResponseEntity.ok(conversation);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Conversation>> getHistory() {
        return ResponseEntity.ok(conversationService.getAllConversations());
    }

    // ✅ Cette méthode enregistre les messages "user" et "bot"
    @PostMapping("/{id}/message")
    public ResponseEntity<Void> addMessage(
            @PathVariable Long id,
            @RequestBody Map<String,String> payload
    ) {
        String role = payload.get("role");
        String content = payload.get("content");
        System.out.println("📥 [SAVE MESSAGE] ID = " + id + " / role = " + role + " / content = " + content);
        conversationService.saveMessage(id, role, content);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<List<MessageDto>> getMessages(@PathVariable Long id) {
        return ResponseEntity.ok(conversationService.getMessagesByConversation(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        conversationService.deleteConversationById(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAllConversations() {
        conversationService.deleteAllConversations();
        return ResponseEntity.ok().build();
    }
}
