// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/KeywordCountDTO.java
package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class KeywordCountDTO {
    private String word;
    private long count;
}
