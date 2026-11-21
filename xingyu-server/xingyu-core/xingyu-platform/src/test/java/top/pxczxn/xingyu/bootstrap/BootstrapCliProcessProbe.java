package top.pxczxn.xingyu.bootstrap;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.support.GenericApplicationContext;
import top.pxczxn.xingyu.core.bootstrap.BootstrapService;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.LockSupport;

/**
 * 子进程探针：用带非守护线程的假上下文跑 {@link BootstrapMain#execute}，
 * 验证关闭上下文后 JVM 能自行退出。
 */
public final class BootstrapCliProcessProbe {

    static final String KEEPALIVE_THREAD = "bootstrap-cli-keepalive-probe";

    private BootstrapCliProcessProbe() {
    }

    public static void main(String[] args) {
        boolean fail = false;
        List<String> forwarded = new ArrayList<>();
        for (String arg : args) {
            if ("--probe-fail".equals(arg)) {
                fail = true;
            } else {
                forwarded.add(arg);
            }
        }
        boolean throwNotFound = fail;
        System.exit(BootstrapMain.execute(
                forwarded.toArray(String[]::new),
                ignored -> openProbeContext(throwNotFound)));
    }

    static GenericApplicationContext openProbeContext(boolean throwNotFound) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.registerBean(KeepAlive.class);
        context.registerBean(BootstrapService.class, () -> stub(throwNotFound));
        context.refresh();
        return context;
    }

    static BootstrapService stub(boolean throwNotFound) {
        return new BootstrapService(null, null, null, null, null) {
            @Override
            public void grantCommunityAdmin() {
                if (throwNotFound) {
                    throw new IllegalStateException("community account not found");
                }
            }

            @Override
            public void init() {
            }

            @Override
            public void recover() {
            }

            @Override
            public void revokeRecovery() {
            }
        };
    }

    static final class KeepAlive implements DisposableBean {
        private volatile boolean running = true;
        private final Thread thread;

        KeepAlive() {
            thread = new Thread(() -> {
                while (running) {
                    LockSupport.parkNanos(50_000_000L);
                }
            }, KEEPALIVE_THREAD);
            thread.setDaemon(false);
            thread.start();
        }

        @Override
        public void destroy() {
            running = false;
            LockSupport.unpark(thread);
            try {
                thread.join(5_000);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
