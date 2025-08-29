package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatResponse {
    private String reply;
    private Long conversationId;   // id Spring de la conversation
    private List<String> usedDocs; // documents réellement utilisés (simple: ceux du tour)
}
