// src/main/java/com/chat_orchestrator/chat_orchestrator/security/BannedException.java
package com.chat_orchestrator.chat_orchestrator.security;

import org.springframework.security.core.AuthenticationException;

public class BannedException extends AuthenticationException {
    public BannedException(String msg) { super(msg); }
}
