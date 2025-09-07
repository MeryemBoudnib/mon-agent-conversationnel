package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.MessageDto;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.Message;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.MessageRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ConversationService(
            ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    // ---------- Helpers sécurité ----------
    private static boolean isAdmin() {
        return SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private static String currentEmail() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    // ---------- Legacy (sans user) ----------
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

    // ---------- Version avec propriétaire ----------
    @Transactional
    public Conversation saveConversationFor(User owner, String userMessage, String botReply) {
        String title = generateTitle(userMessage);
        Conversation conv = new Conversation(title);
        conv.setOwner(owner);

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

    // ---------- Liste ----------
    public List<Conversation> getAllConversations() {
        return conversationRepository.findAll();
    }

    public List<Conversation> getAllConversationsFor(User owner) {
        return conversationRepository.findByOwnerOrderByDateDesc(owner);
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

        // 🔐 Autorisation : propriétaire ou ADMIN
        if (!isAdmin()) {
            User owner = conversation.getOwner();
            String email = currentEmail();
            if (owner == null || owner.getEmail() == null || !owner.getEmail().equals(email)) {
                throw new AccessDeniedException("Vous n’êtes pas le propriétaire de cette conversation");
            }
        }

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

    // ---------- NOUVEAU : mise à jour du titre ----------
    @Transactional
    public Conversation updateTitle(Long id, String newTitle) {
        Conversation conv = conversationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Conversation introuvable"));
        if (newTitle != null && !newTitle.isBlank()) {
            conv.setTitle(newTitle.trim());
        }
        return conv; // JPA flush auto @Transactional
    }

    // ---------- NOUVEAU : suppression ciblée (moi) ----------
    @Transactional
    public void deleteAllFor(User owner) {
        conversationRepository.deleteByOwner_Id(owner.getId());
    }

    // ---------- NOUVEAU : purge globale (ADMIN uniquement) ----------
    @Transactional
    public void purgeAllConversationsAsAdmin() {
        if (!isAdmin()) {
            throw new AccessDeniedException("Action réservée aux administrateurs.");
        }
        conversationRepository.deleteAll();
        // ⚠️ Évite de reset la séquence en prod/multi-tenant
    }
}
