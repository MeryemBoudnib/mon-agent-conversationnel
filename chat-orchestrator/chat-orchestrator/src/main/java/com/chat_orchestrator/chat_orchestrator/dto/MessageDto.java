package com.chat_orchestrator.chat_orchestrator.dto;

import java.time.LocalDateTime;

// Ensure this class exists with the correct constructor
public class MessageDto {
    private String role;
    private String content;
    private LocalDateTime timestamp;

    // FIX: The constructor parameters must match the order of the service call.
    public MessageDto(String role, String content, LocalDateTime timestamp) {
        this.role = role;
        this.content = content;
        this.timestamp = timestamp;
    }

    // Getters
    public String getRole() { return role; }
    public String getContent() { return content; }
    public LocalDateTime getTimestamp() { return timestamp; }
}