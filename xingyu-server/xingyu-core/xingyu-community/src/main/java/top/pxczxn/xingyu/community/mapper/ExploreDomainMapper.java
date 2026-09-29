package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.ExploreDomain;

import java.util.List;

@Mapper
public interface ExploreDomainMapper extends BaseMapper<ExploreDomain> {

    @Select("""
            SELECT * FROM explore_domain
            WHERE domain_type = 'SYSTEM' AND status = 'ACTIVE' AND parent_id IS NULL
            ORDER BY sort_order ASC, name ASC
            """)
    List<ExploreDomain> listRootSystemDomains();

    @Select("""
            SELECT * FROM explore_domain
            WHERE domain_type = 'SYSTEM' AND status = 'ACTIVE' AND parent_id = #{parentId}
            ORDER BY sort_order ASC, name ASC
            """)
    List<ExploreDomain> listChildren(String parentId);

    @Select("""
            SELECT * FROM explore_domain
            WHERE slug = #{slug} AND domain_type = 'SYSTEM' AND status = 'ACTIVE'
            LIMIT 1
            """)
    ExploreDomain findSystemBySlug(String slug);

    @Select("""
            SELECT d.* FROM explore_domain d
            INNER JOIN user_explore_domain ued ON ued.domain_id = d.id
            WHERE ued.user_id = #{userId} AND d.status = 'ACTIVE'
            ORDER BY ued.sort_order ASC, d.name ASC
            """)
    List<ExploreDomain> listByUserExploration(String userId);

    @Select("""
            SELECT * FROM explore_domain
            WHERE owner_user_id = #{userId} AND domain_type = 'PERSONAL' AND status = 'ACTIVE'
            ORDER BY sort_order ASC, name ASC
            """)
    List<ExploreDomain> listPersonalByUser(String userId);

    @Select("""
            SELECT * FROM explore_domain
            WHERE id = #{id} AND status = 'ACTIVE'
            LIMIT 1
            """)
    ExploreDomain findActiveById(String id);

    @Select("""
            SELECT id FROM explore_domain
            WHERE parent_id = #{parentId} AND status = 'ACTIVE'
            """)
    List<String> listChildIds(String parentId);
}
