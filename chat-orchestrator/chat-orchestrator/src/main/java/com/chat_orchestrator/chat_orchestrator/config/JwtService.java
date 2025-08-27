package com.chat_orchestrator.chat_orchestrator.config;

import com.chat_orchestrator.chat_orchestrator.entity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class JwtService {

    // ≥ 32 chars
    private static final String SECRET_KEY = "mysecretkey123456789012345678901234567890";

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractRole(String token) {
        String role = extractClaim(token, c -> c.get("role", String.class));
        if (role != null) return role;
        List<String> auths = extractClaim(token, c -> c.get("authorities", List.class));
        if (auths != null && !auths.isEmpty()) return normalizeRole(String.valueOf(auths.get(0)));
        return null;
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token).getBody();
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> extra = new HashMap<>();
        List<String> authorities = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());
        if (!authorities.isEmpty()) {
            extra.put("authorities", authorities);
            if (authorities.size() == 1) {
                extra.put("role", normalizeRole(authorities.get(0)));
            }
        }
        return generateToken(extra, userDetails);
    }

    public String generateToken(UserDetails userDetails, com.chat_orchestrator.chat_orchestrator.entity.Role role) {
        Map<String, Object> extra = new HashMap<>();
        extra.put("role", role.name());
        extra.put("authorities", List.of("ROLE_" + role.name()));
        return generateToken(extra, userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + 1000L * 60 * 60 * 24); // 24h

        return Jwts.builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        Date exp = extractClaim(token, Claims::getExpiration);
        return exp.before(new Date());
    }

    private Key getSignKey() {
        return Keys.hmacShaKeyFor(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeRole(String r) {
        if (r == null) return null;
        r = r.toUpperCase(Locale.ROOT);
        return r.startsWith("ROLE_") ? r.substring(5) : r;
    }
}
