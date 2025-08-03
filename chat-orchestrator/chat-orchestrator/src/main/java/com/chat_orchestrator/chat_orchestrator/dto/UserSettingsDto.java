package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.Data;

@Data
public class UserSettingsDto {
    private String firstName;
    private String lastName;
    private String oldPassword;
    private String newPassword;
}
