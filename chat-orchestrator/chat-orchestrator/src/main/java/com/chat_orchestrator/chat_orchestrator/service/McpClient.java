package com.chat_orchestrator.chat_orchestrator.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class McpClient {
    private final RestTemplate http = new RestTemplate();

    @Value("${docqa.base-url:http://localhost:5000}")
    private String docqaBase;

    private static final String MCP_URL = "http://localhost:5000/mcp/execute";

    @SuppressWarnings("unchecked")
    public boolean hasDocs(String ns) {
        try {
            String url = docqaBase + "/docs?ns=" + URLEncoder.encode(ns, StandardCharsets.UTF_8);
            Map<String, Object> res = http.getForObject(url, Map.class);
            if (res == null) return false;
            Object docs = res.get("docs");
            if (docs instanceof List<?> l) return !l.isEmpty();
            Object count = res.get("count");
            if (count instanceof Number n) return n.intValue() > 0;
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public String docqaAnswer(String message, String ns, List<String> docs) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("q", message);
            params.put("k", 5);
            params.put("ns", ns);
            if (docs != null && !docs.isEmpty()) params.put("docs", docs);

            Map<String, Object> payload = Map.of(
                    "version", "1.0",
                    "id", UUID.randomUUID().toString(),
                    "type", "instruction",
                    "action", "docqa_answer",
                    "parameters", params
            );
            Map<String, Object> resp = http.postForObject(MCP_URL, payload, Map.class);
            if (resp != null && "success".equalsIgnoreCase((String) resp.get("status"))) {
                Map<String, Object> data = (Map<String, Object>) resp.get("data");
                return data == null ? "Réponse vide." : String.valueOf(data.get("reply"));
            }
            return "Erreur : Réponse invalide de MCP.";
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            return "Erreur HTTP MCP : " + e.getStatusCode() + " - " + e.getResponseBodyAsString();
        } catch (Exception e) {
            return "Erreur MCP : " + e.getMessage();
        }
    }

    public String generalConversation(String message) {
        try {
            Map<String, Object> payload = Map.of(
                    "version", "1.0",
                    "id", UUID.randomUUID().toString(),
                    "type", "instruction",
                    "action", "general_conversation",
                    "parameters", Map.of("message", message)
            );
            Map<String, Object> resp = http.postForObject(MCP_URL, payload, Map.class);
            if (resp != null && "success".equalsIgnoreCase((String) resp.get("status"))) {
                Map<String, Object> data = (Map<String, Object>) resp.get("data");
                return data == null ? "Réponse vide." : String.valueOf(data.get("reply"));
            }
            return "Erreur : Réponse invalide de MCP.";
        } catch (Exception e) {
            return "Erreur MCP : " + e.getMessage();
        }
    }
}
