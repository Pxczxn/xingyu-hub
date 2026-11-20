package top.pxczxn.xingyu.community.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.community.entity.CommunityProfile;

import java.util.Map;

public final class ProfileSettingsSupport {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ProfileSettingsSupport() {
    }

    public static String resolveAvatar(CommunityProfile profile) {
        if (profile == null || profile.getSettingsJson() == null || profile.getSettingsJson().isBlank()) {
            return null;
        }
        try {
            Map<String, Object> settings = OBJECT_MAPPER.readValue(profile.getSettingsJson(), MAP_TYPE);
            Object raw = settings.get("avatar");
            if (raw == null) {
                return null;
            }
            String value = raw.toString().trim();
            return value.isEmpty() ? null : value;
        } catch (Exception ex) {
            return null;
        }
    }

    public static String putAvatar(String settingsJson, String avatar) {
        Map<String, Object> settings;
        if (settingsJson == null || settingsJson.isBlank()) {
            settings = new java.util.LinkedHashMap<>();
        } else {
            try {
                settings = OBJECT_MAPPER.readValue(settingsJson, MAP_TYPE);
                if (settings == null) {
                    settings = new java.util.LinkedHashMap<>();
                }
            } catch (Exception ex) {
                settings = new java.util.LinkedHashMap<>();
            }
        }
        if (avatar == null || avatar.isBlank()) {
            settings.remove("avatar");
        } else {
            settings.put("avatar", avatar.trim());
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(settings);
        } catch (Exception ex) {
            return settingsJson;
        }
    }
}
