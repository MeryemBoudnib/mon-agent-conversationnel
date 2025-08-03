package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversation_IdOrderByTimestampAsc(Long conversationId);
    List<Message> findByConversationIdOrderByTimestampAsc(Long conversationId);

    Optional<Message> findTopByOrderByIdDesc();

    // Pour compter les messages d’une conversation donnée
    long countByConversation_Id(Long conversationId);
}
