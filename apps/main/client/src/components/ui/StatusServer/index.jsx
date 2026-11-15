import React, { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import BouncyLoader from "../Loading/Bouncy";
import { RiEmotionHappyLine } from "react-icons/ri";
import { TbMoodCrazyHappy } from "react-icons/tb";
import { instanceAuth } from "@/libs/instanceAuth";
import { CONFIG } from "@/config";

const StatusServer = () => {
  const { useloading } = useApp();
  const {
    isStatusServer,
    setIsStatusServer,
    serverStatusDetail,
    setServerStatusDetail,
  } = useloading; // null: đang kiểm tra, true/false: kết quả
  const isApiMissing = !CONFIG.api.isConfigured;

  useEffect(() => {
    let intervalId;

    const checkServer = async () => {
      if (isApiMissing) {
        setServerStatusDetail({ reason: "missing-client-api" });
        setIsStatusServer(false);
        return;
      }

      try {
        const response = await instanceAuth.get("/health", {
          timeout: 15000, // tránh treo request
        });
        const health = response.data;
        const ready = Boolean(
          response.status === 200 &&
            health?.checks?.api?.healthy &&
            health?.checks?.auth?.configured &&
            health?.checks?.locket?.configured,
        );
        setServerStatusDetail(health);
        setIsStatusServer(ready);
      } catch (error) {
        setServerStatusDetail({
          reason: error?.code === "ECONNABORTED" ? "timeout" : "unreachable",
        });
        setIsStatusServer(false);
      }
    };

    // check lần đầu
    checkServer();

    // set interval để check lại sau mỗi 10s
    intervalId = setInterval(checkServer, 15000);

    // cleanup khi unmount
    return () => clearInterval(intervalId);
  }, [isApiMissing, setIsStatusServer, setServerStatusDetail]);

  const degraded = serverStatusDetail?.status === "degraded";

  return (
    <div className="flex items-center gap-2 text-sm">
      {isStatusServer === null ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-warning animate-bounce"></div>
          </div>
          <span className="text-orange-600 font-medium flex items-center">
            Đang kiểm tra server <BouncyLoader size={20} color="orange" />
          </span>
        </>
      ) : isStatusServer ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-success animate-ping"></div>
            <div className="status status-success"></div>
          </div>
          <span className="text-green-600 font-medium flex items-center">
            Server đang chạy <RiEmotionHappyLine className="ml-1" />
          </span>
        </>
      ) : degraded ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-warning animate-pulse"></div>
          </div>
          <span className="text-orange-600 font-medium">
            Server chạy nhưng thiếu cấu hình
          </span>
        </>
      ) : (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-error animate-pulse"></div>
          </div>
          <span className="text-red-600 font-medium flex items-center">
            {isApiMissing ? "Chưa cấu hình API" : "Server lỗi"}{" "}
            <TbMoodCrazyHappy className="ml-1" />
          </span>
        </>
      )}
    </div>
  );
};

export default StatusServer;
