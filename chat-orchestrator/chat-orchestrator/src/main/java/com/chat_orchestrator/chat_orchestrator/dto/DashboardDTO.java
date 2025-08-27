package com.chat_orchestrator.chat_orchestrator.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class DashboardDTO {
    private List<PointDTO> messagesPerDay;
    private StatDTO avgConversationMinutes;
    private List<HeatCellDTO> heatmap;
    private List<KeywordCountDTO> topKeywords;
}
