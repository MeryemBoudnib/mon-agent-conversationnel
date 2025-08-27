// src/main/java/com/chat_orchestrator/chat_orchestrator/service/AdminService.java
package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.*;
import com.chat_orchestrator.chat_orchestrator.dto.projection.UserSignupProjection;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.Role;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.MessageRepository;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final AnalyticsService analyticsService;

    // ------- USERS -------
    public List<AdminUserDTO> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> new AdminUserDTO(
                        u.getId(),
                        u.getFirstName(),
                        u.getLastName(),
                        u.getEmail(),
                        u.getRole(),
                        conversationRepository.countByOwner(u)
                ))
                .sorted(Comparator.comparing(AdminUserDTO::getId))
                .toList();
    }

    @Transactional
    public void setRole(Long userId, Role role) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        u.setRole(role);
        userRepository.save(u);
    }

    public AdminStatsDTO stats() {
        long users = userRepository.count();
        long convs = conversationRepository.count();
        long msgs  = messageRepository.count();
        return AdminStatsDTO.builder()
                .totalUsers(users)
                .totalConversations(convs)
                .totalMessages(msgs)
                .build();
    }

    // ------- CONVERSATIONS -------
    public List<ConversationSummaryDTO> listConversations(Long userId) {
        List<Conversation> src = (userId == null)
                ? conversationRepository.findAll()
                : conversationRepository.findByOwnerOrderByDateDesc(
                userRepository.findById(userId)
                        .orElseThrow(() -> new RuntimeException("User introuvable"))
        );

        return src.stream()
                .map(c -> new ConversationSummaryDTO(
                        c.getId(),
                        c.getTitle(),
                        c.getDate().toInstant(),
                        messageRepository.countByConversation_Id(c.getId()),
                        c.getOwner() != null ? c.getOwner().getId() : null,
                        (c.getOwner() != null ? c.getOwner().getEmail() : null)
                ))
                .sorted(Comparator.comparing(ConversationSummaryDTO::getCreatedAt).reversed())
                .toList();
    }

    @Transactional
    public void deleteConversation(Long id) {
        conversationRepository.deleteById(id);
    }

    @Transactional
    public void deleteConversationsByUser(Long userId) {
        var owner = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User introuvable"));
        conversationRepository.findByOwnerOrderByDateDesc(owner)
                .forEach(c -> conversationRepository.deleteById(c.getId()));
    }

    // ------- SIGNUPS PER DAY -------
    public List<UserSignupDTO> signupsPerDay(LocalDate from, LocalDate to) {
        List<UserSignupProjection> rows = userRepository.findSignupsPerDay(from, to);
        return rows.stream()
                .map(r -> new UserSignupDTO(r.getDate(), r.getCount()))
                .toList();
    }

    // ------- DASHBOARD -------
    public DashboardDTO dashboard(LocalDate from, LocalDate to, int topN) {
        List<PointDTO> mpd = analyticsService.messagesPerDay(from, to);
        StatDTO avg = analyticsService.avgConvMinutes(from, to);
        List<HeatCellDTO> hm = analyticsService.heatmap(from, to);
        List<KeywordCountDTO> top = analyticsService.topKeywords(from, to, topN).stream()
                .map(k -> new KeywordCountDTO(k.word(), k.count()))
                .toList();

        return new DashboardDTO(mpd, avg, hm, top);
    }
}
