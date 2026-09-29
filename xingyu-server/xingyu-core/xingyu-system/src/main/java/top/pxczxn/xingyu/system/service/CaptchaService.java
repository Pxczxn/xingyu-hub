package top.pxczxn.xingyu.system.service;

import cn.hutool.captcha.CaptchaUtil;
import cn.hutool.captcha.CircleCaptcha;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.ShearCaptcha;
import cn.hutool.core.util.IdUtil;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 图形验证码服务（管理端与社区共用 Redis 键空间）
 */
@Service
@RequiredArgsConstructor
public class CaptchaService {

    public static final String CAPTCHA_KEY_PREFIX = "captcha:";

    private final SystemConfigHelper configHelper;
    private final StringRedisTemplate redisTemplate;

    public Map<String, Object> generateImageCaptcha() {
        String uuid = IdUtil.simpleUUID();
        String captchaType = configHelper.getCaptchaType();
        String code;
        String imageBase64;

        switch (captchaType) {
            case "math":
                cn.hutool.captcha.generator.MathGenerator mathGenerator =
                        new cn.hutool.captcha.generator.MathGenerator(1);
                LineCaptcha mathCaptcha = CaptchaUtil.createLineCaptcha(130, 48);
                mathCaptcha.setGenerator(mathGenerator);
                mathCaptcha.createCode();
                code = mathCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + mathCaptcha.getImageBase64();
                break;
            case "circle":
                CircleCaptcha circleCaptcha = CaptchaUtil.createCircleCaptcha(130, 48, 4, 20);
                code = circleCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + circleCaptcha.getImageBase64();
                break;
            case "shear":
                ShearCaptcha shearCaptcha = CaptchaUtil.createShearCaptcha(130, 48, 4, 4);
                code = shearCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + shearCaptcha.getImageBase64();
                break;
            default:
                LineCaptcha lineCaptcha = CaptchaUtil.createLineCaptcha(130, 48, 4, 50);
                code = lineCaptcha.getCode();
                imageBase64 = "data:image/png;base64," + lineCaptcha.getImageBase64();
        }

        redisTemplate.opsForValue().set(CAPTCHA_KEY_PREFIX + uuid, code.toLowerCase(), 5, TimeUnit.MINUTES);

        Map<String, Object> result = new HashMap<>();
        result.put("uuid", uuid);
        result.put("img", imageBase64);
        return result;
    }

    public void validateImageCaptcha(String uuid, String code) {
        if (uuid == null || code == null || uuid.isBlank() || code.isBlank()) {
            throw new IllegalArgumentException("请输入验证码");
        }
        String cacheCode = redisTemplate.opsForValue().get(CAPTCHA_KEY_PREFIX + uuid);
        redisTemplate.delete(CAPTCHA_KEY_PREFIX + uuid);
        if (cacheCode == null || !cacheCode.equalsIgnoreCase(code.trim())) {
            throw new IllegalArgumentException("验证码错误或已过期");
        }
    }

    public boolean supportsCommunityCaptcha() {
        return configHelper.isCaptchaEnabled();
    }

    /** 注册与登录均使用图形/算术验证码（滑块、短信验证码类型在社区端回退为图形验证码） */
    public boolean requiresImageCaptcha() {
        return configHelper.isCaptchaEnabled();
    }
}
