package com.chat_orchestrator.chat_orchestrator.config;

import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.security.web.servlet.util.matcher.MvcRequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.handler.HandlerMappingIntrospector;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsServiceImpl userDetailsService;
    private final UserRepository userRepository;

    /** Endpoints publics ignorés par le filtre (nouvelle API MvcRequestMatcher) */
    private final RequestMatcher publicEndpoints;

    public JwtAuthFilter(JwtService jwtService,
                         UserDetailsServiceImpl userDetailsService,
                         UserRepository userRepository,
                         @Qualifier("mvcHandlerMappingIntrospector")
                         HandlerMappingIntrospector introspector) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;

        this.publicEndpoints = new OrRequestMatcher(
                new MvcRequestMatcher(introspector, "/api/auth/**"),
                new MvcRequestMatcher(introspector, "/error"),
                new MvcRequestMatcher(introspector, "/actuator/**")
        );
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        return publicEndpoints.matches(request);
    }

    @SuppressWarnings("unchecked")
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

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

            Optional<User> opt = userRepository.findByEmail(email);
            if (opt.isPresent()) {
                User u = opt.get();

                if (Boolean.FALSE.equals(u.getActive())) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"disabled\"}");
                    return;
                }

                Instant until = u.getBannedUntil();
                if (until != null && until.isAfter(Instant.now())) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"banned\",\"until\":\"" + until + "\"}");
                    return;
                }
            }

            Collection<SimpleGrantedAuthority> authorities;
            List<String> rolesFromToken = jwtService.extractClaim(jwt, claims -> (List<String>) claims.get("authorities"));

            if (rolesFromToken != null && !rolesFromToken.isEmpty()) {
                authorities = rolesFromToken.stream()
                        .filter(Objects::nonNull)
                        .map(String::valueOf)
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());
            } else {
                String role = jwtService.extractRole(jwt);
                if (role != null) {
                    authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                } else {
                    authorities = new ArrayList<>();
                }
            }

            UserDetails user = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(jwt, user)) {
                chain.doFilter(request, response);
                return;
            }

            if (authorities.isEmpty()) {
                authorities = user.getAuthorities().stream()
                        .map(a -> new SimpleGrantedAuthority(a.getAuthority()))
                        .collect(Collectors.toList());
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(user, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);

        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
        }

        chain.doFilter(request, response);
    }
}
