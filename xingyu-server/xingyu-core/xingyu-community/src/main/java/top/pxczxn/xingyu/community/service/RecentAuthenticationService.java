package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.AccountStatusView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.RecentAuthentication;
import top.pxczxn.xingyu.community.mapper.RecentAuthenticationMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecentAuthenticationService {

    private static final int VALID_MINUTES = 15;

    private final RecentAuthenticationMapper recentAuthMapper;

    @Transactional
    public Map<String, Object> reAuthenticate(CommunityUser user, CommunitySession session, String password) {
        if (!PasswordSupport.matches(password, user.getPasswordHash())) {
            throw new ContractException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        Instant now = Instant.now();
        RecentAuthentication record = new RecentAuthentication();
        record.setId(TokenSupport.newId());
        record.setUserId(user.getId());
        record.setSessionId(session.getId());
        record.setVerifiedAt(now);
        record.setExpiresAt(now.plus(VALID_MINUTES, ChronoUnit.MINUTES));
        recentAuthMapper.insert(record);
        return Map.of(
                "recentAuthId", record.getId(),
                "expiresAt", record.getExpiresAt().toString());
    }

    public void requireValidRecentAuth(CommunityUser user, CommunitySession session, String recentAuthId) {
        if (recentAuthId == null || recentAuthId.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "请先完成身份再认证");
        }
        RecentAuthentication record = recentAuthMapper.findByIdAndUserAndSession(
                recentAuthId, user.getId(), session.getId());
        if (record == null || record.getExpiresAt().isBefore(Instant.now())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "身份再认证已过期，请重新验证");
        }
    }

    /**
     * 校验并<b>原子消费</b>一次 grant（2026-10-08 新增，供不可逆操作使用）。
     *
     * <p><b>与 {@link #requireValidRecentAuth} 的区别</b>：后者只校验不消费，所以同一个 grant
     * 在 15 分钟内可以反复用。这对邮箱换绑是可接受的（重复申请只是重发一封确认信，幂等），
     * 但对「停用账号」不可接受 —— 那是一次性、不可逆的动作，一个被抄走的 grant id
     * 就能被反复触发。这个方法让 grant 用一次就作废。
     *
     * <p><b>为什么不用「先查后写」</b>：并发两个请求都可能查到未消费然后双双通过。
     * 这里把 {@code consumed_at IS NULL} 放进 UPDATE 的 WHERE，让数据库裁决：
     * 返回 1 的是赢家，返回 0 的（含并发输家与已过期）一律拒绝。
     *
     * <p>失败文案刻意区分两种情况，因为用户动作不同：
     * 从未消费过 → 让他去重新验证；已经用过 → 告诉他刚才那次已经用掉了，重新验证才能再做。
     */
    @Transactional
    public void requireAndConsumeRecentAuth(
            CommunityUser user, CommunitySession session, String recentAuthId) {
        if (recentAuthId == null || recentAuthId.isBlank()) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "请先完成身份再认证");
        }
        Instant now = Instant.now();
        RecentAuthentication record = recentAuthMapper.findByIdAndUserAndSession(
                recentAuthId, user.getId(), session.getId());
        if (record == null || record.getExpiresAt().isBefore(now)) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "身份再认证已过期，请重新验证");
        }
        int consumed = recentAuthMapper.consumeOnce(
                record.getId(), user.getId(), session.getId(), now);
        if (consumed == 0) {
            // 走到这里只有两种可能：并发输家，或 grant 已被前一次高风险操作用掉。
            if (record.getConsumedAt() != null) {
                throw new ContractException(
                        ErrorCode.AUTH_FORBIDDEN, "身份再认证已被使用，请重新验证身份后再试");
            }
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN, "身份再认证已过期，请重新验证");
        }
    }

    public AccountStatusView accountStatus(CommunityUser user) {
        String status = user.getStatus();
        boolean active = "ACTIVE".equals(status);
        return AccountStatusView.builder()
                .status(status)
                .canChangeEmail(active)
                .canChangePassword(active)
                .requiresReAuth(active)
                .allowedActions(active ? List.of("CHANGE_EMAIL", "CHANGE_PASSWORD", "MANAGE_SESSIONS") : List.of())
                .build();
    }
}
