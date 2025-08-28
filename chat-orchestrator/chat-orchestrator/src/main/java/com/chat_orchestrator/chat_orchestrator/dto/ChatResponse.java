package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatResponse {
    private String reply;
    private Long conversationId;      // id de la conversation côté Spring
    private List<String> usedDocs;    // noms des documents vraiment utilisés par RAG
}
