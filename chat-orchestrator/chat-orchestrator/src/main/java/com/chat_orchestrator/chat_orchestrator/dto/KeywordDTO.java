// CHEMIN : src/main/java/com/chat_orchestrator/chat_orchestrator/dto/KeywordDTO.java
package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class KeywordDTO {
    private String keyword;
    private long count;
}
