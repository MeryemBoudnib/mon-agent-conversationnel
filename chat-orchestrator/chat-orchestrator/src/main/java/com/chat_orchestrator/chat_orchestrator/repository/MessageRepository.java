// src/main/java/com/chat_orchestrator/chat_orchestrator/repository/MessageRepository.java
package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.entity.Message;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversation_IdOrderByTimestampAsc(Long conversationId);
    List<Message> findByConversationIdOrderByTimestampAsc(Long conversationId);

    Optional<Message> findTopByOrderByIdDesc();

    long countByConversation_Id(Long conversationId);

    List<Message> findByTimestampBetweenOrderByTimestampAsc(Instant from, Instant to);

    /** Agrégation par minute : bucket epoch(ms), p50/p90/avg en secondes, + samples */
    @Query(value = """
        SELECT
          (EXTRACT(EPOCH FROM date_trunc('minute', m."timestamp")) * 1000)::bigint AS bucket_millis,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY (m.latency_ms / 1000.0))      AS p50,
          percentile_cont(0.9) WITHIN GROUP (ORDER BY (m.latency_ms / 1000.0))      AS p90,
          AVG(m.latency_ms / 1000.0)                                                AS avg,
          COUNT(*)                                                                  AS samples
        FROM message m
        WHERE m."timestamp" BETWEEN :from AND :to
        GROUP BY bucket_millis
        ORDER BY bucket_millis
        """, nativeQuery = true)
    List<LatencyAggProjection> aggregateLatencyPerMinute(@Param("from") Instant from,
                                                         @Param("to") Instant to);
}
