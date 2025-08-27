// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/AdminStatsDTO.java
package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AdminStatsDTO {
    private long totalUsers;
    private long totalConversations;
    private long totalMessages;
}
