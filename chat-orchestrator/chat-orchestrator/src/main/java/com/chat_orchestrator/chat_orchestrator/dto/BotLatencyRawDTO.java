// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/BotLatencyRawDTO.java
package com.chat_orchestrator.chat_orchestrator.dto;

import java.time.Instant;

public record BotLatencyRawDTO(Instant ts, Long latencyMs) {}
