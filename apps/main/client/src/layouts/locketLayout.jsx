import React from "react";

const LocketLayout = ({ children }) => {
  return (
    <main
      className="w-full h-full min-h-[100dvh]"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      {children}
    </main>
  );
};

export default LocketLayout;
