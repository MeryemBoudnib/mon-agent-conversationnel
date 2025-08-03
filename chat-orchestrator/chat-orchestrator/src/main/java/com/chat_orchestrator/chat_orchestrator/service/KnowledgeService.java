package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.dto.MessageDto;
import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.entity.Message;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import com.chat_orchestrator.chat_orchestrator.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.LongStream;

@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private final ConversationRepository convRepo;
    private final MessageRepository messageRepository;

    /** historique ordonné */
    public List<MessageDto> getHistory(Long convId) {
        return messageRepository
                .findByConversation_IdOrderByTimestampAsc(convId)
                .stream()
                .map(m -> new MessageDto(m.getRole(), m.getContent(), m.getTimestamp()))
                .toList();
    }

    /** total conversations */
    public long countConversations() {
        return convRepo.count();
    }

    /** total messages */
    public long countMessages() {
        return messageRepository.count();
    }

    /** dernier contenu */
    public String getLastMessage() {
        return messageRepository
                .findTopByOrderByIdDesc()
                .map(Message::getContent)
                .orElse("Aucun message trouvé.");
    }

    /** date dernière conv. */
    public String getLastConversationDate() {
        return convRepo
                .findTopByOrderByDateDesc()
                .map(conv -> conv.getDate().toString())
                .orElse("Aucune conversation trouvée.");
    }

    /** version appli */
    public String getAppVersion() {
        return "1.2.3";
    }

    /** total mots dans tous les messages */
    public long countWordsAllMessages() {
        return messageRepository.findAll()
                .stream()
                .mapToLong(m -> {
                    String c = m.getContent();
                    return (c == null || c.isBlank())
                            ? 0
                            : c.strip().split("\\W+").length;
                })
                .sum();
    }

    /** titre conv. la plus longue (par nombre de messages) */
    public String getLongestConversationTitle() {
        return convRepo.findAll()
                .stream()
                .max((c1, c2) -> Long.compare(
                        messageRepository.countByConversation_Id(c1.getId()),
                        messageRepository.countByConversation_Id(c2.getId())
                ))
                .map(Conversation::getTitle)
                .orElse("Aucune conversation trouvée.");
    }

    /** durée moyenne (en minutes) */
    public double getAverageConversationDuration() {
        var allConvs = convRepo.findAll();
        double total = 0;
        int validCount = 0;
        for (Conversation conv : allConvs) {
            var msgs = messageRepository
                    .findByConversation_IdOrderByTimestampAsc(conv.getId());
            if (msgs.size() < 2) continue;
            var start = msgs.get(0).getTimestamp();
            var end   = msgs.get(msgs.size() - 1).getTimestamp();
            long minutes = ChronoUnit.MINUTES.between(start, end);
            total += minutes;
            validCount++;
        }
        return validCount > 0 ? total / validCount : 0.0;
    }
    public Map<String, Long> countWordOccurrencesByConversation(String word) {
        String lower = word.toLowerCase();
        Map<String, Long> result = new LinkedHashMap<>();

        for (Conversation conv : convRepo.findAll()) {
            long count = messageRepository
                    .findByConversation_IdOrderByTimestampAsc(conv.getId())
                    .stream()
                    .map(Message::getContent)
                    .filter(Objects::nonNull)
                    .flatMapToLong(content -> LongStream.of(countOccurrences(content, lower)))
                    .sum();

            if (count > 0) {
                result.put(conv.getTitle(), count);
            }
        }
        return result;
    }

    /** Compte dans `text` le nombre d'index non-recouvrants de `word` (lowercase). */
    private int countOccurrences(String text, String word) {
        String t = text.toLowerCase();
        int idx = 0, cnt = 0;
        while ((idx = t.indexOf(word, idx)) != -1) {
            cnt++;
            idx += word.length();
        }
        return cnt;
    }
}
