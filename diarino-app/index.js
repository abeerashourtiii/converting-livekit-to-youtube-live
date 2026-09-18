// ٠) إضافة Polyfills لـ TextDecoder و ReadableStream لبيئة Hermes (Android/APK/iOS/Web)
// نستخدم require المباشر مع التثبيت الصريح على global و globalThis
if (typeof global.TextDecoder === "undefined") {
  try {
    require("fast-text-encoding");
  } catch (e) {
    console.warn("[Polyfill] fast-text-encoding is missing");
  }
}

if (
  typeof global.ReadableStream === "undefined" ||
  typeof globalThis.ReadableStream === "undefined"
) {
  try {
    const { ReadableStream } = require("web-streams-polyfill");
    if (ReadableStream) {
      global.ReadableStream = ReadableStream;
      globalThis.ReadableStream = ReadableStream;
    }
  } catch (err) {
    console.warn("[Polyfill] Failed to load web-streams-polyfill:", err);
  }
}

// ↔ ملحوظة تاريخية بعد التحويل من LiveKit إلى YouTube Live: كان هنا
// ترقيع DOMException + استدعاء registerGlobals() بتاع LiveKit، لازمين
// وقتها لأن livekit-client/@livekit/react-native-webrtc بيعتمدوا على
// WebRTC globals (RTCPeerConnection, RTCDataChannel...) وعلى DOMException
// اللي مش موجود أصلًا فى Hermes. البث دلوقتي بيتم عبر RTMP (تشفير
// كاميرا مباشر لسيرفر يوتيوب) عند المذيع، وعبر iframe player جاهز
// (react-native-youtube-iframe) عند المشاهد — مفيش WebRTC خالص فى
// المسار الجديد، فالترقيعان دول ملغيان تمامًا. راجع
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md لتفاصيل الانتقال.

// نقطة دخول التطبيق الحقيقية — بتتحمّل قبل أي حاجة تانية خالص، حتى قبل
// expo-router نفسه. راجع "main" فى package.json.
require("expo-router/entry");
