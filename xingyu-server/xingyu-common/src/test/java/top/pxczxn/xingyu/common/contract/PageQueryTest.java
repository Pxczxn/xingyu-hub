package top.pxczxn.xingyu.common.contract;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PageQueryTest {

    @Test
    void defaultsToTwentyItems() {
        PageQuery query = PageQuery.firstPage();
        assertEquals(20, query.getLimit());
        assertNull(query.getCursor());
    }

    @Test
    void rejectsLimitAboveMax() {
        assertThrows(IllegalArgumentException.class, () -> PageQuery.of(101, null));
    }

    @Test
    void parsesCursorAsObjectId() {
        PageQuery query = PageQuery.of(10, "f37ad3a9-b5d7-4625-b7b9-189512886403");
        assertEquals("f37ad3a9-b5d7-4625-b7b9-189512886403", query.getCursor().value());
    }
}
