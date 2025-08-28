package com.chat_orchestrator.chat_orchestrator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final McpClient mcpClient;

    public String handleMessage(String message, String ns, List<String> docs) {
        // Si l’utilisateur a joint des docs => DocQA forcé
        if (docs != null && !docs.isEmpty()) {
            String rag = mcpClient.docqaAnswer(message, ns, docs);
            if (rag != null && !rag.isBlank() && !"NO_CONTEXT".equalsIgnoreCase(rag.trim())) {
                return rag;
            }
        }
        // Sinon, s’il y a déjà des docs ingérés pour ce ns, on tente quand même le RAG
        if (mcpClient.hasDocs(ns)) {
            String rag = mcpClient.docqaAnswer(message, ns, null);
            if (rag != null && !rag.isBlank() && !"NO_CONTEXT".equalsIgnoreCase(rag.trim())) {
                return rag;
            }
        }
        return mcpClient.generalConversation(message);
    }
}
