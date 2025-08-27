package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.HeatCellDTO;
import com.chat_orchestrator.chat_orchestrator.dto.PointDTO;
import com.chat_orchestrator.chat_orchestrator.dto.StatDTO;
import com.chat_orchestrator.chat_orchestrator.service.AnalyticsService;
import com.chat_orchestrator.chat_orchestrator.service.AnalyticsService.KeywordCount;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AdminAnalyticsController {

    private final AnalyticsService analytics;

    @GetMapping("/messages-per-day")
    public ResponseEntity<List<PointDTO>> messagesPerDay(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analytics.messagesPerDay(from, to));
    }

    @GetMapping("/avg-conv-duration")
    public ResponseEntity<StatDTO> avgConv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analytics.avgConvMinutes(from, to));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<List<HeatCellDTO>> heatmap(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analytics.heatmap(from, to));
    }

    @GetMapping("/top-keywords")
    public ResponseEntity<List<KeywordCount>> topKeywords(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(analytics.topKeywords(from, to, limit));
    }
}
