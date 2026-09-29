package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.EmailVerificationToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface EmailVerificationTokenMapper extends BaseMapper<EmailVerificationToken> {

    @Select("""
            SELECT * FROM email_verification_token
            WHERE token_hash = #{tokenHash} AND purpose = #{purpose}
            LIMIT 1
            """)
    EmailVerificationToken findByTokenHashAndPurpose(String tokenHash, String purpose);
}
