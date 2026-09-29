import { Link, useSearchParams } from "react-router-dom";
import { AuthCard } from "@/features/auth/components/AuthCard";

/**
 * Registration pending audit (Phase 1A).
 * Reached only when the real register response reports auditStatus === "PENDING".
 */
export function PendingAuditPage() {
  const [params] = useSearchParams();
  const registered = params.get("registered") === "1";

  return (
    <AuthCard
      title="注册已提交"
      description={registered ? "我们已收到你的注册申请。" : undefined}
      footer={
        <Link to="/login" className="text-accent hover:underline">
          返回登录
        </Link>
      }
    >
      <p className="text-sm text-muted-foreground">
        你的账号需要管理员审核，审核通过后即可登录。审核结果会通过邮件通知你。
      </p>
    </AuthCard>
  );
}
