package com.chat_orchestrator.chat_orchestrator.config;

import com.chat_orchestrator.chat_orchestrator.entity.Role;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@RequiredArgsConstructor
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        final String adminEmail = "admin@test.com";

        userRepository.findByEmail(adminEmail).ifPresentOrElse(
                u -> System.out.println("✅ Admin déjà présent: " + adminEmail),
                () -> {
                    User admin = User.builder()
                            .firstName("Admin")
                            .lastName("Root")
                            .email(adminEmail)
                            .password(passwordEncoder.encode("Passw0rd!"))
                            .role(Role.ADMIN)
                            .build();
                    userRepository.save(admin);
                    System.out.println("🆕 Admin créé: " + adminEmail + " / Passw0rd!");
                }
        );
    }
}
