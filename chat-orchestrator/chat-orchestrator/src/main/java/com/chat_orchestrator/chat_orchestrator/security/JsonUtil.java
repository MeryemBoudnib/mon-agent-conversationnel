// src/main/java/com/chat_orchestrator/chat_orchestrator/security/JsonUtil.java
package com.chat_orchestrator.chat_orchestrator.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

public final class JsonUtil {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private JsonUtil(){}

    public static void writeJson(HttpServletResponse resp, int status, String message) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        MAPPER.writeValue(resp.getOutputStream(), Map.of(
                "status", status,
                "message", message
        ));
    }
}
