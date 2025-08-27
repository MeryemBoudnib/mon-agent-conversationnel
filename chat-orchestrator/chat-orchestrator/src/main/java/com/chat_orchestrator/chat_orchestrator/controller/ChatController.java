package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.ChatRequest;
import com.chat_orchestrator.chat_orchestrator.dto.ChatResponse;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import com.chat_orchestrator.chat_orchestrator.service.ChatService;
import com.chat_orchestrator.chat_orchestrator.service.ConversationService;
import com.chat_orchestrator.chat_orchestrator.service.KnowledgeService;
import com.chat_orchestrator.chat_orchestrator.service.NLStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final KnowledgeService knowledgeService;
    private final ConversationService conversationService;
    private final NLStatsService nlStatsService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        String userMsg = request.getMessage();

        // 1) essaie de répondre via "stats naturelles"
        var maybe = nlStatsService.tryAnswer(userMsg);
        String reply = maybe.orElseGet(() -> chatService.handleMessage(userMsg));

        // 2) enregistre l’échange (si authentifié → lier au user)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String email = auth.getName();
            User owner = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            conversationService.saveConversationFor(owner, userMsg, reply);
        } else {
            // si tu veux ignorer les anon, commente la ligne suivante
            conversationService.saveConversation(userMsg, reply);
        }

        return ResponseEntity.ok(new ChatResponse(reply));
    }

    @PostMapping("/ask")
    public Map<String, String> askAI(@RequestBody Map<String, String> request) {
        String message = request.get("message");
        String response = chatService.askAI(message);
        return Map.of("reply", response);
    }

    @PostMapping("/handle")
    public Map<String, String> handleChat(@RequestBody Map<String, String> request) {
        String message = request.get("message").toLowerCase();

        Map<String, Supplier<String>> handlers = new LinkedHashMap<>();
        handlers.put("conversations", () -> "Il y a " + knowledgeService.countConversations() + " conversations.");
        handlers.put("messages",      () -> "Il y a " + knowledgeService.countMessages() + " messages.");
        handlers.put("dernier",       () -> "Le dernier message : « " + knowledgeService.getLastMessage() + " »");
        handlers.put("date",          () -> "La dernière conversation a eu lieu le " + knowledgeService.getLastConversationDate());
        handlers.put("version",       () -> "Version de l’application : " + knowledgeService.getAppVersion());
        handlers.put("mots",          () -> "Total de mots dans tous les messages : " + knowledgeService.countWordsAllMessages());
        handlers.put("durée",         () -> String.format("Durée moyenne des conversations : %.1f minutes", knowledgeService.getAverageConversationDuration()));
        handlers.put("longue",        () -> "La plus longue conversation s’intitule : « " + knowledgeService.getLongestConversationTitle() + " »");

        // handler pour “mot XXX”
        handlers.put("mot ", () -> {
            String[] parts = request.get("message").split("\\s+", 2);
            if (parts.length < 2 || parts[1].isBlank()) {
                return "Précisez le mot à rechercher, par exemple “mot java”.";
            }
            String word = parts[1].trim();
            var occurrences = knowledgeService.countWordOccurrencesByConversation(word);
            if (occurrences.isEmpty()) {
                return "Le mot « " + word + " » n’apparaît dans aucune conversation.";
            }
            String list = occurrences.entrySet().stream()
                    .map(e -> String.format("dans \"%s\" : %d fois", e.getKey(), e.getValue()))
                    .collect(Collectors.joining(" · "));
            return "Occurrences de « " + word + " » : " + list + ".";
        });

        for (var entry : handlers.entrySet()) {
            if (message.contains(entry.getKey())) {
                return Map.of("reply", entry.getValue().get());
            }
        }

        String reply = chatService.handleMessage(request.get("message"));

        // enregistrement
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String email = auth.getName();
            User owner = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            conversationService.saveConversationFor(owner, request.get("message"), reply);
        } else {
            conversationService.saveConversation(request.get("message"), reply);
        }

        return Map.of("reply", reply);
    }

    @PostMapping("/auto")
    public ResponseEntity<Map<String, String>> autoChat(@RequestBody Map<String, String> request) {
        String message = request.get("message");
        String reply = "Réponse du bot";

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String email = auth.getName();
            User owner = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            conversationService.saveConversationFor(owner, message, reply);
        } else {
            conversationService.saveConversation(message, reply);
        }

        return ResponseEntity.ok(Map.of("reply", reply));
    }

    @GetMapping("/history")
    public ResponseEntity<List<Conversation>> getHistory() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            // Si tu préfères 401:
            // return ResponseEntity.status(401).build();
            return ResponseEntity.ok(List.of());
        }
        String email = auth.getName();
        User owner = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        return ResponseEntity.ok(conversationService.getAllConversationsFor(owner));
    }
}
