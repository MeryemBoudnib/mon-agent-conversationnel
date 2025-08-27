// CHEMIN : src/main/java/com/chat_orchestrator/chat_orchestrator/entity/Conversation.java
package com.chat_orchestrator.chat_orchestrator.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "conversation")
public class Conversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false, updatable = false)
    private java.util.Date date = new java.util.Date();

    @Column(nullable = false)
    private String title;

    // 🔵 propriétaire de la conversation
    @JsonIgnore // ⬅⬅ évite la sérialisation du proxy Hibernate
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User owner;

    @OneToMany(
            mappedBy = "conversation",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<Message> messages = new ArrayList<>();

    protected Conversation() {}

    public Conversation(String title) { this.title = title; }

    public Conversation(String title, String userMessage, String botReply) {
        this.title = title;
        this.addMessage(new Message("user", userMessage));
        this.addMessage(new Message("bot", botReply));
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public java.util.Date getDate() { return date; }
    public List<Message> getMessages() { return messages; }

    public void addMessage(Message message) {
        message.setConversation(this);
        this.messages.add(message);
    }
    public void removeMessage(Message m) {
        messages.remove(m);
        m.setConversation(null);
    }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
}
