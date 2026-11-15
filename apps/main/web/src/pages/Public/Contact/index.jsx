import React from "react";
import "./styles.css";
import { Mail, MapPin, Send, MessageCircle } from "lucide-react";
import MailForm from "@/components/ui/SupportForms/MailForm";

export default function Contact() {
  const communityLinks = [
    {
      name: "Telegram",
      icon: <Send className="w-8 h-8 text-blue-500" />,
      url: "https://t.me/t97system",
    },
    {
      name: "Nhóm Zalo",
      icon: <MessageCircle className="w-8 h-8 text-blue-400" />,
      url: "https://zalo.me/g/f1zgpr2a3ejmojsfkwyb",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-base-200 to-base-300 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fadeIn">
          <h1 className="text-4xl md:text-5xl font-extrabold text-base-content drop-shadow-sm">
            Liên hệ & Hỗ trợ
          </h1>
          <p className="mt-3 text-base-content/70 text-lg">
            Hệ thống Hỗ trợ <span className="font-semibold">Locket.io.vn</span>
          </p>
        </div>

        {/* Contact Info & Social (Gộp thành 1 cột thẳng hàng) */}
        <div className="space-y-6">
          {/* Primary Contact */}
          <div className="bg-base-100 p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 animate-slideUp delay-100">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail size={18} /> Liên hệ chính
            </h3>
            <a
              href="mailto:t97system@icloud.com"
              className="btn btn-outline w-full justify-start gap-3 hover:scale-[1.02] transition"
            >
              <Mail size={18} /> t97system@icloud.com
            </a>
          </div>

          {/* Community Links */}
          <div className="bg-base-100 p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 animate-slideUp delay-200">
            <h3 className="text-lg font-semibold mb-4">Cộng đồng & Hỗ trợ</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {communityLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center p-3 rounded-lg bg-base-200 hover:bg-base-300 transition transform hover:-translate-y-1 hover:scale-105 shadow-sm hover:shadow-md"
                >
                  {link.icon}
                  <span className="text-sm font-semibold mt-2">{link.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Support Info */}
          <div className="bg-base-100 p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 animate-slideUp delay-300">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin size={18} /> Thông tin hỗ trợ
            </h3>
            <ul className="text-sm text-base-content/70 space-y-2">
              <li>• Thời gian hỗ trợ: 8h-20h (Hàng ngày)</li>
              <li>• Phản hồi nhanh nhất qua nhóm Zalo hoặc Telegram</li>
              <li>
                • Tham gia nhóm Zalo Hỗ Trợ:{" "}
                <a
                  href="https://zalo.me/g/f1zgpr2a3ejmojsfkwyb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-semibold"
                >
                  Bấm vào đây
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Mail Form */}
        <div className="mt-8">
          <MailForm />
        </div>

      </div>
    </div>
  );
}