package com.chat_orchestrator.chat_orchestrator.dto;

import java.time.Instant;

public record LatencyAgg(
        Instant bucketInstant,
        double p50,
        double p90,
        double avg
) {
    public long bucketEpochMillis() {
        return bucketInstant.toEpochMilli();
    }
}
