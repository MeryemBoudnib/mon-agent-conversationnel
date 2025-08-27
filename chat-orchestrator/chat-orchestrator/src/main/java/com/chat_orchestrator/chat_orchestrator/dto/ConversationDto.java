// dto
package com.chat_orchestrator.chat_orchestrator.dto;

import java.time.LocalDateTime;

public record ConversationDto(Long id, String title, LocalDateTime date) {}
