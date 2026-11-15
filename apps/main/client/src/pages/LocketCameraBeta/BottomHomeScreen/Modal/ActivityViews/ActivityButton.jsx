import LoadingRing from "@/components/ui/Loading/ring";
import { MoonStar } from "lucide-react";
import { getAvatarSource, handleAvatarError } from "@/utils/avatar";

const ActivityButton = ({ activity, isLoading, onClick }) => {
  return (
    <div
      className="flex flex-row justify-center w-full items-center gap-2 px-4 py-3.5 bg-base-200 rounded-3xl shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div>
        <MoonStar className="text-base-content w-6 h-6" />
      </div>
      <span className="flex-1 text-base-content font-semibold pl-1">
        Hoạt động
      </span>

      {/* Avatar stack */}
      <div className="absolute z-10 flex -space-x-3 right-5 flex-row justify-center items-center">
        {isLoading ? (
          <LoadingRing size={28} stroke={3} />
        ) : (
          activity.slice(0, 6).map((item) => (
            <img
              key={item?.user?.uid}
              src={getAvatarSource(item?.user)}
              alt={item?.user?.firstName}
              onError={handleAvatarError}
              className="w-9 h-9 rounded-full border-2 border-base-100 object-cover"
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityButton;
