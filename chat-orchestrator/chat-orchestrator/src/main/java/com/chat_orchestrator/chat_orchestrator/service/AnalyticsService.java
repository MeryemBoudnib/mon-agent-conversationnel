package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.HeatCellDTO;
import com.chat_orchestrator.chat_orchestrator.dto.PointDTO;
import com.chat_orchestrator.chat_orchestrator.dto.StatDTO;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnalyticsService {
    private final EntityManager em;
    private final UserRepository userRepository;

    private static boolean isAdmin() {
        return SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private static String currentEmail() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    public List<PointDTO> messagesPerDay(LocalDate from, LocalDate to){
        LocalDateTime fromTs = from.atStartOfDay();
        LocalDateTime toNextTs = to.plusDays(1).atStartOfDay();

        String base = """
            SELECT DATE(m.timestamp) AS d, COUNT(*) AS c
            FROM message m
            JOIN conversation c ON c.id = m.conversation_id
            WHERE m.timestamp >= ?1 AND m.timestamp < ?2
        """;

        String filter = "";
        Long uid = null;
        if (!isAdmin()) {
            User u = userRepository.findByEmail(currentEmail())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            uid = u.getId();
            filter = " AND c.user_id = ?3 ";
        }

        String sql = base + filter + " GROUP BY DATE(m.timestamp) ORDER BY d";

        var q = em.createNativeQuery(sql)
                .setParameter(1, fromTs)
                .setParameter(2, toNextTs);
        if (uid != null) q.setParameter(3, uid);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();

        return rows.stream()
                .map(r -> new PointDTO(
                        ((java.sql.Date) r[0]).toLocalDate(),
                        ((Number) r[1]).longValue()
                ))
                .toList();
    }

    public StatDTO avgConvMinutes(LocalDate from, LocalDate to){
        LocalDateTime fromTs = from.atStartOfDay();
        LocalDateTime toNextTs = to.plusDays(1).atStartOfDay();

        String base = """
            SELECT COALESCE(AVG(dur_min), 0)
            FROM (
                SELECT EXTRACT(EPOCH FROM (MAX(m.timestamp) - MIN(m.timestamp))) / 60.0 AS dur_min
                FROM message m
                JOIN conversation c ON c.id = m.conversation_id
                GROUP BY m.conversation_id
                HAVING MIN(m.timestamp) >= ?1 AND MIN(m.timestamp) < ?2
        """;

        String filter = "";
        Long uid = null;
        if (!isAdmin()) {
            User u = userRepository.findByEmail(currentEmail())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            uid = u.getId();
            filter = " AND c.user_id = ?3 ";
        }

        String sql = base + filter + " ) t ";

        var q = em.createNativeQuery(sql)
                .setParameter(1, fromTs)
                .setParameter(2, toNextTs);
        if (uid != null) q.setParameter(3, uid);

        Number v = (Number) q.getSingleResult();
        return new StatDTO("avg_conv_min", v == null ? 0.0 : v.doubleValue());
    }

    public List<HeatCellDTO> heatmap(LocalDate from, LocalDate to){
        LocalDateTime fromTs = from.atStartOfDay();
        LocalDateTime toNextTs = to.plusDays(1).atStartOfDay();

        String base = """
            SELECT EXTRACT(DOW FROM m.timestamp)::int AS dow,
                   EXTRACT(HOUR FROM m.timestamp)::int AS hh,
                   COUNT(*) AS c
            FROM message m
            JOIN conversation c ON c.id = m.conversation_id
            WHERE m.timestamp >= ?1 AND m.timestamp < ?2
        """;

        String filter = "";
        Long uid = null;
        if (!isAdmin()) {
            User u = userRepository.findByEmail(currentEmail())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            uid = u.getId();
            filter = " AND c.user_id = ?3 ";
        }

        String sql = base + filter + " GROUP BY dow, hh ORDER BY dow, hh";

        var q = em.createNativeQuery(sql)
                .setParameter(1, fromTs)
                .setParameter(2, toNextTs);
        if (uid != null) q.setParameter(3, uid);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();

        return rows.stream()
                .map(r -> new HeatCellDTO(
                        ((Number) r[0]).intValue(),
                        ((Number) r[1]).intValue(),
                        ((Number) r[2]).longValue()
                ))
                .toList();
    }

    // ------- Top keywords --------
    public record KeywordCount(String word, long count) {}

    @Transactional
    public List<KeywordCount> topKeywords(LocalDate from, LocalDate to, int limit){
        var fromTs  = from.atStartOfDay();
        var toNextTs = to.plusDays(1).atStartOfDay();

        String base = """
        SELECT w AS word, COUNT(*) AS cnt
        FROM (
            SELECT unnest(regexp_split_to_array(lower(m.content), E'[^[:alnum:]_]+')) AS w
            FROM message m
            JOIN conversation c ON c.id = m.conversation_id
            WHERE m.timestamp >= :fromTs AND m.timestamp < :toTs
    """;

        String filter = "";
        Long uid = null;
        if (!isAdmin()) {
            User u = userRepository.findByEmail(currentEmail())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
            uid = u.getId();
            filter = " AND c.user_id = :uid ";
        }

        String sql = base + filter + """
            ) t
        WHERE w <> ''
          AND char_length(w) >= 3
          AND w NOT IN (
            'les','des','une','que','qui','est','pour','avec','dans','vous','nous','sur','pas',
            'bonjour','salut','oui','non','ca','ça','va',
            'the','and','are','mon','ton','son','mes','tes','ses','aux','dun','dune','mais',
            'donc','alors','car','par','quoi','quand','ou','où','le','la','un','de','du','au',
            'en','ce','cet','cette'
          )
        GROUP BY w
        ORDER BY cnt DESC
        LIMIT :limit
    """;

        var q = em.createNativeQuery(sql)
                .setParameter("fromTs", fromTs)
                .setParameter("toTs", toNextTs)
                .setParameter("limit", limit);

        if (uid != null) q.setParameter("uid", uid);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();

        return rows.stream()
                .map(r -> new KeywordCount((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

}
