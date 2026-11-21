package top.pxczxn.xingyu.bootstrap;

import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BootstrapMainLifecycleTest {

    private static final String[] GRANT_PROD = {
            "grant-admin", "--spring.profiles.active=prod"
    };

    @Test
    void grantAdminSuccessClosesContextAndReturnsZero() {
        AtomicReference<ConfigurableApplicationContext> held = new AtomicReference<>();
        int code = BootstrapMain.execute(GRANT_PROD, args -> {
            ConfigurableApplicationContext ctx = BootstrapCliProcessProbe.openProbeContext(false);
            held.set(ctx);
            return ctx;
        });
        assertEquals(0, code);
        assertFalse(held.get().isActive());
        assertFalse(keepaliveAlive(), "keepalive thread must stop after context close");
    }

    @Test
    void grantAdminMissingAccountClosesContextAndReturnsNonZero() {
        AtomicReference<ConfigurableApplicationContext> held = new AtomicReference<>();
        int code = BootstrapMain.execute(GRANT_PROD, args -> {
            ConfigurableApplicationContext ctx = BootstrapCliProcessProbe.openProbeContext(true);
            held.set(ctx);
            return ctx;
        });
        assertEquals(BootstrapMain.EXIT_COMMAND_FAILED, code);
        assertFalse(held.get().isActive());
        assertFalse(keepaliveAlive(), "keepalive thread must stop after failed grant-admin");
    }

    @Test
    void missingAccountExceptionIsNotSwallowed() throws Exception {
        java.io.ByteArrayOutputStream err = new java.io.ByteArrayOutputStream();
        java.io.PrintStream original = System.err;
        System.setErr(new java.io.PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            int code = BootstrapMain.execute(GRANT_PROD, args -> BootstrapCliProcessProbe.openProbeContext(true));
            assertEquals(BootstrapMain.EXIT_COMMAND_FAILED, code);
        } finally {
            System.setErr(original);
        }
        String text = err.toString(StandardCharsets.UTF_8);
        assertTrue(text.contains("community account not found"), text);
        assertTrue(text.contains("IllegalStateException"), text);
    }

    @Test
    void profileMissingReturnsTwoWithoutStartingContext() {
        AtomicReference<Boolean> started = new AtomicReference<>(false);
        int code = BootstrapMain.execute(new String[]{"grant-admin"}, args -> {
            started.set(true);
            return BootstrapCliProcessProbe.openProbeContext(false);
        });
        assertEquals(2, code);
        assertFalse(started.get());
    }

    @Test
    void grantAdminNonProdReturnsThreeWithoutStartingContext() {
        AtomicReference<Boolean> started = new AtomicReference<>(false);
        int code = BootstrapMain.execute(
                new String[]{"grant-admin", "--spring.profiles.active=dev"},
                args -> {
                    started.set(true);
                    return BootstrapCliProcessProbe.openProbeContext(false);
                });
        assertEquals(3, code);
        assertFalse(started.get());
    }

    @Test
    void processExitsZeroOnSuccess() throws Exception {
        ProcessResult result = runProbe(false);
        assertTrue(result.finished, "success JVM must exit without SIGTERM");
        assertEquals(0, result.exitCode, result.output);
    }

    @Test
    void processExitsNonZeroOnMissingAccount() throws Exception {
        ProcessResult result = runProbe(true);
        assertTrue(result.finished, "failure JVM must exit without SIGTERM");
        assertEquals(BootstrapMain.EXIT_COMMAND_FAILED, result.exitCode, result.output);
        assertTrue(result.output.contains("community account not found"), result.output);
    }

    private static boolean keepaliveAlive() {
        return Thread.getAllStackTraces().keySet().stream()
                .anyMatch(thread -> BootstrapCliProcessProbe.KEEPALIVE_THREAD.equals(thread.getName())
                        && thread.isAlive());
    }

    private static ProcessResult runProbe(boolean fail) throws Exception {
        String javaBin = ProcessHandle.current().info().command().orElse("java");
        List<String> command = new ArrayList<>();
        command.add(javaBin);
        command.add("-cp");
        command.add(System.getProperty("java.class.path"));
        command.add(BootstrapCliProcessProbe.class.getName());
        command.add("grant-admin");
        command.add("--spring.profiles.active=prod");
        if (fail) {
            command.add("--probe-fail");
        }
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        boolean finished = process.waitFor(20, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
        }
        return new ProcessResult(finished, finished ? process.exitValue() : -1, output);
    }

    private record ProcessResult(boolean finished, int exitCode, String output) {
    }
}
