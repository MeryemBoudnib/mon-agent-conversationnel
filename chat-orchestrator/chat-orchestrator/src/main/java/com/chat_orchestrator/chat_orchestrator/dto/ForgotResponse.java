// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/ForgotResponse.java
package com.chat_orchestrator.chat_orchestrator.dto;
/** resetUrl n'est présent qu'en DEV si app.reset.dev-shortcut=true */
public record ForgotResponse(String message, String resetUrl) {}