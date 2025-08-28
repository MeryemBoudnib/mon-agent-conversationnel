package com.chat_orchestrator.chat_orchestrator.controller;

import com.chat_orchestrator.chat_orchestrator.dto.*;
import com.chat_orchestrator.chat_orchestrator.entity.Role;
import com.chat_orchestrator.chat_orchestrator.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    // ------- STATS -------
    @GetMapping("/stats")
    public ResponseEntity<AdminStatsDTO> stats() {
        return ResponseEntity.ok(adminService.stats());
    }

    // ------- USERS -------
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDTO>> users() {
        return ResponseEntity.ok(adminService.listUsers());
    }

    @PostMapping("/users/{id}/role")
    public ResponseEntity<Void> setRole(@PathVariable Long id, @RequestParam Role role) {
        adminService.setRole(id, role);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id) {
        adminService.resetPassword(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{id}/ban")
    public ResponseEntity<Void> banUser(@PathVariable Long id,
                                        @RequestBody BanRequest req) {
        if (req == null || req.until() == null)
            return ResponseEntity.badRequest().build();
        adminService.banUser(id, req.until());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{id}/unban")
    public ResponseEntity<Void> unbanUser(@PathVariable Long id) {
        adminService.unbanUser(id);
        return ResponseEntity.ok().build();
    }

    public record BanRequest(@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate until) {}

    // ------- CONVERSATIONS -------
    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationSummaryDTO>> conversations(
            @RequestParam(required = false) Long userId
    ) {
        return ResponseEntity.ok(adminService.listConversations(userId));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        adminService.deleteConversation(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/conversations")
    public ResponseEntity<Void> deleteConversationsByUser(@PathVariable Long userId) {
        adminService.deleteConversationsByUser(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/conversations/export")
    public ResponseEntity<byte[]> exportConversations(@RequestParam Long userId) {
        String csv = adminService.exportConversationsCsv(userId);
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"conversations_user_" + userId + ".csv\"");
        return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
    }

    // ------- DASHBOARD / SIGNUPS -------
    @GetMapping("/signups-per-day")
    public ResponseEntity<List<UserSignupDTO>> signupsPerDay(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(adminService.signupsPerDay(from, to));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardDTO> dashboard(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "10") int topN
    ) {
        return ResponseEntity.ok(adminService.dashboard(from, to, topN));
    }
}
