package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findTopByOrderByDateDesc();

    // 🔵 filtrage par user
    List<Conversation> findByOwnerOrderByDateDesc(User owner);
    Optional<Conversation> findTopByOwnerOrderByDateDesc(User owner);
    long countByOwner(User owner);
    List<Conversation> findByOwner_IdOrderByDateDesc(Long userId);

    // 🔴 nouvelle méthode: suppression ciblée par propriétaire
    @Transactional
    @Modifying
    void deleteByOwner_Id(Long ownerId);
}
