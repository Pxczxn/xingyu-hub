export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 0 && hour < 6) return "凌晨好";
  if (hour >= 6 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  if (hour >= 18 && hour < 20) return "傍晚好";
  if (hour >= 20 && hour < 22) return "晚上好";
  return "深夜好";
}

export function msUntilNextGreetingChange(date = new Date()): number {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  return Math.max(next.getTime() - date.getTime(), 1000);
}
