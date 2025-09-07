package com.chat_orchestrator.chat_orchestrator.repository;

import java.time.Instant;

public interface MessageLatencyProjection {
    Instant getTimestamp();   // champ 'timestamp' de Message
    Long getLatencyMs();      // champ 'latencyMs' de Message
}
