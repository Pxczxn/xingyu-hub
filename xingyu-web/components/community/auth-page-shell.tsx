import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageShell({ eyebrow, title, description, children, footer }: AuthPageShellProps) {
  return (
    <main className="min-h-dvh bg-[#f8f7f3] p-3 sm:p-5 lg:p-6">
      <section className="xy-auth-shell mx-auto min-h-[calc(100dvh-1.5rem)] max-w-[1440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(19,35,77,0.09)] sm:min-h-[calc(100dvh-2.5rem)] lg:h-[calc(100dvh-3rem)] lg:min-h-[620px]">
        <aside className="relative hidden min-h-full overflow-hidden bg-[#10244d] lg:block">
          <Image
            src="/images/auth-observatory.png"
            alt="夜色中的观星窗与阅读灯"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 0vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,25,55,0.08),rgba(10,25,55,0.42))]" />
          <div className="absolute inset-x-10 top-10 flex items-center gap-3 text-white">
            <Image src="/brand/logo-icon-180.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl bg-white/95 p-1" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-[0.04em]">星语社区</span>
          </div>
          <div className="absolute inset-x-10 bottom-10 max-w-sm text-white">
            <p className="text-xs font-semibold tracking-[0.2em] text-orange-200">READ · CREATE · CONNECT</p>
            <p className="mt-4 text-2xl font-semibold leading-snug">让每一次阅读与创作，都在自己的轨道上慢慢发亮。</p>
          </div>
        </aside>

        <div className="relative flex min-h-full flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(218,225,249,0.9),transparent_67%)]" />
          <Link
            href="/"
            className="relative inline-flex min-h-10 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#13234d]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回星语社区
          </Link>

          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 lg:py-3">
            <div className="mb-5 lg:mb-4">
              <div className="mb-5 flex items-center gap-2 text-[#5964aa] lg:hidden">
                <Image src="/brand/logo-icon-mark.png" alt="" width={20} height={20} className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold tracking-[0.05em]">星语社区</span>
              </div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[#5964aa]">{eyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#13234d] sm:text-[2rem]">{title}</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {children}
          </div>

          <div className="relative mx-auto w-full max-w-md border-t border-slate-100 pt-5 text-center text-sm leading-6 text-slate-500">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
