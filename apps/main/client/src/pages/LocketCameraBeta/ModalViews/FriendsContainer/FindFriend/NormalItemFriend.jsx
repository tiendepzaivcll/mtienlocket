import React from "react";
import { Plus } from "lucide-react";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

export default function NormalItemFriend({ friend, handleAddFriend, loading, isSelf }) {
  return (
    <div
      key={friend.uid}
      className="flex w-full items-center gap-3 space-y-2 rounded-md cursor-pointer justify-between"
    >
      <div className="flex items-center gap-3">
        <img
          src={getAvatarSource(friend)}
          alt={`${friend?.first_name} ${friend?.last_name}`}
          onError={handleAvatarError}
          className="w-16 h-16 rounded-full border-[3.5px] p-0.5 border-amber-400 object-cover"
        />
        <div>
          <h2 className="font-medium">
            {friend?.first_name} {friend?.last_name}
          </h2>
          <p className="text-sm text-gray-500 underline">
            @{friend.username || "Không có username"}
          </p>
        </div>
      </div>

      <button
        disabled={loading || isSelf}
        className="btn flex flex-row justify-center bg-yellow-500 text-black p-1 px-3 rounded-full transition shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={handleAddFriend}
      >
        {!isSelf && <Plus className="w-5 h-5" strokeWidth={3} />}
        <span className="text-base font-semibold">{isSelf ? "Bạn" : "Thêm"}</span>
      </button>
    </div>
  );
}
