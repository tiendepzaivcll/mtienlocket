import React from "react";

const SavedCaptions = ({ title = "Caption của bạn", captions = [], onSelect }) => {
  const isLoading = !captions || captions.length === 0;

  return (
    <div className="px-4">
      {title && (
        <h2 className="text-md font-semibold text-primary mb-2">{title}</h2>
      )}

      <div className="flex flex-wrap gap-4 pt-2 pb-5 justify-start">
        {isLoading ? (
          <p className="text-sm text-base-content/60">Chưa có caption đã lưu.</p>
        ) : (
          captions.map((cap) => (
            <button
              key={cap.id}
              className="flex flex-col whitespace-nowrap items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center shadow-md hover:shadow-lg transition"
              style={{
                background: `linear-gradient(to bottom, ${cap.colortop}, ${cap.colorbottom})`,
                color: cap.color || "#fff",
              }}
              onClick={() => onSelect(cap)}
            >
              <span className="text-base flex items-center gap-2">
                {cap.type === "image_icon" || cap.type === "image_gif" ? (
                  <img
                    src={cap.icon_url}
                    alt="icon"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <>{cap.icon_url}</>
                )}
                {cap.text}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default SavedCaptions;
