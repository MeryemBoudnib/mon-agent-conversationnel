// CHEMIN : src/main/java/com/chat_orchestrator/chat_orchestrator/service/ConversationService.java
package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.MessageDto;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.Message;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.MessageRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @PersistenceContext
    private EntityManager em;

    public ConversationService(
            ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public Conversation saveConversation(String userMessage, String botReply) {
        String title = generateTitle(userMessage);
        Conversation conv = new Conversation(title);

        if (userMessage != null && !userMessage.isBlank()) {
            conv.addMessage(new Message("user", userMessage));
        }
        if (botReply != null && !botReply.isBlank()) {
            conv.addMessage(new Message("bot", botReply));
        }

        return conversationRepository.save(conv);
    }

    private String generateTitle(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return "Nouvelle conversation";
        }
        return userMessage.length() > 30
                ? userMessage.substring(0, 30) + "…"
                : userMessage;
    }

    public List<Conversation> getAllConversations() {
        return conversationRepository.findAll();
    }

    public List<MessageDto> getMessagesByConversation(Long convId) {
        if (!conversationRepository.existsById(convId)) {
            throw new EntityNotFoundException("Conversation introuvable");
        }
        return messageRepository.findByConversation_IdOrderByTimestampAsc(convId)
                .stream()
                .map(m -> new MessageDto(m.getRole(), m.getContent(), m.getTimestamp()))
                .collect(Collectors.toList());
    }

    @Transactional
    public void saveMessage(Long conversationId, String role, String content) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation introuvable avec l'ID : " + conversationId));

        if ("user".equals(role) && "Nouvelle conversation".equals(conversation.getTitle())) {
            String newTitle = generateTitle(content);
            conversation.setTitle(newTitle);
        }

        Message message = new Message(role, content);
        conversation.addMessage(message);
    }

    @Transactional
    public void deleteConversationById(Long id) {
        conversationRepository.deleteById(id);
    }

    @Transactional
    public void deleteAllConversations() {
        conversationRepository.deleteAll();
        em.createNativeQuery("ALTER SEQUENCE conversation_id_seq RESTART WITH 1")
                .executeUpdate();
    }
}