package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.ChatRequest;
import com.chat_orchestrator.chat_orchestrator.dto.ChatResponse;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import com.chat_orchestrator.chat_orchestrator.service.ChatService;
import com.chat_orchestrator.chat_orchestrator.service.ConversationService;
import com.chat_orchestrator.chat_orchestrator.service.NLStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ConversationService conversationService;
    private final NLStatsService nlStatsService;
    private final UserRepository userRepository;

    private String nsFromAuth() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a != null && a.isAuthenticated() && !"anonymousUser".equals(a.getPrincipal()))
                ? a.getName() : "guest";
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest req) {
        final String userMsg = req.getMessage() == null ? "" : req.getMessage().trim();
        final String ns = nsFromAuth();
        final List<String> docs = (req.getDocs() == null) ? List.of() : req.getDocs();
        final Long convId = req.getConversationId();

        var maybe = nlStatsService.tryAnswer(userMsg);
        String reply = maybe.orElseGet(() -> chatService.handleMessage(userMsg, ns, docs));

        // (persistance simple – adapte selon ton modèle)
        String authNs = nsFromAuth();
        if (!"guest".equals(authNs)) {
            User owner = userRepository.findByEmail(authNs)
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            conversationService.saveConversationFor(owner, userMsg, reply);
        } else {
            conversationService.saveConversation(userMsg, reply);
        }

        return ResponseEntity.ok(ChatResponse.builder()
                .reply(reply)
                .usedDocs(docs)
                .conversationId(convId)
                .build());
    }
}