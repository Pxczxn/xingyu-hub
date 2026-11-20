package top.pxczxn.xingyu;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@AutoConfiguration
@Profile("test")
class CommunityConsoleAdminTestSeed implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    CommunityConsoleAdminTestSeed(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        CommunityTestSupport.ensureConsoleAdmin(jdbcTemplate);
    }
}
