package com.chat_orchestrator.chat_orchestrator.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

import java.util.Map;
import java.util.UUID;

@Service
public class McpClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String MCP_URL = "http://localhost:5000/mcp/execute";

    public String sendMcpInstruction(String action, Map<String, Object> parameters) {
        try {
            // Payload envoyé au serveur Python
            Map<String, Object> payload = Map.of(
                    "version", "1.0",
                    "id", UUID.randomUUID().toString(),
                    "type", "instruction",
                    "action", action,
                    "parameters", parameters
            );

            Map<String, Object> response = restTemplate.postForObject(MCP_URL, payload, Map.class);

            // Vérification du retour
            if (response != null) {
                String status = (String) response.get("status");
                if ("success".equalsIgnoreCase(status)) {
                    Map<String, Object> data = (Map<String, Object>) response.get("data");
                    return data != null && data.containsKey("reply")
                            ? data.get("reply").toString()
                            : "Réponse vide de MCP.";
                } else if (response.containsKey("error")) {
                    return "Erreur MCP : " + response.get("error");
                }
            }
            return "Erreur : Réponse invalide de MCP.";

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            return "Erreur HTTP MCP : " + e.getStatusCode() + " - " + e.getResponseBodyAsString();
        } catch (Exception e) {
            return "Erreur lors de l'appel MCP : " + e.getMessage();
        }
    }
}
