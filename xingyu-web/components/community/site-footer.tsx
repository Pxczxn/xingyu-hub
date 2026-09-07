import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const footerLinks = [
  ["关于星语", "/guide"],
  ["帮助中心", "/help"],
  ["内容规范", "/rules"],
  ["隐私政策", "/settings/privacy"],
  ["用户协议", "/rules"],
  ["联系我们", "/feedback/recommendations"],
] as const;

export function SiteFooter() {
  return (
    <footer className="xy-site-footer" aria-label="站点页脚">
      <div className="xy-site-footer__inner">
        <div className="xy-site-footer__brand">
          <span className="xy-site-footer__mark" aria-hidden="true">星</span>
          <span>
            <strong>星语社区</strong>
            <small>记录思想 · 连接同好</small>
          </span>
        </div>
        <nav aria-label="页脚导航">
          {footerLinks.map(([label, href]) => (
            <Link href={href} key={`${href}-${label}`}>
              {label}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <p>© 2024–2026 星语社区</p>
      </div>
    </footer>
  );
}
