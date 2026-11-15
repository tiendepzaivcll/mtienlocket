import React from "react";
import { CheckCircle2, Sparkles, UploadCloud, Wand2 } from "lucide-react";

const unlockedFeatures = [
  {
    icon: UploadCloud,
    title: "Upload mạnh nhất",
    description: "Ảnh, video và dung lượng lưu trữ dùng theo cấu hình cao nhất.",
  },
  {
    icon: Wand2,
    title: "Caption đầy đủ",
    description: "Toàn bộ decorative, icon, GIF, image caption và công cụ mở rộng đã mở.",
  },
  {
    icon: Sparkles,
    title: "Không cần nâng cấp",
    description: "Member dùng trực tiếp Full Access, không còn gói trả phí trong app.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-base-100 text-base-content px-4 py-10">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="rounded-lg border border-success/25 bg-success/10 px-5 py-4 text-success">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-base-content">
                T97 Full Access đã được bật
              </h1>
              <p className="mt-1 text-sm text-base-content/75">
                T97 là tên app chính thức. Mọi member hiện được dùng toàn bộ
                tính năng cao nhất.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {unlockedFeatures.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-lg border border-base-300 bg-base-100 p-5 shadow-sm"
            >
              <Icon className="mb-4 h-6 w-6 text-primary" />
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/70">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
