// src/main/java/.../controller/DocqaController.java
package com.chat_orchestrator.chat_orchestrator.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/docqa")
@CrossOrigin(origins = "http://localhost:4200")
public class DocqaController {

    private final RestTemplate http = new RestTemplate();

    @Value("${docqa.base-url:http://localhost:5000}")
    private String docqaBase;

    private String ns() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a != null && a.isAuthenticated() && !"anonymousUser".equals(a.getPrincipal()))
                ? a.getName() : "guest";
    }

    @PostMapping(value = "/ingest", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> ingest(@RequestPart("file") MultipartFile file) throws Exception {
        String ns = ns();
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("ns", ns);
        form.add("file", new MultipartInputStreamFileResource(
                file.getInputStream(), file.getOriginalFilename(), file.getSize()));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        System.out.println("📥 /api/docqa/ingest ns=" + ns + " file=" + file.getOriginalFilename());
        ResponseEntity<Map> resp = http.postForEntity(
                URI.create(docqaBase + "/ingest"),
                new HttpEntity<>(form, headers),
                Map.class
        );
        return ResponseEntity.status(resp.getStatusCode()).body(resp.getBody());
    }

    @GetMapping("/list")
    public ResponseEntity<?> list() {
        String ns = ns();
        String url = docqaBase + "/docs?ns=" + URLEncoder.encode(ns, StandardCharsets.UTF_8);
        Map<?, ?> res = http.getForObject(url, Map.class);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping
    public ResponseEntity<?> delete(@RequestParam("name") String name) {
        String ns = ns();
        String url = docqaBase + "/docs?ns=" + URLEncoder.encode(ns, StandardCharsets.UTF_8)
                + "&name=" + URLEncoder.encode(name, StandardCharsets.UTF_8);
        http.delete(url);
        return ResponseEntity.noContent().build();
    }
}
