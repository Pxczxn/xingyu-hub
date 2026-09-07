package top.pxczxn.xingyu.bootstrap;

import top.pxczxn.xingyu.core.bootstrap.BootstrapService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication(scanBasePackages = "top.pxczxn.xingyu")
public class BootstrapMain {

    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("usage: init | recover | revoke-recovery");
            System.exit(1);
        }
        SpringApplication app = new SpringApplication(BootstrapMain.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        app.setAdditionalProfiles("dev");
        ConfigurableApplicationContext context = app.run(args);
        BootstrapService service = context.getBean(BootstrapService.class);
        switch (args[0]) {
            case "init" -> service.init();
            case "recover" -> service.recover();
            case "revoke-recovery" -> service.revokeRecovery();
            default -> throw new IllegalArgumentException("unknown command: " + args[0]);
        }
        SpringApplication.exit(context);
    }
}
