import { useState } from "react";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";

const moments = [
  { image: "quiet-morning.jpg", alt: "Ngôi nhà bên hồ giữa núi rừng yên tĩnh", caption: "Một chút bình yên.", detail: "Chậm lại một chút cũng được.", time: "07:24", label: "buổi sáng thật chậm" },
  { image: "golden-hour.jpg", alt: "Sóng biển xanh và bờ cát trong nắng", caption: "Hẹn nhau ở biển.", detail: "Mang một chút nắng về cho bạn.", time: "16:38", label: "một chiều đầy nắng" },
  { image: "slow-day.jpg", alt: "Một tách cà phê trong ngày thư thả", caption: "Cà phê cùng mình nhé?", detail: "Một ngày bình thường, thật dễ thương.", time: "09:12", label: "những điều bé xíu" },
];

export default function MomentStory({ compact = false }) {
  const [index, setIndex] = useState(0);
  const moment = moments[index];
  const next = (direction) => setIndex((value) => (value + direction + moments.length) % moments.length);
  return (
    <div className={`mtien-story ${compact ? "mtien-story-compact" : ""}`}>
      <div className="mtien-story-heading"><span>MỖI NGÀY, MỘT CHÚT GẦN NHAU</span><span>MTIEN / {String(index + 1).padStart(2, "0")}</span></div>
      <div className="mtien-story-photo">
        <img src={`/images/mtien/${moment.image}`} alt={moment.alt} width="1000" height="1000" fetchPriority={compact ? "auto" : "high"} />
        <span className="mtien-story-time">{moment.time}</span>
        <div className="mtien-photo-caption"><Heart size={16} fill="currentColor" />{moment.caption}</div>
        <span className="mtien-story-stamp">a little moment<br /><b>worth sharing.</b></span>
      </div>
      <div className="mtien-story-bottom">
        <div aria-live="polite"><span>{moment.label}</span><p>{moment.detail}</p></div>
        <div className="mtien-story-controls"><button type="button" onClick={() => next(-1)} aria-label="Ảnh trước"><ArrowLeft size={17} /></button><button type="button" onClick={() => next(1)} aria-label="Ảnh tiếp theo"><ArrowRight size={17} /></button></div>
      </div>
    </div>
  );
}
