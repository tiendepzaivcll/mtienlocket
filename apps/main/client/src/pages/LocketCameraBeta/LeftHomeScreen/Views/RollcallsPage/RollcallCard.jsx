import React, { useState } from "react";
import RollcallHeader from "./RollcallHeader";
import RollcallImages from "./RollcallImages";
import RollcallComments from "./RollcallComments";

function RollcallCard({ post }) {
  const [openComments, setOpenComments] = useState(false);
  const [activeItem, setActiveItem] = useState(post.items?.[0] || null);

  return (
    <div className="bg-base-100 p-4 rounded-xl shadow flex flex-col gap-3">
      <RollcallHeader post={post} activeItem={activeItem}/>
      <hr />
      <RollcallImages items={post.items || []} onActiveChange={setActiveItem}/>
      <span className="text-xs opacity-50">
        {formatRollcallCreatedAt(post.created_at ?? post.create_time)}
      </span>

      {post.comments?.length > 0 && (
        <button
          onClick={() => setOpenComments((v) => !v)}
          className="text-sm text-blue-500"
        >
          {openComments ? "Ẩn bình luận" : "Xem bình luận"}
        </button>
      )}

      {openComments && <RollcallComments comments={post.comments} />}
    </div>
  );
}

export default RollcallCard;

function formatRollcallCreatedAt(createdAt) {
  if (createdAt == null) return "";
  if (typeof createdAt === "number") {
    return new Date(createdAt).toLocaleString();
  }
  if (typeof createdAt === "object" && createdAt._seconds != null) {
    return new Date(createdAt._seconds * 1000).toLocaleString();
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
