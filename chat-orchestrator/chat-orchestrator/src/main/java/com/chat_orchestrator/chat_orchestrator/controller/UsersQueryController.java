// CHEMIN: src/main/java/com/chat_orchestrator/chat_orchestrator/controller/UsersQueryController.java
package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.entity.User;
import com.chat_orchestrator.chat_orchestrator.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200") // utile si tu n'utilises PAS de proxy Angular
public class UsersQueryController {

    private final UserRepository repo;

    // DTO minimal pour le front
    public record UserDto(Long id, String email, String role) {
        static UserDto of(User u) { return new UserDto(u.getId(), u.getEmail(), u.getRole().name()); }
    }
    public record PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size) {}

    @GetMapping("/users")
    public PageDto<UserDto> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "id") String sort,
            @RequestParam(defaultValue = "asc") String dir,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role
    ) {
        Sort.Direction direction = "desc".equalsIgnoreCase(dir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)),
                Sort.by(direction, sort));

        // simple: pas de filtre (ajoute Specifications si tu veux)
        Page<User> p = repo.findAll(pageable);

        List<UserDto> content = p.getContent().stream().map(UserDto::of).toList();
        return new PageDto<>(content, p.getTotalElements(), p.getTotalPages(), p.getNumber(), p.getSize());
    }
}
