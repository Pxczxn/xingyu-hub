package top.pxczxn.xingyu.common.contract;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ObjectIdTest {

    @Test
    void acceptsValidUuid() {
        ObjectId id = ObjectId.of("f37ad3a9-b5d7-4625-b7b9-189512886403");
        assertEquals("f37ad3a9-b5d7-4625-b7b9-189512886403", id.value());
    }

    @Test
    void rejectsInvalidUuid() {
        assertThrows(IllegalArgumentException.class, () -> ObjectId.of("not-a-uuid"));
    }
}
