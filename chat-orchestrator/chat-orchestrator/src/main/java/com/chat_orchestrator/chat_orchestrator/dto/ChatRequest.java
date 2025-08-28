package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatRequest {
    private String message;

    // Filtrage côté RAG: un doc ou plusieurs (noms retournés par /ingest)
    private String doc;          // optionnel
    private List<String> docs;   // optionnel

    // Si null => nouvelle conversation; sinon on ajoute des messages dans celle-ci
    private Long conversationId; // optionnel
}
