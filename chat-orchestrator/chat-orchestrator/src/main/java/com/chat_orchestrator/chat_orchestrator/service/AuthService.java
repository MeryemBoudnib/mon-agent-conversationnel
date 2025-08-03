package com.chat_orchestrator.chat_orchestrator.service;

import com.chat_orchestrator.chat_orchestrator.config.JwtService;
import com.chat_orchestrator.chat_orchestrator.dto.AuthRequest;
import com.chat_orchestrator.chat_orchestrator.dto.AuthResponse;
import com.chat_orchestrator.chat_orchestrator.dto.RegisterRequest;
import com.chat_orchestrator.chat_orchestrator.entity.Role;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest request) {
        User user = User.builder()
                .firstName(request.firstName)
                .lastName(request.lastName)
                .email(request.email)
                .password(passwordEncoder.encode(request.password))
                .role(Role.USER)
                .build();
        userRepository.save(user);
        String token = jwtService.generateToken((UserDetails) user);
        return new AuthResponse(token);
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email, request.password));
        User user = userRepository.findByEmail(request.email).orElseThrow();
        String token = jwtService.generateToken((UserDetails) user);
        return new AuthResponse(token);
    }
}
