// src/main/java/com/chat_orchestrator/chat_orchestrator/entity/Message.java
package com.chat_orchestrator.chat_orchestrator.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "message")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String role;       // "user" ou "bot"
    @Column(columnDefinition = "TEXT") // Indique à JPA d'utiliser un type de colonne TEXT

    private String content;

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    public Message() { /* JPA */ }

    public Message(String role, String content) {
        this.role = role;
        this.content = content;

    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    // getters/public setters
    public Long getId() { return id; }
    public String getRole() { return role; }
    public String getContent() { return content; }
    public LocalDateTime getTimestamp() { return timestamp; }

    public void setRole(String role) { this.role = role; }
    public void setContent(String content) { this.content = content; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }
}
