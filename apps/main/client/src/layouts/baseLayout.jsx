import Sidebar from "@/components/Sidebar";

export default function LayoutWithSidebar({ Layout, children }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-app)" }}>
      <div>
        <Sidebar />
      </div>

      <div
        className="flex-1 overflow-hidden"
        style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
      >
        <Layout>{children}</Layout>
      </div>
    </div>
  );
}
