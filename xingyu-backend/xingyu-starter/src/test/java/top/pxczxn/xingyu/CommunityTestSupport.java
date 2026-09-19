package top.pxczxn.xingyu;

import top.pxczxn.xingyu.system.service.SysConfigGroupService;

/**
 * 集成测试辅助：只负责"测试数据/配置 fixture"，<b>不负责 schema</b>。
 *
 * <p>本类曾经承担过 schema 自愈职责（{@code ensureGrowthSchema} / {@code ensureSocialGapSchema}
 * 用精简 DDL 建表、再用裸 {@code ALTER TABLE} 补列）。那段历史留下了一处真实事故：
 * 测试代码抢先落地的精简表让后续迁移的建表语句（{@code IF NOT EXISTS} 形式）全部退化成空操作，
 * 索引与注释永久缺失，而迁移台账仍显示"已应用"——即"测试全绿但结构已偏离 baseline"。
 *
 * <p>因此约定：<b>测试源码不得包含任何 schema 修改语句</b>。结构是否正确由
 * {@link TestSchemaAssertions} 以只读方式断言，结构不对就失败，绝不自动修表。
 * 该约定由 {@code TestSourceSchemaMutationGuardTest} 静态扫描强制保证，防止被重新写回。
 */
final class CommunityTestSupport {

    private CommunityTestSupport() {
    }

    /**
     * 确保社区注册/登录开关处于测试所需状态。
     *
     * <p>这是<b>测试配置 fixture</b>，操作的是 {@code sys_config_group} 的业务数据，
     * 不涉及 schema，因此继续保留。
     */
    static void ensureRegistrationOpen(SysConfigGroupService configGroupService) {
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.saveConfig(
                "login",
                "{\"captchaEnabled\":false,\"captchaType\":\"image\",\"maxRetryCount\":5,\"lockTime\":30,\"rememberMe\":true,\"singleLogin\":false}");
        configGroupService.refreshCache();
    }
}
