import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { CONTACT_CONFIG } from "@/config";

export default function Contact() {
  const contacts = [
    { label: "Email", value: CONTACT_CONFIG.supportEmail, href: `mailto:${CONTACT_CONFIG.supportEmail}`, icon: Mail, action: "Gửi email" },
    { label: "Zalo", value: CONTACT_CONFIG.supportNumber, href: CONTACT_CONFIG.zaloUrl, icon: MessageCircle, action: "Nhắn Zalo", external: true },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-14 md:py-20 min-h-[65vh]">
      <p className="text-xs tracking-[0.18em] font-semibold text-primary mb-5">MTIEN / HỖ TRỢ</p>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-base-content">Liên hệ admin.</h1>
      <p className="text-base-content/70 mt-5 max-w-lg leading-relaxed">Bạn cần hỗ trợ tài khoản hoặc gặp vấn đề khi sử dụng MTIEN? Liên hệ admin qua email hoặc Zalo bên dưới nhé.</p>
      <div className="grid sm:grid-cols-2 gap-5 mt-10">
        {contacts.map(({ label, value, href, icon: Icon, action, external }) => (
          <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="group flex flex-col gap-5 p-7 rounded-xl border border-base-300 bg-base-100 text-base-content transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <div className="flex items-center justify-between"><Icon size={25} strokeWidth={1.5} className="text-primary" aria-hidden="true" /><span className="text-xs text-base-content/60">{label}</span></div>
            <p className="font-semibold text-base break-all">{value}</p>
            <span className="inline-flex items-center gap-2 text-sm text-primary mt-2">{action}<ArrowUpRight size={16} aria-hidden="true" /></span>
          </a>
        ))}
      </div>
    </div>
  );
}
