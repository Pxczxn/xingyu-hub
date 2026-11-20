package top.pxczxn.xingyu.system.mapper;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommunityRbacMapperContractTest {

    @Test
    void mapperSqlUsesCommunityGrantChainAndAvoidsLegacyUserTables() throws IOException {
        Path sourceFile = Path.of("src/main/java/top/pxczxn/xingyu/system/mapper/CommunityRbacMapper.java");
        assertTrue(Files.isRegularFile(sourceFile), sourceFile.toAbsolutePath().toString());
        String source = Files.readString(sourceFile);
        assertTrue(source.contains("community_user_role"));
        assertTrue(source.contains("sys_role"));
        assertTrue(source.contains("sys_role_menu"));
        assertTrue(source.contains("sys_menu"));
        assertTrue(source.contains("r.status = 1"));
        assertTrue(source.contains("r.deleted = 0"));
        assertTrue(source.contains("m.status = 1"));
        assertTrue(source.contains("m.deleted = 0"));
        assertEquals(2, Pattern.compile("@Select").matcher(source).results().count());
        String sql = source.substring(source.indexOf("@Select"));
        assertFalse(Pattern.compile("\\bsys_user_role\\b").matcher(sql).find());
        assertFalse(Pattern.compile("\\bsys_user\\b").matcher(sql).find());
        assertFalse(sql.contains("community_user.role"));
        assertFalse(sql.contains("data_scope"));
        assertFalse(sql.contains("dept_id"));
    }
}
