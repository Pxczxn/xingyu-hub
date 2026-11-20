package top.pxczxn.xingyu.system.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SaLoginIdsTest {

    @Test
    void uuidIsNotNumeric() {
        assertTrue(SaLoginIds.asLongIfNumeric("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001").isEmpty());
        assertTrue(SaLoginIds.asLongIfNumeric("admin-user").isEmpty());
        assertTrue(SaLoginIds.asLongIfNumeric(null).isEmpty());
    }

    @Test
    void numericLoginIdIsPreserved() {
        assertEquals(1L, SaLoginIds.asLongIfNumeric("1").orElseThrow());
        assertEquals(42L, SaLoginIds.asLongIfNumeric(42L).orElseThrow());
    }
}
