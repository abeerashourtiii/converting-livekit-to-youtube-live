import { useEffect } from "react";
import { supabase } from "../supabase";
import { useMyContent } from "./useMyContent";

const POLL_MS = 5000;

export function useSyncProcessingRecordings() {
  const { savedLives, updateSavedLive } = useMyContent();

  // استخراج معرّفات العناصر التي تحت المعالجة كـ String ثابت
  const processingIds = savedLives
    .filter((l) => l.recordingStatus === "processing")
    .map((l) => l.id)
    .join(",");

  useEffect(() => {
    if (!processingIds) return;

    const processingLives = savedLives.filter((l) => l.recordingStatus === "processing");

    // دالة الفحص التي تُنفذ فوراً وتُكرر في الـ Interval
    const checkStatus = async () => {
      for (const live of processingLives) {
        try {
          const { data, error } = await supabase
            .from("lives")
            .select("recording_status, recording_url")
            .eq("room_name", live.roomName)
            .maybeSingle();

          if (error) {
            console.error("Error fetching recording status:", error.message);
            continue;
          }

          if (data && (data.recording_status === "ready" || data.recording_status === "failed")) {
            updateSavedLive(live.id, {
              recordingStatus: data.recording_status,
              recordingUrl: data.recording_url ?? null,
            });
          }
        } catch (err) {
          console.error("Unexpected error syncing recording:", err);
        }
      }
    };

    // 1. تشغيل الفحص فوراً عند فتح الصفحة
    checkStatus();

    // 2. تشغيل الفحص كل 5 ثوانٍ
    const interval = setInterval(checkStatus, POLL_MS);

    return () => clearInterval(interval);
  }, [processingIds]); // التبعية أصبحت متغيرة نصية بسيطة وثابتة Reference-wise
}