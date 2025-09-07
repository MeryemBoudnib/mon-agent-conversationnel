package com.chat_orchestrator.chat_orchestrator.dto;

import com.chat_orchestrator.chat_orchestrator.entity.Role;

public class AuthResponse {
    public String token;
    public Role role;
    public boolean active;

    public AuthResponse(String token) {
        this.token = token;
        this.role = null;
        this.active = true;
    }

    public AuthResponse(String token, Role role, boolean active) {
        this.token = token;
        this.role = role;
        this.active = active;
    }
}
