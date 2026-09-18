# دليل تنفيذ التحسين 5 — تحسين فيديو الريلز عبر Cloudinary (مؤجل لبعد الإطلاق)

## الوضع الحالي
`<Video source={{ uri: video.url }} />` في `components/reel/ReelCard.tsx` بيحمّل
رابط الفيديو الأصلي من Cloudinary زي ما هو، من غير أي تحويل جودة/ضغط تلقائي —
عكس الصور اللي بتعدي على `cldOptimized`/`cldThumbnail` (`q_auto,f_auto`) في كل
مكان بالتطبيق.

## الحل المقترح (نفس مبدأ تحسينات الصور، لكن لفيديو)

### الخطوة 1 — دالة تحويل جديدة في `lib/cloudinary.ts`
```ts
// إضافة بجانب cldOptimized/cldThumbnail الموجودين:
export function cldVideoOptimized(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return url;
  // q_auto: يختار Cloudinary أنسب جودة تلقائيًا حسب الشبكة/الجهاز
  // (نفس مبدأ q_auto المستخدم بالفعل مع الصور)
  return url.replace("/video/upload/", "/video/upload/q_auto/");
}
```

### الخطوة 2 — استخدامها في `ReelCard.tsx`
```tsx
// بدل:
<Video source={{ uri: video.url }} ... />
// يبقى:
<Video source={{ uri: cldVideoOptimized(video.url) }} ... />
```

### الخطوة 3 (اختياري، أثر أكبر) — Adaptive bitrate streaming
Cloudinary بيدعم HLS/MPEG-DASH عبر تحويل امتداد الرابط لـ `.m3u8`، وده بيسمح
بتبديل الجودة تلقائيًا أثناء التشغيل حسب سرعة الشبكة (بدل جودة ثابتة). محتاج:
- التأكد إن `expo-av`/الترقية المستقبلية لـ `expo-video` بتدعم HLS على المنصتين
  (native support موجود على iOS/Android غالبًا عبر `expo-av`، يحتاج اختبار فعلي).
- تعديل الرابط: `url.replace(/\.\w+$/, ".m3u8").replace("/video/upload/", "/video/upload/sp_auto/")`.

## ليه مؤجل؟
- يحتاج اختبار فعلي على جهاز حقيقي للتأكد إن `q_auto`/HLS شغالين صح مع `expo-av`
  في هذا المشروع تحديدًا قبل ما ينزل بيئة الإنتاج — مش تعديل نص سطر بلا مخاطر
  زي باقي التحسينات المنفذة.
- الأثر (تقليل استهلاك بيانات الفيديو) مهم لكن مش حاجب لإطلاق أولي — التحسينات
  1-4 (الذاكرة/البطارية/حجم التطبيق) أعلى أولوية وأثر مباشر على تجربة أول استخدام.

## خطة التنفيذ المقترحة (بعد الإطلاق)
| الخطوة | الوصف |
|---|---|
| 1 | إضافة `cldVideoOptimized` + تفعيلها في `ReelCard.tsx` فقط (أبسط تغيير، صفر مخاطرة تقريبًا) |
| 2 | قياس استهلاك البيانات قبل/بعد على جهاز حقيقي (DevTools Network أو مراقبة استهلاك الموبايل) |
| 3 | لو الأثر كويس ومفيش مشاكل تشغيل → تقييم الانتقال لـ HLS كخطوة تانية منفصلة |
