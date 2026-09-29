package top.pxczxn.xingyu.sms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.sms.entity.SmsLog;
import org.apache.ibatis.annotations.Mapper;

/**
 * 短信发送记录 Mapper
 */
@Mapper
public interface SmsLogMapper extends BaseMapper<SmsLog> {
}
