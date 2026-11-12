package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
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
            <script>
            SELECT * FROM explore_domain
            WHERE domain_type = 'SYSTEM' AND status = 'ACTIVE' AND parent_id IN
            <foreach collection='parentIds' item='parentId' open='(' separator=',' close=')'>#{parentId}</foreach>
            ORDER BY sort_order ASC, name ASC
            </script>
            """)
    List<ExploreDomain> listSystemChildrenByParentIds(@Param("parentIds") List<String> parentIds);

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
            <script>
            SELECT * FROM explore_domain
            WHERE status = 'ACTIVE' AND id IN
            <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            </script>
            """)
    List<ExploreDomain> listActiveByIds(@Param("ids") List<String> ids);

    @Select("""
            SELECT id FROM explore_domain
            WHERE parent_id = #{parentId} AND status = 'ACTIVE'
            """)
    List<String> listChildIds(String parentId);

    @Select("""
            <script>
            SELECT id, parent_id FROM explore_domain
            WHERE status = 'ACTIVE' AND parent_id IN
            <foreach collection='parentIds' item='parentId' open='(' separator=',' close=')'>#{parentId}</foreach>
            </script>
            """)
    List<ExploreDomain> listActiveChildrenByParentIds(@Param("parentIds") List<String> parentIds);

    @Update("""
            UPDATE explore_domain
            SET status = 'ARCHIVED'
            WHERE owner_user_id = #{userId}
              AND domain_type = 'PERSONAL'
              AND status = 'ACTIVE'
            """)
    int archiveAllPersonalByUser(String userId);

    @Update("""
            <script>
            UPDATE explore_domain
            SET status = 'ARCHIVED'
            WHERE owner_user_id = #{userId}
              AND domain_type = 'PERSONAL'
              AND status = 'ACTIVE'
              AND name NOT IN
            <foreach collection='names' item='name' open='(' separator=',' close=')'>#{name}</foreach>
            </script>
            """)
    int archivePersonalExceptNames(@Param("userId") String userId, @Param("names") List<String> names);

    @Insert("""
            <script>
            INSERT INTO explore_domain (
              id, seed_key, slug, name, description, icon, parent_id,
              domain_type, owner_user_id, status, sort_order, created_at
            ) VALUES
            <foreach collection='domains' item='domain' separator=','>
            (
              #{domain.id}, #{domain.seedKey}, #{domain.slug}, #{domain.name},
              #{domain.description}, #{domain.icon}, #{domain.parentId},
              #{domain.domainType}, #{domain.ownerUserId}, #{domain.status},
              #{domain.sortOrder}, #{domain.createdAt}
            )
            </foreach>
            </script>
            """)
    int insertAll(@Param("domains") List<ExploreDomain> domains);
}
