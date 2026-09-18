# الانتقال من LiveKit إلى YouTube Live — دليل شامل

هذا الملف هو المرجع الكامل لتحويل معمارية البث المباشر فى Diarino من
LiveKit (WebRTC) إلى YouTube Live API (RTMP + YouTube Data API v3).
اتبعوه بالترتيب قبل أي محاولة بث حقيقي.

---

## ١. ملخص التغيير المعماري

| | قبل (LiveKit) | بعد (YouTube Live) |
|---|---|---|
| بروتوكول الإرسال | WebRTC | RTMP |
| زمن التأخير (latency) | < 1 ثانية | ٤-٤٥ ثانية (حسب إعدادات YouTube) |
| مشغّل المشاهد | `@livekit/react-native` (WebRTC track) | `react-native-youtube-iframe` (iframe/WebView) |
| مصادقة المذيع | توكن يولّده السيرفر بمفتاح LiveKit | Google OAuth (حساب المذيع نفسه) |
| الدردشة/اللايكات | LiveKit data channel، مُرحّلة عبر Edge Function | جدول Postgres (`live_messages`) + Supabase Realtime |
| عدّاد المشاهدين | `useParticipants()` من LiveKit | Supabase Realtime Presence |
| طرد مشاهد | فصل اتصال WebRTC فعليًا | حظر من الدردشة فقط (لا يوجد فصل فعلي فى يوتيوب) |
| التسجيل/الإعادة | LiveKit Egress → تحميل لـ S3 | يوتيوب يؤرشف كل بث تلقائيًا كـ VOD |
| التكلفة | حسب دقائق البث الشهرية (LiveKit Cloud) | مجاني (حدود YouTube Data API فقط) |

الملفات/الدوال المحذوفة بالكامل: `lib/livekit.ts`,
`lib/livekit-platform.{tsx,native.tsx,web.tsx}`,
`lib/hooks/useLiveKitRoom.ts`,
`supabase/functions/livekit-{token,recording,webhook,send-message,moderate}`.

الملفات الجديدة: `lib/youtube.ts`, `lib/youtube-platform.{tsx,native.tsx,web.tsx}`,
`lib/hooks/useYouTubeLive.ts`,
`supabase/functions/youtube-{oauth-connect,create-broadcast,end-broadcast}`,
`supabase/migrations/20260911000000_youtube_live_streaming.sql`.

---

## ٢. خطوات إعداد يدوية **لازم تنفذوها أنتم** (Google Cloud Console)

هذا القسم لا يوجد له أمر CLI — لوحات تحكم فقط.

1. **مشروع Google Cloud** (استخدموا مشروع موجود أو أنشئوا جديد):
   https://console.cloud.google.com
2. **APIs & Services → Library** → فعّلوا **"YouTube Data API v3"**.
3. **APIs & Services → OAuth consent screen**:
   - نوع External (لو التطبيق عام)
   - أضيفوا Scope: `https://www.googleapis.com/auth/youtube.force-ssl`
   - ⚠️ هذا **restricted scope** — جوجل تتطلب **مراجعة أمنية (verification)**
     لظهوره لأي مستخدم غير مُدرَج كـ Test User. المراجعة ممكن تاخد من
     أيام لأسابيع، وقد تطلب فيديو توضيحي لاستخدام التطبيق للـ scope +
     Privacy Policy منشورة علنًا. **خططوا للتوقيت ده من الأول — لا تعتمدوا
     على إنه هيكون جاهز فى نفس يوم النشر.**
   - لحد ما تخلص المراجعة: أضيفوا حسابات المذيعين (Test users) يدويًا
     تحت "Test users" عشان تقدروا تجربوا.
