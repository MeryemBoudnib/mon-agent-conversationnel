package com.chat_orchestrator.chat_orchestrator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoField;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NLStatsService {

    private final AnalyticsService analytics;

    public Optional<String> tryAnswer(String message) {
        String m = message == null ? "" : message.toLowerCase(Locale.FRENCH).trim();

        DateRange range = null;
        if (m.contains("aujourd")) range = today();
        else if (m.contains("hier")) range = yesterday();
        else if (m.contains("semaine")) range = thisWeek();
        else if (m.contains("mois")) range = thisMonth();
        else if (m.contains("année") || m.contains("annee")) range = thisYear();

        if (range == null) return Optional.empty();

        // Combien de conversations ? (approx via volume de messages)
        if (m.contains("combien") && (m.contains("conversation") || m.contains("conv"))) {
            long totalMsgs = analytics.messagesPerDay(range.from(), range.to())
                    .stream().mapToLong(p -> p.msgs()).sum();
            return Optional.of("Entre " + range.from() + " et " + range.to() + ", j’ai compté " + totalMsgs + " messages (approximation du volume de conversations).");
        }

        // Durée moyenne
        if (m.contains("durée") || m.contains("moyenne")) {
            var avg = analytics.avgConvMinutes(range.from(), range.to());
            double minutes = avg.value();
            return Optional.of(String.format(Locale.FRENCH,
                    "La durée moyenne des conversations entre %s et %s est de %.2f minutes.",
                    range.from(), range.to(), minutes));
        }

        // Mots-clés
        if (m.contains("mots") || m.contains("mots-clés") || m.contains("keywords")) {
            var top = analytics.topKeywords(range.from(), range.to(), 10);
            var s = top.stream().map(k -> k.word()+" ("+k.count()+")").collect(Collectors.joining(", "));
            return Optional.of("Top mots-clés : " + s);
        }

        return Optional.empty();
    }

    private record DateRange(LocalDate from, LocalDate to) {}
    private DateRange today()     { var d = LocalDate.now(); return new DateRange(d, d); }
    private DateRange yesterday() { var d = LocalDate.now().minusDays(1); return new DateRange(d, d); }
    private DateRange thisWeek()  { var d = LocalDate.now();
        var from = d.with(ChronoField.DAY_OF_WEEK,1);
        var to = d.with(ChronoField.DAY_OF_WEEK,7);
        return new DateRange(from, to); }
    private DateRange thisMonth() { var d = LocalDate.now(); return new DateRange(d.withDayOfMonth(1), d.withDayOfMonth(d.lengthOfMonth())); }
    private DateRange thisYear()  { var d = LocalDate.now(); return new DateRange(d.withDayOfYear(1), d.withDayOfYear(d.lengthOfYear())); }
}
