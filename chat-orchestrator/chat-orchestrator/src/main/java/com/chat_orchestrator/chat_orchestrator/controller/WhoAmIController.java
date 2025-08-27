package com.chat_orchestrator.chat_orchestrator.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class WhoAmIController {

    @GetMapping("/api/whoami")
    public Map<String, Object> whoami(Authentication auth) {
        return Map.of(
                "name", auth == null ? null : auth.getName(),
                "authorities", auth == null ? null :
                        auth.getAuthorities().stream().map(a -> a.getAuthority()).toList()
        );
    }
}
