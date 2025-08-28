package com.chat_orchestrator.chat_orchestrator.config;

import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    /** Utilisé par Spring Security */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        var u = loadDomainUserByEmail(email);
        return toSpringUser(u);
    }

    /** Réutilisé par le filtre pour accéder aux champs domaine (bannedUntil, etc.) */
    public User loadDomainUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé : " + email));
    }

    /** Convertit User (domaine) en UserDetails Spring */
    public UserDetails toSpringUser(User u) {
        return org.springframework.security.core.userdetails.User.builder()
                .username(u.getEmail())
                .password(u.getPassword())
                .roles(u.getRole().name())
                .build();
    }
}
