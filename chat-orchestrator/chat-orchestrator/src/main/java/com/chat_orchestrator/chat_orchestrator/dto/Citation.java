package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Citation {
    private String source;   // ex: nom de fichier ou URL
    private String snippet;  // extrait pertinent
}
