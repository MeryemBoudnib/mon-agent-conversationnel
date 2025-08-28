package com.chat_orchestrator.chat_orchestrator.dto;

import com.chat_orchestrator.chat_orchestrator.entity.Role;

import java.time.Instant;

public record AdminUserDTO(
        Long id,
        String firstName,
        String lastName,
        String email,
        Role role,
        Long conversations,
        Instant createdAt,
        Instant bannedUntil
) {}
