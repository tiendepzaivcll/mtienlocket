const createIntValue = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: value.toString(),
});

function generateUUIDv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const createAnalytics = () => ({
  ios_version: "2.52.0.1",
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
    device_id: generateUUIDv4(),
    session_id: createIntValue(Date.now().toString()),
  },
  google_analytics: {
    app_instance_id: generateUUIDv4().replace(/-/g, "").toUpperCase(),
  },
  installation_id: generateUUIDv4(),
  platform: "ios",
});

module.exports = {
  createAnalytics,
};
