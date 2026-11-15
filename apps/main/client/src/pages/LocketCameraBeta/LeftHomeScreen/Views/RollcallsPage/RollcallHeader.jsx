import React from "react";
import { useUser } from "./useUser";
import { getWeekdayFromFirestore } from "@/utils";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

function RollcallHeader({ post, activeItem }) {
  const user = useUser(post.user);
  const location = activeItem?.location?.name;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <img
          src={getAvatarSource(user)}
          alt={user.firstName || user.first_name}
          onError={handleAvatarError}
          className="w-11 h-11 rounded-full object-cover"
        />
        <div className="flex flex-col justify-center">
          <p className="text-md font-medium">
            {user.firstName || user.first_name}{" "}
            {user.lastName || user.last_name}
          </p>
          <p className="text-sm opacity-80">
            {getWeekdayFromFirestore(activeItem?.creation_date)}
            {location && ` • ${location}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default RollcallHeader;
