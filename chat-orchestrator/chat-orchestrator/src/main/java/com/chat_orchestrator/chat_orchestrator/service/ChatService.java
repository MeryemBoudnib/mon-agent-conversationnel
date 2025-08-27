package com.chat_orchestrator.chat_orchestrator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final McpClient mcpClient;

    private String routeIntent(String message){
        String m = message.toLowerCase(Locale.ROOT);
        if (m.contains("pdf") || m.contains("doc") || m.contains("section") || m.contains("dans mes documents"))
            return "docqa";
        // Exemple: if (m.contains("stat") || m.contains("tendance")) return "analytics";
        return "chat";
    }

    public String askAI(String message) {
        return handleMessage(message);
    }

    public String handleMessage(String message) {
        String intent = routeIntent(message);
        return switch (intent) {
            case "docqa" -> mcpClient.sendMcpInstruction("docqa_search", Map.of("q", message, "k", 3));
            default      -> mcpClient.sendMcpInstruction("general_conversation", Map.of("message", message));
        };
    }
}
