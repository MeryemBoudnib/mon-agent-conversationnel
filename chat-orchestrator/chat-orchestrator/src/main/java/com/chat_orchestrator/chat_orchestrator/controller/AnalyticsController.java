// src/main/java/com/chat_orchestrator/chat_orchestrator/controller/AnalyticsController.java
package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.*;
import com.chat_orchestrator.chat_orchestrator.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;


@PreAuthorize("hasAnyRole('USER','ADMIN')")
@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "http://localhost:4200") // ← comme sur AdminController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/messages-per-day")
    public ResponseEntity<List<PointDTO>> messagesPerDay(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analyticsService.messagesPerDay(from, to));
    }

    @GetMapping("/avg-conv-duration")
    public ResponseEntity<StatDTO> avgConv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analyticsService.avgConvMinutes(from, to));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<List<HeatCellDTO>> heatmap(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(analyticsService.heatmap(from, to));
    }

    // ✅ AJOUTE CETTE ROUTE :
    @GetMapping("/top-keywords")
    public ResponseEntity<List<KeywordCountDTO>> topKeywords(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "20") int limit
    ) {
        var list = analyticsService.topKeywords(from, to, limit)
                .stream()
                .map(k -> new KeywordCountDTO(k.word(), k.count()))
                .toList();
        return ResponseEntity.ok(list);
    }
}
