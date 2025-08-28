package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.*;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.Role;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.MessageRepository;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final AnalyticsService analyticsService;
    private final PasswordEncoder passwordEncoder;

    // ------- USERS -------
    public List<AdminUserDTO> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> new AdminUserDTO(
                        u.getId(),
                        u.getFirstName(),
                        u.getLastName(),
                        u.getEmail(),
                        u.getRole(),
                        conversationRepository.countByOwner(u),
                        u.getCreatedAt(),
                        u.getBannedUntil()
                ))
                .sorted(Comparator.comparing(AdminUserDTO::id))
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

    @Transactional public void deleteConversation(Long id) { conversationRepository.deleteById(id); }

    @Transactional
    public void deleteConversationsByUser(Long userId) {
        var owner = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User introuvable"));
        conversationRepository.findByOwnerOrderByDateDesc(owner)
                .forEach(c -> conversationRepository.deleteById(c.getId()));
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

    // ------- SIGNUPS -------
    public List<UserSignupDTO> signupsPerDay(LocalDate from, LocalDate to) {
        // utilise la native query et mappe vers DTO
        return userRepository.findSignupsPerDayNative(from, to).stream()
                .map(row -> new UserSignupDTO(
                        ((java.sql.Date) row.get("date")).toLocalDate(),
                        ((Number) row.get("count")).longValue()
                ))
                .toList();
    }

    // ------- ADMIN ACTIONS -------
    @Transactional
    public void resetPassword(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        String temp = generateTempPassword(12);
        u.setPassword(passwordEncoder.encode(temp));
        userRepository.save(u);
        // TODO: envoyer email / notification au user avec le lien de reset ou MDP temporaire
        // Pour l’instant, on pourrait logger côté serveur si besoin.
        System.out.println("[ADMIN] Password reset for " + u.getEmail() + " temp=" + temp);
    }

    @Transactional
    public void banUser(Long userId, LocalDate until) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        // on fixe à 23:59:59 pour la date fournie
        Instant end = until.atTime(LocalTime.MAX).atZone(ZoneId.systemDefault()).toInstant();
        u.setBannedUntil(end);
        userRepository.save(u);
    }

    @Transactional
    public void unbanUser(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        u.setBannedUntil(null);
        userRepository.save(u);
    }

    public String exportConversationsCsv(Long userId) {
        List<Conversation> convs = conversationRepository.findByOwner_IdOrderByDateDesc(userId);
        String header = "conversation_id;title;created_at;messages_count\n";
        String body = convs.stream()
                .map(c -> {
                    long count = messageRepository.countByConversation_Id(c.getId());
                    String title = c.getTitle() != null ? c.getTitle().replace(";", ",") : "";
                    String when = c.getDate() != null ? c.getDate().toInstant().toString() : "";
                    return c.getId() + ";" + title + ";" + when + ";" + count;
                })
                .collect(Collectors.joining("\n"));
        return header + body + (body.isEmpty() ? "" : "\n");
    }

    // util
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!";

    private String generateTempPassword(int len) {
        SecureRandom rnd = new SecureRandom();
        byte[] b = new byte[len];
        for (int i = 0; i < len; i++) {
            b[i] = (byte) ALPHABET.charAt(rnd.nextInt(ALPHABET.length()));
        }
        return new String(b, StandardCharsets.US_ASCII);
    }
}
