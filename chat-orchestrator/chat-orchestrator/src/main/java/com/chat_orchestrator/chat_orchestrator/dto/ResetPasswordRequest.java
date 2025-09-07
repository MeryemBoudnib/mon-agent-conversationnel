// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/ResetPasswordRequest.java
package com.chat_orchestrator.chat_orchestrator.dto;
/** email est optionnel: s'il est fourni, on vérifie qu'il correspond au token */
public record ResetPasswordRequest(String token, String password, String email) {}