package com.chat_orchestrator.chat_orchestrator.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;

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
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getServletPath();

        // 1) skip all public endpoints
        if ( path.startsWith("/api/auth/")
                || path.startsWith("/api/chat/")
                || path.startsWith("/api/conversations/") ) {
            // just let the chain go on to the controller (or to the permitAll rule)
            filterChain.doFilter(request, response);
            return;
        }

        // 2) if there is an Authorization header, try to validate it
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String jwt = authHeader.substring(7);
                String userEmail = jwtService.extractUsername(jwt);
                if (userEmail != null
                        && SecurityContextHolder.getContext().getAuthentication() == null
                        && jwtService.isTokenValid(jwt, userDetailsService.loadUserByUsername(userEmail))) {
                    var authToken = new UsernamePasswordAuthenticationToken(
                            userDetailsService.loadUserByUsername(userEmail),
                            null,
                            userDetailsService.loadUserByUsername(userEmail).getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (Exception ex) {
                // invalid token → we silently ignore and let Spring handle (it will 401/403 if needed)
            }
        }

        // 3) in all cases, let the request continue
        filterChain.doFilter(request, response);
    }

}
