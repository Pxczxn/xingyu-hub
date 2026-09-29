package top.pxczxn.xingyu.db.monitor;

public enum SqlMonitorLevel {
    NORMAL("正常执行", "\u001B[92m", "✅"),
    WARN("性能提醒", "\u001B[93m", "⚠️"),
    SLOW("慢SQL警告", "\u001B[91m", "🐌");

    private final String label;
    private final String color;
    private final String icon;

    SqlMonitorLevel(String label, String color, String icon) {
        this.label = label;
        this.color = color;
        this.icon = icon;
    }

    public String label() {
        return label;
    }

    public String color() {
        return color;
    }

    public String icon() {
        return icon;
    }
}
