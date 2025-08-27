// src/main/java/com/chat_orchestrator/chat_orchestrator/dto/projection/UserSignupProjection.java
package com.chat_orchestrator.chat_orchestrator.dto.projection;

import java.time.LocalDate;

public interface UserSignupProjection {
    LocalDate getDate();
    long getCount();
}
