import { generateUUIDv4Upper, getDeviceId } from "@/utils/generate/uuid";

const createIntValue = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: String(value),
});

export const createLocketAnalytics = () => ({
  ios_version: "2.53.0.1",
  experiments: {
    flag_18: createIntValue(1203),
    flag_7: createIntValue(800),
    flag_10: createIntValue(504),
    flag_6: createIntValue(2000),
    flag_5: createIntValue(400),
    flag_14: createIntValue(502),
    flag_4: createIntValue(43),
    flag_25: createIntValue(76),
    flag_9: createIntValue(20),
    flag_22: createIntValue(1203),
    flag_3: createIntValue(600),
    flag_16: createIntValue(521),
  },
  amplitude: {
    device_id: getDeviceId(),
    session_id: createIntValue(Date.now()),
  },
  installation_id: getDeviceId().replace(/-/g, "").slice(0, 22),
  google_analytics: {
    app_instance_id: generateUUIDv4Upper().replace(/-/g, ""),
  },
  platform: "ios",
});
