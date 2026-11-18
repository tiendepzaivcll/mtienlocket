import React, { useEffect, useState } from "react";
import { Flame, FolderDown, LockKeyhole, UserRoundX } from "lucide-react";
import BottomToolBar from "./Layout/BottomToolBar";
import DeleteFriendsTool from "./tools/DeleteFriendsTool";
import { TbUserStar } from "react-icons/tb";
import CelebrityTool from "./tools/CelebrityTool";
import ExportDataTool from "./tools/ExportDataTool";
import RestoreStreak from "./tools/RestoreStreak";
import { useAuthStore } from "@/stores";
import VipRequired from "@/components/pages/VipRequired";

const toolsList = [
  {
    key: "delete-friends",
    label: "Clean Requests",
    icon: <UserRoundX />,
    content: <DeleteFriendsTool />,
    vipOnly: true,
  },
  {
    key: "celebrity",
    label: "Celebrity Tool",
    icon: <TbUserStar />,
    content: <CelebrityTool />,
  },
  {
    key: "exports-tool",
    label: "Xuất dữ liệu",
    icon: <FolderDown />,
    content: <ExportDataTool />,
    vipOnly: true,
  },
  {
    key: "restore-streak",
    label: "Khôi phục chuỗi",
    icon: <Flame />,
    content: <RestoreStreak />,
    vipOnly: true,
  },
];

export default function ToolsLocket() {
  const { user, accessRole } = useAuthStore();
  const isVip = accessRole === "vip";
  const isCelebrityOnly = accessRole === "celebrity";
  const [activeTab, setActiveTab] = useState(
    window.location.hash.replace("#", "") ||
      (isCelebrityOnly ? "celebrity" : toolsList[0].key),
  );

  const visibleTools = toolsList.map((tool) => ({
    ...tool,
    locked: !isVip || (isCelebrityOnly && tool.vipOnly),
  }));
  const activeTool = visibleTools.find((tool) => tool.key === activeTab);

  useEffect(() => {
    if (isCelebrityOnly) {
      setActiveTab("celebrity");
    }
  }, [isCelebrityOnly]);

  // Đồng bộ hash khi activeTab thay đổi
  useEffect(() => {
    if (activeTab !== window.location.hash.replace("#", "")) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Nghe thay đổi hash (nếu user đổi trực tiếp URL hoặc back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (toolsList.find((t) => t.key === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="flex flex-col min-h-[84vh] w-full p-3 pb-24 md:pb-3">
      {/* Title */}
      <h1 className="text-3xl font-bold text-primary text-center">
        🧰 ToolsLocket by MTIEN
      </h1>
      <div className="text-sm text-center mt-1 text-base-content">
        Đăng nhập dưới tên:{" "}
        <strong>
          {user?.firstName} {user?.lastName}
        </strong>
      </div>

      {/* Layout */}
      <div className="relative flex flex-col md:flex-row w-full mx-auto gap-6 py-3">
        {/* Sidebar */}
        <div className="hidden md:block w-1/4">
          <div className="flex flex-col gap-2 bg-base-100 p-4 rounded-xl shadow-md border">
            {visibleTools.map((tool) => (
              <button
                key={tool.key}
                onClick={() => setActiveTab(tool.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all
                  ${
                    activeTab === tool.key
                      ? "bg-primary text-white shadow border border-primary"
                      : "hover:bg-base-200 text-base-content"
                  }`}
              >
                {React.cloneElement(tool.icon, { size: 20 })}
                <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                {tool.locked && <LockKeyhole className="h-4 w-4 shrink-0 opacity-70" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-base-100 border border-base-300 p-4 rounded-2xl shadow-md">
          {activeTool?.locked ? (
            <VipRequired compact />
          ) : activeTool?.content || (
            <div>🔍 Không tìm thấy nội dung</div>
          )}
        </div>

        {/* Mobile Bottom Toolbar */}
        <BottomToolBar
          tools={visibleTools}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
      </div>
    </div>
  );
}
