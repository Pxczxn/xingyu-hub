package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.ApiTokenCreatedView;
import top.pxczxn.xingyu.community.dto.ApiTokenView;
import top.pxczxn.xingyu.community.entity.CommunityApiToken;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityApiTokenMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityApiTokenService {

    private static final Set<String> ALLOWED_SCOPES = Set.of("read:profile", "read:articles");

    private final CommunityApiTokenMapper tokenMapper;

    public List<ApiTokenView> listMine(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return tokenMapper.listByUserId(user.getId(), limit).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public ApiTokenCreatedView create(CommunityUser user, Map<String, Object> body) {
        String name = trimRequired(String.valueOf(body.getOrDefault("name", "")), "name");
        List<String> scopes = parseScopes(body.get("scopes"));
        String rawToken = "xy_" + TokenSupport.newSessionToken();
        Instant now = Instant.now();

        CommunityApiToken token = new CommunityApiToken();
        token.setId(TokenSupport.newId());
        token.setUserId(user.getId());
        token.setName(name);
        token.setTokenPrefix(rawToken.substring(0, Math.min(12, rawToken.length())));
        token.setTokenHash(TokenSupport.sha256(rawToken));
        token.setScopes(String.join(",", scopes));
        token.setStatus("ACTIVE");
        token.setCreatedAt(now);
        tokenMapper.insert(token);

        return ApiTokenCreatedView.builder()
                .id(token.getId())
                .name(token.getName())
                .token(rawToken)
                .scopes(scopes)
                .build();
    }

    @Transactional
    public void revoke(CommunityUser user, String tokenId) {
        CommunityApiToken token = tokenMapper.selectById(tokenId);
        if (token == null || !user.getId().equals(token.getUserId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if ("REVOKED".equals(token.getStatus())) {
            return;
        }
        token.setStatus("REVOKED");
        token.setRevokedAt(Instant.now());
        tokenMapper.updateById(token);
    }

    public CommunityApiToken requireActiveToken(String authorizationHeader) {
        String raw = extractBearer(authorizationHeader);
        CommunityApiToken token = tokenMapper.findActiveByHash(TokenSupport.sha256(raw));
        if (token == null) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED, "API Token 无效或已撤销");
        }
        tokenMapper.touchLastUsed(token.getId(), Instant.now());
        return token;
    }

    public void requireScope(CommunityApiToken token, String requiredScope) {
        Set<String> scopes = Arrays.stream(token.getScopes().split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
        if (!scopes.contains(requiredScope)) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "Token 权限不足");
        }
    }

    private ApiTokenView toView(CommunityApiToken token) {
        return ApiTokenView.builder()
                .id(token.getId())
                .name(token.getName())
                .tokenPrefix(token.getTokenPrefix())
                .scopes(parseScopeList(token.getScopes()))
                .status(token.getStatus())
                .lastUsedAt(token.getLastUsedAt())
                .createdAt(token.getCreatedAt())
                .build();
    }

    private static List<String> parseScopes(Object raw) {
        if (raw == null) {
            return List.of("read:profile", "read:articles");
        }
        List<String> scopes;
        if (raw instanceof List<?> list) {
            scopes = list.stream().map(String::valueOf).map(String::trim).filter(s -> !s.isBlank()).toList();
        } else {
            scopes = Arrays.stream(String.valueOf(raw).split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
        }
        if (scopes.isEmpty()) {
            throw new FieldContractException("scopes", "至少需要一个权限域");
        }
        for (String scope : scopes) {
            if (!ALLOWED_SCOPES.contains(scope)) {
                throw new FieldContractException("scopes", "权限域无效: " + scope);
            }
        }
        return scopes;
    }

    private static List<String> parseScopeList(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }

    private static String extractBearer(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED, "缺少 Authorization 头");
        }
        String prefix = "Bearer ";
        if (!authorizationHeader.regionMatches(true, 0, prefix, 0, prefix.length())) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED, "Authorization 必须使用 Bearer");
        }
        String token = authorizationHeader.substring(prefix.length()).trim();
        if (token.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED, "Token 不能为空");
        }
        return token;
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "不能为空");
        }
        return raw.trim();
    }
}