4. **Credentials → Create Credentials → OAuth client ID**:
   - **Web application** (ده اللي `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
     السيرفر بيستخدموه، وهو نفسه `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` على
     العميل — Google Sign-In يحتاج الـ web client id حتى على الموبايل
     عشان يولّد `serverAuthCode`). أضيفوا:
     - Authorized JavaScript origins: origin نسخة الويب بتاعتكم
     - Authorized redirect URIs: نفس الـ origin (لازم يطابق اللي فى
       `lib/youtube-platform.web.tsx`)
   - **Android**: client id تانى بنفس نوع الحزمة (`com.diarino.app` —
     تأكدوا من الاسم الحقيقي فى `app.json`) + بصمة SHA-1 (من
     `eas credentials`، نفس البصمة المستخدمة لـ Google Maps فعليًا فى
     `scripts/deploy-commands.sh` قسم ٠).
   - **iOS**: client id تالت بنفس Bundle ID، وهياخد منكم "iOS URL scheme"
     (Reversed Client ID) — دي القيمة اللي لازم تحطوها بدل
     `TODO_REVERSED_CLIENT_ID_FROM_GOOGLE_CLOUD_CONSOLE` فى `app.json`
     تحت plugin `@react-native-google-signin/google-signin`.
5. **تفعيل البث المباشر على قناة كل مذيع**: كل حساب يوتيوب عايز يستخدم
   "بدء بث" لازم يفعّل Live Streaming من
   https://www.youtube.com/features — التفعيل بياخد لغاية ٢٤ ساعة بعد
   أول طلب، ومحتاج **توثيق رقم الهاتف**. ده مش حاجة نقدر نتجاوزها من
   الكود — لازم كل مذيع يعمل الخطوة دي على حسابه بنفسه قبل أول بث.

---

## ٣. سيرفر Supabase

```bash
supabase secrets set GOOGLE_CLIENT_ID=<web client id من قسم ٢.٤>
supabase secrets set GOOGLE_CLIENT_SECRET=<web client secret من قسم ٢.٤>
supabase secrets set YOUTUBE_QUEUE_CRON_SECRET=<سلسلة عشوائية طويلة تختارونها أنتم>
supabase db push       # يطبّق الـ migrations (البث + الكاش/الطابور)
supabase functions deploy youtube-oauth-connect
supabase functions deploy youtube-create-broadcast
supabase functions deploy youtube-end-broadcast
supabase functions deploy youtube-process-queue --no-verify-jwt
```

راجعوا `scripts/deploy-commands.sh` القسمين ٤ و٥ للنسخة الكاملة مع باقي
خطوات النشر (Maps، Cloudinary، إلخ).

**تأكد بعد `db push`:**
```sql
select public.is_youtube_connected();      -- false لحساب لسه ملحّقش يوتيوب
select * from public.live_message_rate_buckets limit 1;
```

### ٣.١ جدولة `youtube-process-queue` — **خطوة يدوية لازمة**

الدالة دي بترجع الطلبات المنتظرة (لما الحصة اليومية تخلص) للمحاولة تانى،
لكنها **متشغلش نفسها** — لازم حد يستدعيها بشكل دوري (كل ١٥-٣٠ دقيقة مثلًا).
اختاروا واحدة من الطريقتين:

**أ) Supabase Dashboard → Edge Functions → youtube-process-queue → Schedule**
(الأسهل، لو متاحة فى خطتكم) — حددوا Cron expression زي `*/15 * * * *`،
وأضيفوا Header: `x-cron-secret: <قيمة YOUTUBE_QUEUE_CRON_SECRET>`.

**ب) `pg_cron` + `pg_net`** (لو الـ Dashboard مايدعمش Scheduled Functions
فى خطتكم) — من SQL Editor:
```sql
select cron.schedule(
  'youtube-process-queue',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/youtube-process-queue',
    headers := jsonb_build_object('x-cron-secret', '<قيمة YOUTUBE_QUEUE_CRON_SECRET>')
  );
  $$
);
```
(يتطلب تفعيل extensions `pg_cron` و`pg_net` من Database → Extensions أولًا.)

⚠️ **لحد ما تعملوا الخطوة دي، أي طلب بث يترحّل للطابور (لما الحصة تخلص)
هيفضل عالق فى `youtube_broadcast_queue` من غير ما يتنفّذ تلقائيًا أبدًا.**

---

## ٤. التطبيق (Client)

```bash
npm install     # ⚠️ راجعوا القسم ٦ أولًا قبل تشغيل هذا الأمر
npx expo prebuild
npx expo run:android   # أو run:ios
```

- `.env`: أضيفوا `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (قسم ٢.٤).
- `app.json`: استبدلوا `TODO_REVERSED_CLIENT_ID_FROM_GOOGLE_CLOUD_CONSOLE`
  بالقيمة الحقيقية من قسم ٢.٤ (iOS فقط).
