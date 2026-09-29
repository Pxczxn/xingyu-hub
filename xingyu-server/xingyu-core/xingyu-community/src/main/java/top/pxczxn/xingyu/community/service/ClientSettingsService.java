package top.pxczxn.xingyu.community.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ClientSettingsService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final CommunityProfileMapper profileMapper;
    private final ObjectMapper objectMapper;

    public Map<String, Object> getSettings(CommunityUser user) {
        CommunityProfile profile = requireProfile(user.getId());
        return parseSettings(profile.getSettingsJson());
    }

    @Transactional
    public Map<String, Object> updateSettings(CommunityUser user, Map<String, Object> body) {
        CommunityProfile profile = requireProfile(user.getId());
        Map<String, Object> current = parseSettings(profile.getSettingsJson());
        if (body != null) {
            for (Map.Entry<String, Object> entry : body.entrySet()) {
                if (entry.getValue() == null) {
                    current.remove(entry.getKey());
                } else {
                    current.put(entry.getKey(), entry.getValue());
                }
            }
        }
        try {
            profile.setSettingsJson(objectMapper.writeValueAsString(current));
        } catch (Exception ex) {
            throw new ContractException(ErrorCode.INTERNAL_ERROR, "偏好保存失败");
        }
        profileMapper.updateById(profile);
        return current;
    }

    public boolean isReadingHistoryEnabled(CommunityUser user) {
        return readBooleanSetting(user, "readingHistoryEnabled", true);
    }

    public boolean isSearchHistoryEnabled(CommunityUser user) {
        return readBooleanSetting(user, "searchHistoryEnabled", true);
    }

    public boolean isPersonalizedRecommendationEnabled(CommunityUser user) {
        return readBooleanSetting(user, "personalizedRecommendationEnabled", true);
    }

    private boolean readBooleanSetting(CommunityUser user, String key, boolean defaultValue) {
        Object raw = getSettings(user).get(key);
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(raw));
    }

    private CommunityProfile requireProfile(String userId) {
        CommunityProfile profile = profileMapper.findByUserId(userId);
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "资料不存在");
        }
        return profile;
    }

    private Map<String, Object> parseSettings(String raw) {
        if (raw == null || raw.isBlank()) {
            return new HashMap<>();
        }
        try {
            return new HashMap<>(objectMapper.readValue(raw, MAP_TYPE));
        } catch (Exception ex) {
            return new HashMap<>();
        }
    }
}
