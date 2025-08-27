package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class ConversationSummaryDTO {
    private Long id;
    private String title;
    private Instant createdAt;
    private long messages;
    private Long ownerId;
    private String ownerEmail;
}