- `eas.json`: نفس المتغير فى الثلاث بيئات (development/preview/production).

---

## ٥. ⚠️ ما لم أستطع تنفيذه أو التحقق منه فى هذه البيئة

1. **`npm install` فعلي** — بيئة التنفيذ هنا بلا إنترنت، فمقدرتش أنزّل
   أي حزمة أو أتحقق إنها موجودة أصلًا على npm بالاسم/الإصدار اللي كتبته
   فى `package.json`. **قبل التنفيذ، شغّلوا يدويًا:**
   ```bash
   npm view @react-native-google-signin/google-signin versions --json
   npm view react-native-youtube-iframe versions --json
   npm view react-native-nodemediaclient versions --json
   ```
   وعدّلوا الأرقام فى `package.json` لو مختلفة. **`react-native-nodemediaclient`
   بالتحديد غير مضمون الصيانة حاليًا** — لو مش موجودة/متوقفة، بدائل
   معروفة لتشفير RTMP فى React Native تشمل مشاريع مبنية على HaishinKit
   (iOS) أو تعديل حزم مشابهة، أو كتابة native module صغير مخصوص. راجعوا
   `lib/youtube-platform.native.tsx` — التعليقات فيه توضح بالتفصيل
   الفرضيات المُتخذة عن شكل الـ API.
2. **بناء وربط الموديول native فعليًا** (`react-native-nodemediaclient`
   وما شابهه لا يوجد له Expo Config Plugin رسمي) — هيحتاج تعديل يدوي فى
   `android/` (Gradle) و`ios/` (Podfile/Xcode) بعد `expo prebuild`، ده
   عمل لازم يتم على جهاز حقيقي بمحرر Xcode/Android Studio فعلي.
3. **اختبار بث حقيقي على جهاز فعلي** (كاميرا + RTMP فعلي إلى يوتيوب) —
   محتاج جهاز Android/iOS حقيقي وحساب يوتيوب مفعّل للبث المباشر، ولا
   حاجة من ده متاحة فى بيئة التنفيذ هنا.
4. **مراجعة Google للـ `youtube.force-ssl` scope** — عملية بشرية عند
   Google، مش أمر تقنى ينفَّذ.
5. **تفعيل Live Streaming على قنوات المذيعين** — إجراء بيقوم بيه كل
   مذيع بنفسه على حسابه.
6. **`npx tsc --noEmit`** — لم أستطع تشغيله هنا (بيئة بلا `node_modules`
   مُنزَّلة)، فمحتاج تشغيله يدويًا بعد `npm install` للتأكد من عدم وجود
   أخطاء Types (خصوصًا حول أنواع مكتبتي `google-signin` و
   `youtube-iframe` اللي ممكن تختلف شكليًا حسب الإصدار الفعلي المُنزَّل).
7. **مراجعة أمنية/متجر بعد الإضافات الجديدة** — إضافة Google Sign-In
   وصلاحية RTMP على الكاميرا/الميكروفون ممكن تحتاج مراجعة Data Safety
   (Play Console) / Privacy Nutrition Label (App Store) محدَّثة.

---

## ٦. قيود معروفة فى التصميم الجديد (لا حل تقني لها حاليًا)

- **زمن تأخير أعلى بكثير** (ثوانٍ لدقيقة تقريبًا) — طبيعة RTMP/YouTube،
  مش حل مؤقت. أي تفاعل "لحظي" (كوميديا/تفاوض سعر مباشر) هيتأثر.
