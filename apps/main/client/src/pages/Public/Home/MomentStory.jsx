import { useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Sparkles, Flame } from "lucide-react";

const moments = [
  {
    image: "quiet-morning.jpg",
    alt: "Một chút bình yên",
    caption: "Một chút bình yên.",
    detail: "Buổi sáng thật chậm rãi",
    time: "07:24",
    user: "MTIEN",
    tag: "Khoảnh khắc mới",
    streak: 42,
  },
  {
    image: "golden-hour.jpg",
    alt: "Hoàng hôn trên biển",
    caption: "Hẹn nhau ở biển nhé 🌊",
    detail: "Một chiều đầy nắng và gió",
    time: "16:38",
    user: "Locket-Pro",
    tag: "Được yêu thích",
    streak: 88,
  },
  {
    image: "slow-day.jpg",
    alt: "Cà phê cuối tuần",
    caption: "Cà phê cùng mình không? ☕",
    detail: "Những điều bé xíu ấm áp",
    time: "09:12",
    user: "Bạn bè",
    tag: "Vừa gửi",
    streak: 15,
  },
];

export default function MomentStory({ compact = false }) {
  const [index, setIndex] = useState(0);
  const moment = moments[index];

  const next = (direction) => {
    setIndex((prev) => (prev + direction + moments.length) % moments.length);
  };

  return (
    <div className="lp-mockup-wrapper">
      {/* Floating Badges */}
      {!compact && (
        <>
          <div className="lp-floating-badge lp-floating-top">
            <Flame size={15} />
            <span>Chuỗi {moment.streak} ngày</span>
          </div>
          <div className="lp-floating-badge lp-floating-bottom">
            <Sparkles size={15} />
            <span>15s Video Full HD</span>
          </div>
        </>
      )}

      {/* Main Widget Card */}
      <div className="lp-card-widget">
        <div className="lp-photo-container">
          <img
            src={`/images/mtien/${moment.image}`}
            alt={moment.alt}
            width="800"
            height="800"
            loading="eager"
          />
          <div className="lp-photo-overlay">
            <div className="lp-photo-header">
              <span className="lp-photo-tag">{moment.tag}</span>
              <span className="lp-photo-time">{moment.time}</span>
            </div>

            <div className="lp-caption-pill">
              <Heart size={15} fill="#ff6b81" />
              <span>{moment.caption}</span>
            </div>
          </div>
        </div>

        {/* Footer info & controls */}
        <div className="lp-widget-footer">
          <div className="lp-author-info">
            <span className="lp-author-name">{moment.user}</span>
            <span className="lp-author-detail">{moment.detail}</span>
          </div>

          <div className="lp-slide-nav">
            <button
              type="button"
              className="lp-slide-btn"
              onClick={() => next(-1)}
              aria-label="Khoảnh khắc trước"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              className="lp-slide-btn"
              onClick={() => next(1)}
              aria-label="Khoảnh khắc tiếp"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
