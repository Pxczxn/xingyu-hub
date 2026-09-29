package top.pxczxn.xingyu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * XingyuHub 启动类
 */
@SpringBootApplication
@EnableScheduling
public class XingyuHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(XingyuHubApplication.class, args);
    }
}