- **لا يوجد "طرد" فعلي لمشاهد** — أقصى حاجة ممكنة هي حظره من الدردشة
  (نفّذناها)، لكنه سيظل قادرًا على مشاهدة الفيديو نفسه. لا يوجد API من
  يوتيوب يسمح بفصل viewer محدد عن embed player.
- **البث بالكاميرا من المتصفح (Web) غير متاح** — لا توجد طريقة مدعومة
  لتحويل كاميرا المتصفح لـ RTMP مباشرة. الحل المطبَّق: إنشاء البث
  والحصول على مفتاح RTMP، ثم استخدام برنامج خارجي (OBS) للبث الفعلي.
- **حصة (Quota) YouTube Data API محدودة** — الافتراضي ١٠,٠٠٠ وحدة/يوم؛
  كل `liveBroadcasts.insert`/`liveStreams.insert`/`bind` تقريبًا ٥٠
  وحدة لكل عملية، يعني كل "بدء بث" يكلّف حوالي ١٥٠ وحدة — أي حوالي ٦٠
  بث كحد أقصى يوميًا بالحصة الافتراضية. لو التطبيق كبير، قدّموا طلب
  زيادة حصة (Quota increase request) من Google مبكرًا. (راجعوا قسم ٨
  لخاصيتي تقليل الاستهلاك بالكاش وقائمة الانتظار عند النفاد، المُنفّذتين
  فعليًا فى هذا الإصدار.)
- **لا يوجد Webhook موثوق من يوتيوب لحالة البث** (بخلاف LiveKit) — لو
  المذيع قفل التطبيق فجأة بدون إنهاء البث، الصف فى `lives` ممكن يفضل
  `status='live'` لحد ما تعملوا مهمة مطابقة (polling) دورية تستدعي
  `liveBroadcasts.list` وتتحقق من `lifeCycleStatus`. `enableAutoStop`
  المفعّل فى `youtube-create-broadcast` يقلل المشكلة (يوتيوب نفسه بيقفل
  البث بعد فترة انقطاع)، لكنه مش فوري.
- **معالجة الـ VOD بعد الإنهاء تاخد وقت** — `recording_status` بيتحدد
  'ready' فورًا بعد استدعاء `transition`، لكن يوتيوب فعليًا ممكن يستغرق
  دقايق لغاية ما الفيديو يكون قابل للتشغيل الكامل فعليًا.

---

## ٧. قائمة اختبار قبل الإطلاق

- [ ] ربط حساب يوتيوب من التطبيق (`connectYouTubeAccount`) ينجح ويحفظ
      فى `youtube_oauth_tokens`.
- [ ] بدء بث → يظهر Video ID صالح، وRTMP يبدأ يستقبل بيانات (تأكدوا من
      YouTube Studio → البث المباشر يظهر "live").
- [ ] مشاهد يفتح الشاشة ويشوف الفيديو عبر iframe.
- [ ] تعليق/لايك يظهر عند الطرفين عبر Realtime.
- [ ] حظر مشاهد من الدردشة يمنعه فعليًا من إرسال رسائل.
- [ ] إنهاء البث → status='ended' فى الداتابيز، والبث يقفل على يوتيوب.
- [ ] إعادة المشاهدة (`app/live/replay/[id].tsx`) تشغّل الفيديو المؤرشف.
- [ ] الويب: إنشاء بث يعرض مفتاح RTMP بنجاح لاستخدامه فى OBS.

---

## ٨. تقليل استهلاك الحصة (Quota) وقائمة الانتظار عند نفادها

اتنفذت خاصيتين إضافيتين فوق التصميم الأساسي فى قسم ١-٥:

### أ) كاش الـ `liveStream` لكل مذيع

