package com.chat_orchestrator.chat_orchestrator.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsServiceImpl userDetailsService;

    public JwtAuthFilter(JwtService jwtService, UserDetailsServiceImpl userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        final String path   = request.getServletPath();
        final String method = request.getMethod();

        // Laisse passer OPTIONS et /api/auth/**
        if ("OPTIONS".equalsIgnoreCase(method) || path.startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);

        try {
            final String email = jwtService.extractUsername(jwt);
            if (email == null) {
                chain.doFilter(request, response);
                return;
            }

            Authentication existing = SecurityContextHolder.getContext().getAuthentication();
            if (existing != null && existing.isAuthenticated()) {
                chain.doFilter(request, response);
                return;
            }

            // 1) Rôles depuis les claims
            List<String> rolesFromToken = jwtService.extractClaim(jwt, claims -> claims.get("authorities", List.class));
            Collection<SimpleGrantedAuthority> authorities = null;

            if (rolesFromToken != null && !rolesFromToken.isEmpty()) {
                authorities = rolesFromToken.stream()
                        .filter(Objects::nonNull)
                        .map(String::valueOf)
                        .map(SimpleGrantedAuthority::new)   // "ROLE_ADMIN"
                        .collect(Collectors.toList());
            } else {
                String role = jwtService.extractRole(jwt);   // "ADMIN"
                if (role != null) {
                    authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                }
            }

            // 2) Valide le token et récupère l'utilisateur (pour le principal)
            UserDetails user = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(jwt, user)) {
                chain.doFilter(request, response);
                return;
            }

            // 3) Fallback DB si pas d’authorities dans le token
            if (authorities == null || authorities.isEmpty()) {
                authorities = user.getAuthorities().stream()
                        .map(a -> new SimpleGrantedAuthority(a.getAuthority()))
                        .collect(Collectors.toList());
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(user, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);

        } catch (Exception ignored) {
            // on laisse filer -> 401/403 naturels selon la config
        }

        chain.doFilter(request, response);
    }
}
