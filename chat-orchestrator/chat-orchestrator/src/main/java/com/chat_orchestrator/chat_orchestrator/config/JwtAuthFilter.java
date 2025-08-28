package com.chat_orchestrator.chat_orchestrator.config;

import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsServiceImpl userDetailsService;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtService jwtService,
                         UserDetailsServiceImpl userDetailsService,
                         UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        final String path   = request.getServletPath();
        final String method = request.getMethod();

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

            // --- Contrôle BAN directement ici ---
            Optional<User> opt = userRepository.findByEmail(email);
            if (opt.isPresent()) {
                User u = opt.get();
                Instant until = u.getBannedUntil();
                if (until != null && until.isAfter(Instant.now())) {
                    // Banni : on coupe ici avec 403
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write(
                            "{\"error\":\"banned\",\"until\":\"" + until.toString() + "\"}"
                    );
                    return;
                }
            }

            // Rôles depuis les claims (optionnel)
            List<String> rolesFromToken = jwtService.extractClaim(jwt, claims -> claims.get("authorities", List.class));
            Collection<SimpleGrantedAuthority> authorities = null;

            if (rolesFromToken != null && !rolesFromToken.isEmpty()) {
                authorities = rolesFromToken.stream()
                        .filter(Objects::nonNull)
                        .map(String::valueOf)
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());
            } else {
                String role = jwtService.extractRole(jwt);   // "ADMIN"
                if (role != null) {
                    authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                }
            }

            UserDetails user = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(jwt, user)) {
                chain.doFilter(request, response);
                return;
            }

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
            // Laisse filer : 401/403 gérés plus loin
        }

        chain.doFilter(request, response);
    }
}

