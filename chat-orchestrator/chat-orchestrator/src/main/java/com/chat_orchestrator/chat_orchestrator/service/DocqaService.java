package com.chat_orchestrator.chat_orchestrator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DocqaService {

    @Value("${docqa.base-url:http://localhost:5000}")
    private String base;

    private final RestTemplate rt = new RestTemplate();

    public Map<String,Object> ingestFile(MultipartFile file, String ns) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.add("X-Doc-NS", ns);

        ByteArrayResource res = new ByteArrayResource(file.getBytes()) {
            @Override public String getFilename() { return file.getOriginalFilename(); }
        };
        MultiValueMap<String,Object> body = new LinkedMultiValueMap<>();
        body.add("file", res);

        HttpEntity<MultiValueMap<String,Object>> req = new HttpEntity<>(body, headers);
        String url = base + "/ingest?ns=" + URLEncoder.encode(ns, StandardCharsets.UTF_8);
        return rt.postForObject(url, req, Map.class);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String,Object>> search(String q, int k, String ns) {
        Map<String,Object> payload = Map.of("q", q, "k", k, "ns", ns);
        ResponseEntity<List> res = rt.postForEntity(base + "/search", payload, List.class);
        return (List<Map<String,Object>>) res.getBody();
    }

    public Map<String,Object> health() {
        return rt.getForObject(base + "/health", Map.class);
    }

    /** ---- AJOUTS POUR LISTE DES DOCS ---- */

    /** Retourne l’objet { ns, docs: [ {name, pages}, ... ] } depuis Flask */
    @SuppressWarnings("unchecked")
    public Map<String,Object> listDocs(String ns) {
        String url = base + "/docs?ns=" + URLEncoder.encode(ns, StandardCharsets.UTF_8);
        return rt.getForObject(url, Map.class);
    }

    /** Vrai s’il y a au moins 1 doc dans ce namespace */
    public boolean hasDocs(String ns) {
        try {
            Map<String,Object> m = listDocs(ns);
            Object docs = m == null ? null : m.get("docs");
            if (docs instanceof List<?> l) return !l.isEmpty();
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
