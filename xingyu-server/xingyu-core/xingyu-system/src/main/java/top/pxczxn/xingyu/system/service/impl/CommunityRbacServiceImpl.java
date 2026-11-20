package top.pxczxn.xingyu.system.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.system.mapper.CommunityRbacMapper;
import top.pxczxn.xingyu.system.rbac.CommunityGrantedRole;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CommunityRbacServiceImpl implements CommunityRbacService {

    private final CommunityRbacMapper communityRbacMapper;

    @Override
    public List<CommunityGrantedRole> listRoles(String communityUserId) {
        if (isBlank(communityUserId)) {
            return List.of();
        }
        List<CommunityGrantedRole> roles = communityRbacMapper.selectRolesByCommunityUserId(communityUserId);
        return roles == null ? List.of() : List.copyOf(roles);
    }

    @Override
    public List<String> listRoleCodes(String communityUserId) {
        return listRoles(communityUserId).stream()
                .map(CommunityGrantedRole::getCode)
                .filter(code -> !isBlank(code))
                .toList();
    }

    @Override
    public List<String> listPermissions(String communityUserId) {
        if (isBlank(communityUserId)) {
            return List.of();
        }
        List<String> permissions = communityRbacMapper.selectPermissionsByCommunityUserId(communityUserId);
        if (permissions == null || permissions.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String permission : permissions) {
            if (!isBlank(permission)) {
                unique.add(permission);
            }
        }
        return List.copyOf(unique);
    }

    @Override
    public boolean hasRole(String communityUserId, String roleCode) {
        if (isBlank(roleCode)) {
            return false;
        }
        return listRoleCodes(communityUserId).contains(roleCode);
    }

    @Override
    public boolean hasPermission(String communityUserId, String permission) {
        if (isBlank(permission)) {
            return false;
        }
        return listPermissions(communityUserId).contains(permission);
    }

    @Override
    public List<String> listCommunityUserIdsByRoleCode(String roleCode) {
        if (isBlank(roleCode)) {
            return List.of();
        }
        List<String> ids = communityRbacMapper.selectCommunityUserIdsByRoleCode(roleCode);
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream().filter(id -> !isBlank(id)).distinct().toList();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
