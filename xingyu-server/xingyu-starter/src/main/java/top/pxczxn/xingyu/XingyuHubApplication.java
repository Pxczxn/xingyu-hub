package top.pxczxn.xingyu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import top.pxczxn.xingyu.bootstrap.BootstrapMain;

/**
 * XingyuHub 启动类。带 Bootstrap 业务命令时转交运维 CLI，不启动 Web。
 */
@SpringBootApplication
@EnableScheduling
public class XingyuHubApplication {

    public static void main(String[] args) {
        if (BootstrapMain.isBootstrapInvocation(args)) {
            BootstrapMain.main(args);
            return;
        }
        SpringApplication.run(XingyuHubApplication.class, args);
    }
}
