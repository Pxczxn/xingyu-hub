package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.EmailVerificationToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;

@Mapper
public interface EmailVerificationTokenMapper extends BaseMapper<EmailVerificationToken> {

    @Select("""
            SELECT * FROM email_verification_token
            WHERE token_hash = #{tokenHash} AND purpose = #{purpose}
            LIMIT 1
            """)
    EmailVerificationToken findByTokenHashAndPurpose(String tokenHash, String purpose);

    /**
     * 以「WHERE consumed_at IS NULL」为条件的原子消费（2026-10-08 新增）。
     *
     * <p>存在的理由：单纯「先查后写」在并发确认同一封邮件时会让两个请求都通过
     * {@code consumedAt == null} 检查，然后都去改邮箱——后写的覆盖先写的，
     * 而 {@code new_email} 可能不同，结果不确定。这里让数据库自己裁决：
     * 只有把 {@code consumed_at} 从 NULL 改成非 NULL 的那一个请求会返回 1。
     *
     * <p>为什么条件里还要带 {@code expires_at > now}：让「过期」在数据库层就
     * 不可能被消费掉，避免应用层时钟与数据库时钟的细微差异把过期 token 放行。
     *
     * @return 1 = 本请求赢得了这次消费；0 = 已被并发请求消费或已过期
     */
    @Update("""
            UPDATE email_verification_token
            SET consumed_at = #{now}
            WHERE id = #{id} AND consumed_at IS NULL AND expires_at > #{now}
            """)
    int consumeOnce(@Param("id") String id, @Param("now") Instant now);
}
