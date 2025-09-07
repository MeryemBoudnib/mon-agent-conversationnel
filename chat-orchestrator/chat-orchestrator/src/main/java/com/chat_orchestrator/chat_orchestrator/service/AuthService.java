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
                .active(true) // utilisateur actif par défaut
                .build();
        userRepository.save(user);

        // Génère un JWT (votre JwtService peut avoir plusieurs surcharges)
        String token = jwtService.generateToken(user, user.getRole());

        // ➜ On renvoie aussi role et active pour que le front sache si le compte est désactivé
        return new AuthResponse(token, user.getRole(), user.getActive() != null && user.getActive());
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email, request.password)
        );

        User user = userRepository.findByEmail(request.email).orElseThrow();

        // Génère un JWT (utilise l’implémentation existante)
        String token = jwtService.generateToken((UserDetails) user);

        // ➜ Front recevra token + role + active (si active == false, on affiche une alerte côté UI)
        return new AuthResponse(token, user.getRole(), user.getActive() != null && user.getActive());
    }

    /** DEV ONLY : reset direct sans token (email + new password) */
    public void resetPasswordDev(String email, String newRawPassword) {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
        u.setPassword(passwordEncoder.encode(newRawPassword));
        userRepository.save(u);
    }
}
