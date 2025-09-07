// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/BotLatencyRowDTO.java
package com.chat_orchestrator.chat_orchestrator.dto;

public record BotLatencyRowDTO(
        long ts,      // epoch millis
        double p50,
        double p90,
        double avg,
        long samples
) {}
