package com.chat_orchestrator.chat_orchestrator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final McpClient mcpClient;
    // Le WebClient.Builder n'est plus nécessaire si on simplifie

    /**
     * CORRECTION : Cette méthode est la source de vos réponses incorrectes.
     * Le service externe 'extract_instruction' ne comprend pas votre question
     * et renvoie une action par défaut.
     * Nous allons la simplifier pour qu'elle appelle directement l'agent de conversation générale.
     */
    public String askAI(String message) {
        // Envoie directement la question à l'agent de conversation générale.
        // C'est plus simple et plus fiable que d'essayer d'extraire une instruction.
        return mcpClient.sendMcpInstruction("general_conversation", Map.of("message", message));
    }

    /**
     * Cette méthode est correcte et fait la même chose que la version corrigée de askAI.
     * On peut garder les deux pour la compatibilité, mais elles sont maintenant identiques.
     */
    public String handleMessage(String message) {
        return mcpClient.sendMcpInstruction("general_conversation", Map.of("message", message));
    }
}