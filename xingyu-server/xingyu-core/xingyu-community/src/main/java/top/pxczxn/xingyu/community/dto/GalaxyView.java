package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 星系视图（Galaxy Identity Contract，2026-10-10 Phase 4.2）。
 *
 * <p>字段三区分：
 * <ul>
 *   <li><b>公共展示</b>：id/slug/name/official/joinMode/memberCount/contentCount/
 *       description/coverUrl——任何调用方相同；description/coverUrl 的数据列由
 *       V051 提供，迁移执行前恒为 null（契约先行，实体暂不加列以免
 *       MyBatis SELECT * 打在不存在的列上）。</li>
 *   <li><b>viewer 私有</b>：joined 三态（true/false，游客 null）——必须每请求
 *       现查 galaxy_member，禁止放入任何跨请求缓存；仅详情端点填充，
 *       列表端点恒 null（N+1 风险，且列表页不消费该状态）。</li>
 *   <li><b>管理字段</b>：seedKey 等留在 AdminGalaxyController 域，不进本视图。</li>
 * </ul>
 */
@Value
@Builder
public class GalaxyView {
    String id;
    String slug;
    String name;
    boolean official;
    long memberCount;
    /** 加入方式：OPEN 直入 / APPROVAL 需申请。 */
    String joinMode;
    /** 星系简介；V051 执行前恒为 null。 */
    String description;
    /** 星系封面；V051 执行前恒为 null。 */
    String coverUrl;
    /** 已挂载内容数（过滤下架）；仅详情端点填充，列表为 null。 */
    Long contentCount;
    /**
     * viewer 是否已加入。true/false 仅在详情端点且已登录时填充；
     * 游客与列表端点为 null——「未知」不得渲染为「未加入」。
     */
    Boolean joined;
}
