// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/CreateConversationRequest.java
package com.chat_orchestrator.chat_orchestrator.dto;

public class CreateConversationRequest {
    private String userMessage;
    private String botReply;

    // getters / setters
    public String getUserMessage() { return userMessage; }
    public void setUserMessage(String userMessage) { this.userMessage = userMessage; }

    public String getBotReply() { return botReply; }
    public void setBotReply(String botReply) { this.botReply = botReply; }
}
