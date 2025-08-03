package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {


    Optional<Conversation> findTopByOrderByDateDesc();
}
