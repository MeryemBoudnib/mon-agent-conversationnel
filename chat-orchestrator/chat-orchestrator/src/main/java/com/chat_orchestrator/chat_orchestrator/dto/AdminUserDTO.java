package com.chat_orchestrator.chat_orchestrator.dto;

import com.chat_orchestrator.chat_orchestrator.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AdminUserDTO {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private Role role;
    private long conversations; // nombre de conv du user
}
