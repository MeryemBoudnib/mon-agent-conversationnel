package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.entity.Conversation;
import com.chat_orchestrator.chat_orchestrator.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")

public class HistoryController {
    private final ConversationRepository conversationRepository;

    @GetMapping
    public List<Conversation> getAll() {
        return conversationRepository.findAll();
    }
    // GET /api/history/{id}         → détails (messages) d’une conv
    @GetMapping("/{id}")
    public Conversation getOne(@PathVariable Long id) {
        return conversationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
