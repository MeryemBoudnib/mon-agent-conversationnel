package com.chat_orchestrator.chat_orchestrator.dto.docqa;

import java.util.List;

public class DocqaDtos {
    // Requête de recherche
    public record SearchReq(String q, Integer k) {}

    // Un “hit” renvoyé par /search Flask
    public record Hit(String doc, int page, String excerpt, double score) {}
}
