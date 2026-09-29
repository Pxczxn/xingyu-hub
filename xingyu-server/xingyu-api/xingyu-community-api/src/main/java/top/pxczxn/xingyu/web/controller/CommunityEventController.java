package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.EventSubmissionView;
import top.pxczxn.xingyu.community.dto.EventView;
import top.pxczxn.xingyu.community.service.CommunityEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/events")
@RequiredArgsConstructor
public class CommunityEventController {

    private final CommunityEventService eventService;

    @GetMapping
    public List<EventView> list(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return eventService.listActive(limit);
    }

    @GetMapping("/{eventId}")
    public EventView detail(@PathVariable String eventId) {
        return eventService.getById(eventId);
    }

    @GetMapping("/{eventId}/submissions")
    public List<EventSubmissionView> acceptedSubmissions(
            @PathVariable String eventId,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return eventService.listAcceptedSubmissions(eventId, limit);
    }
}
