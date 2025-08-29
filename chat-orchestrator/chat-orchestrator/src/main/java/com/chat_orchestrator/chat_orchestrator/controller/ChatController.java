// CHEMIN : src/main/java/com/chat_orchestrator/chat_orchestrator/controller/ChatController.java
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
        final Long convId = req.getConversationId(); // peut être null si 1er message

        // 1) Réponse "analytics" si applicable, sinon routage normal (RAG / général)
        var maybe = nlStatsService.tryAnswer(userMsg);
        String reply = maybe.orElseGet(() -> chatService.handleMessage(userMsg, ns, docs));

        // 2) Persistance + récupérer l’ID RÉEL (créé ou réutilisé)
        Long realId;
        if (!"guest".equals(ns)) {
            // utilisateur authentifié → conversation propriétaire
            User owner = userRepository.findByEmail(ns)
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

            if (convId == null) {
                // Nouvelle conversation : on la crée et on renvoie son id
                Conversation c = conversationService.saveConversationFor(owner, userMsg, reply);
                realId = c.getId();
            } else {
                // Conversation existante : on ajoute les messages user/bot
                conversationService.saveMessage(convId, "user", userMsg);
                conversationService.saveMessage(convId, "bot",  reply);
                realId = convId;
            }
        } else {
            // invité (fallback simple)
            if (convId == null) {
                Conversation c = conversationService.saveConversation(userMsg, reply);
                realId = c.getId();
            } else {
                conversationService.saveMessage(convId, "user", userMsg);
                conversationService.saveMessage(convId, "bot",  reply);
                realId = convId;
            }
        }

        // 3) Répondre au front avec l’ID réel → permet la nav /chat/:id et le rechargement de l’historique
        return ResponseEntity.ok(
                ChatResponse.builder()
                        .reply(reply)
                        // simple: les docs envoyés sur ce tour (tu pourras plus tard
                        // remplacer par les "citations" du RAG si tu veux les docs réellement utilisés)
                        .usedDocs(docs)
                        .conversationId(realId)
                        .build()
        );
    }
}