قبل كده: كل "بدء بث" كان بيعمل ٣ نداءات لـ YouTube API —
`liveBroadcasts.insert` + `liveStreams.insert` + `bind` (~١٥٠ وحدة حصة
لكل بث). دلوقتي: `liveStreams.insert` بيتنفذ **مرة واحدة فقط** لكل مذيع
(أول بث له)، وباقى البثوث بتعيد استخدام نفس الـ stream (نفس رابط ومفتاح
RTMP) وتعمل `bind` بس على broadcast جديد — يوفّر ~٥٠ وحدة (ثلث الحصة)
لكل بث بعد الأول. القيم محفوظة فى `youtube_oauth_tokens.cached_stream_*`
(راجع `supabase/functions/_shared/youtubeBroadcast.ts`). لو الـ stream
المحفوظ اتلغى من ناحية يوتيوب (المذيع حذفه يدويًا من YouTube Studio
مثلًا)، الكود بيكتشف فشل الـ `bind` وينشئ stream جديد تلقائيًا مرة واحدة.

**ملحوظة مهمة:** مفتاح RTMP (`streamName`) بيفضل ثابت لكل مذيع طول ما
الـ stream متخزن. لو عايزين تدويرًا دوريًا للمفتاح لأسباب أمنية، امسحوا
`cached_stream_id`/`cached_ingestion_address`/`cached_stream_name` من
`youtube_oauth_tokens` يدويًا كل فترة (هيتعمل كاش جديد تلقائيًا فى أول
بث تالى لنفس المذيع).

### ب) قائمة انتظار عند نفاد الحصة اليومية

لما YouTube API يرجّع خطأ `quotaExceeded`/`dailyLimitExceeded`، الطلب
**مش بيفشل** — بيتسجل فى جدول `youtube_broadcast_queue` ويترجع للمذيع
رد `202` مع رسالة واضحة ("انتهت حصة يوتيوب اليومية... سيبدأ بثك تلقائيًا
فور توفر الحصة"). شاشة `app/live/broadcast.tsx` بتعرض شاشة انتظار مع زر
إلغاء، وبتتابع حالة الطلب لحظيًا عبر Realtime — بمجرد ما
`youtube-process-queue` (المُجدولة، راجع قسم ٣.١) تنجح فى تنفيذه، شاشة
المذيع بتنتقل تلقائيًا لوضع البث الحي من غير ما يعمل أي حاجة.

محاولات إعادة المحاولة: لو السبب "نفاد الحصة" تحديدًا، بتتجدول تلقائيًا
لمنتصف الليل بتوقيت المحيط الهادي (وقت تجديد حصة Google يوميًا). أي سبب
فشل تاني (خطأ شبكة، توكن ملغى...) بياخد exponential backoff لغاية ٦
محاولات، وبعدها الطلب بيتحدد `failed` برسالة الخطأ الحقيقية ويظهر تنبيه
للمذيع.

**⚠️ ما لم يُنفَّذ هنا (يحتاج تنفيذ/تحقق يدوي):**
- **جدولة `youtube-process-queue` فعليًا** — راجع قسم ٣.١، خطوة إلزامية
  وإلا الطابور مش هيتحرك أبدًا.
- **اختبار فعلي لسيناريو نفاد الحصة** — يحتاج استهلاك حصة حقيقية (أو
  حساب Google Cloud تجريبي بحصة مخفّضة) لمشاهدة رسالة الطابور فعليًا؛
  مقدرتش أحاكي استجابة `quotaExceeded` حقيقية من يوتيوب فى هذه البيئة.
- **جدولة تنظيف `youtube_broadcast_queue`** —
  `cleanup_old_youtube_queue_items()` موجودة فى الداتابيز لكن محتاجة
  جدولة (نفس طريقة قسم ٣.١) عشان تشتغل دوريًا، وإلا السجلات المكتملة/
  الفاشلة هتتراكم.
- **هذه الخاصية بتقلل من احتمالية نفاد الحصة، مش بديل عن طلب زيادة حصة
  (Quota increase) من Google لو التطبيق كبير** — راجعوا قسم ٦ لحساب
  الأرقام بالتفصيل.
