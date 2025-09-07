// src/main/java/com/chat_orchestrator/chat_orchestrator/repository/LatencyAggProjection.java
package com.chat_orchestrator.chat_orchestrator.repository;

public interface LatencyAggProjection {
    Long   getBucketMillis(); // epoch ms (début de minute)
    Double getP50();          // secondes
    Double getP90();          // secondes
    Double getAvg();          // secondes
    Long   getSamples();      // nombre d'échantillons
}
