package top.pxczxn.xingyu.db.monitor;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

@Component
public class SqlMonitorStore {

    private final Deque<SqlMonitorEntry> records = new ArrayDeque<>();
    private final SqlMonitorProperties properties;

    public SqlMonitorStore(SqlMonitorProperties properties) {
        this.properties = properties;
    }

    public void add(SqlMonitorEntry entry) {
        synchronized (records) {
            records.addFirst(entry);
            while (records.size() > properties.getMaxRecords()) {
                records.removeLast();
            }
        }
    }

    public List<SqlMonitorEntry> recent() {
        synchronized (records) {
            return new ArrayList<>(records);
        }
    }

    public int size() {
        synchronized (records) {
            return records.size();
        }
    }

    public void clear() {
        synchronized (records) {
            records.clear();
        }
    }
}
