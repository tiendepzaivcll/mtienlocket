const normalizeLocketUrl = (urlOrUsername) => {
  const raw = String(urlOrUsername || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  return `https://${raw.replace(/^\/+/, "")}`;
};

const getUsernameFromLocketUrl = (urlOrUsername) => {
  const url = normalizeLocketUrl(urlOrUsername);
  return url
    .replace(/^https?:\/\/(www\.)?locket\.cam\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
};

const createCelebrityProfile = (name, urlOrUsername) => {
  const url = normalizeLocketUrl(urlOrUsername);
  const username = getUsernameFromLocketUrl(url);

  return {
    name,
    username,
    url,
    profile_picture_url: username
      ? `https://storage.googleapis.com/locket-public/celebrity/${username}/invite_preview.png`
      : "",
    source: "t97",
  };
};

export const T97_CELEBRITY_PROFILES = [
  createCelebrityProfile("Karik", "https://locket.cam/karik.koniz"),
  createCelebrityProfile("Phương Ly", "http://locket.cam/maylily_maylily"),
  createCelebrityProfile("LowG", "http://locket.cam/low.ggg"),
  createCelebrityProfile("Dương Fynn", "http://locket.cam/dfdfdfdf"),
  createCelebrityProfile("Wxrdie", "https://locket.cam/gutdi"),
  createCelebrityProfile("tlinh", "https://locket.cam/lf.tlinh"),
  createCelebrityProfile("DANMY", "http://locket.cam/danmy.btd"),
  createCelebrityProfile("Juky San", "https://locket.cam/juky.san"),
  createCelebrityProfile("Liu Grace", "https://locket.cam/liu.grace"),
  createCelebrityProfile("Chi Xê", "https://locket.cam/chixehehe"),
  createCelebrityProfile("Vừng", "http://locket.cam/withvungne"),
  createCelebrityProfile("Orange", "https://locket.cam/orange.97"),
  createCelebrityProfile("Pháo", "https://locket.cam/phaoxinhxinhh"),
  createCelebrityProfile("Lyly", "http://locket.cam/lyly.singer"),
  createCelebrityProfile("Meichan", "http://locket.cam/meiiiichannnnn"),
  createCelebrityProfile("Thể Thiên", "https://locket.cam/ttthethien"),
  createCelebrityProfile("Jenny Huynh", "http://locket.cam/jenny.huynhh"),
  createCelebrityProfile("Cầm", "https://locket.cam/tcamnggg"),
  createCelebrityProfile("Vũ Cát Tường", "http://locket.cam/vucattuongofficial"),
  createCelebrityProfile("Phúc Du", "https://locket.cam/phucdu.arghhh"),
  createCelebrityProfile("Gill", "https://locket.cam/gill.thatsune"),
  createCelebrityProfile("Châu Bùi", "https://locket.cam/chauiuneeee"),
  createCelebrityProfile("Coldzy", "https://locket.cam/coldzy.clb"),
  createCelebrityProfile("Nhâm Phương Nam", "locket.cam/nhamphuongnam"),
  createCelebrityProfile("BigDaddy", "locket.cam/bigdaddy_official"),
  createCelebrityProfile("Emily", "locket.cam/emilynguyen1810"),
  createCelebrityProfile("Phùng Khánh Linh", "locket.cam/phungkhanhlinhhh"),
  createCelebrityProfile("OgeNus", "https://locket.cam/ogenusss"),
  createCelebrityProfile("Anh Trai Say Hi", "https://locket.cam/anhtraisayhiofficial"),
  createCelebrityProfile(".RIO", "https://locket.cam/riohaydoi"),
  createCelebrityProfile("TEZ", "https://locket.cam/tez1only"),
  createCelebrityProfile("Hải Nam", "https://locket.cam/hainam_10"),
  createCelebrityProfile("Bùi Duy Ngọc", "https://locket.cam/buiduyngoc09"),
  createCelebrityProfile("ERIK", "https://locket.cam/erik.official"),
  createCelebrityProfile("Isaac", "https://locket.cam/isaac.lion"),
  createCelebrityProfile("Jun Phạm", "https://locket.cam/jun.pham"),
  createCelebrityProfile("Hồ Đông Quan", "https://locket.cam/handongwoo"),
  createCelebrityProfile("Thái Lê Minh Hiếu", "http://locket.cam/hieu_hjhj"),
  createCelebrityProfile("Ngô Kiến Huy", "https://locket.cam/ngokienhuy_bapbebi"),
  createCelebrityProfile("Thầy Beo U40", "https://locket.cam/thaybeo.u40"),
  createCelebrityProfile("Changg", "locket.cam/atl.changg"),
  createCelebrityProfile("PiaLinh", "locket.cam/pialinhh"),
  createCelebrityProfile("Tùng Mint", "https://locket.cam/tungbacha"),
  createCelebrityProfile("Hoàng Tôn", "https://locket.cam/hoangtondeptrai"),
  createCelebrityProfile("Nguyễn Văn Chung", "https://locket.cam/nsnguyenvanchung"),
  createCelebrityProfile("Will", "https://locket.cam/willoiwill"),
  createCelebrityProfile("Mono", "https://locket.cam/mono.hng"),
  createCelebrityProfile("Tina Thảo Thi", "https://locket.cam/tinathaothi.official"),
  createCelebrityProfile("Gia đình Truyền Hình", "https://locket.cam/cuecamfamily"),
  createCelebrityProfile("OSAD", "https://locket.cam/myqnam0310"),
  createCelebrityProfile("Fansie Family", "https://locket.cam/fansiefamily"),
  createCelebrityProfile("Hà An Huy", "https://locket.cam/anhuyungdung"),
];

export const normalizeCelebrityProfile = (item) => {
  if (!item) return null;

  if (typeof item === "string") {
    return createCelebrityProfile(getUsernameFromLocketUrl(item), item);
  }

  const username =
    item.username ||
    item.user_name ||
    item.handle ||
    getUsernameFromLocketUrl(item.url || item.link || item.profile_url || "");

  return {
    ...item,
    username,
    url: item.url || item.link || item.profile_url || (username ? `https://locket.cam/${username}` : ""),
  };
};

export const mergeCelebrityProfiles = (...lists) => {
  const map = new Map();

  lists
    .flat()
    .map(normalizeCelebrityProfile)
    .filter((item) => item?.uid || item?.username)
    .forEach((item) => {
      // Username is stable across static snapshots and live UID responses.
      // Prefer it so a profile does not appear twice after UID enrichment.
      const key = item.username?.toLowerCase() || item.uid;
      map.set(key, {
        ...(map.get(key) || {}),
        ...item,
      });
    });

  return [...map.values()];
};
