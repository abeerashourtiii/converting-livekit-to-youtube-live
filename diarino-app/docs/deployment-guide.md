# دليل النشر إلى Production — Diarino

المشروع المستهدف: **Diarino Production** — `https://nwbtzchtwyhqktoerbap.supabase.co`

> ⚠️ **ملحوظة بعد التحويل من LiveKit إلى YouTube Live:** كل ما فى هذا
> الملف عن `LIVEKIT_*` / `RECORDING_S3_*` / `livekit-*` Edge Functions
> **قديم ومُلغى** — سيبقى كسجل تاريخي لقرارات النشر والـ rollback وقتها،
> لكن للنشر الفعلي دلوقتي اتبعوا `scripts/deploy-commands.sh` (مُحدَّث)
> و`docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` بدلًا من الأقسام اللي تتكلم عن
> LiveKit فى الملف ده.

⚠️ **تنبيه مهم قبل أي شيء آخر — افصل بين نوعين مختلفين من "Secrets":**

| النوع | أين يعيش | ماذا يجوز أن يكون فيه |
|---|---|---|
| **EAS Secrets / `eas.json`'s `env`** | يُبنى داخل حزمة التطبيق نفسها، **يصبح عامًا (public) بمجرد البناء** — أي شخص يفكّك ملف الـ APK/IPA يراه | فقط القيم المخصَّصة لتكون عامة: `EXPO_PUBLIC_SUPABASE_URL`، `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key). هذه **مصمَّمة** لتكون عامة — الحماية الحقيقية للبيانات هي RLS، وليست سرّية الـ anon key |
| **Supabase Edge Function secrets** (`supabase secrets set`) | يعيش على سيرفرات Supabase فقط، **لا يصل أبدًا لجهاز المستخدم** | كل شيء حسّاس فعليًا: `LIVEKIT_API_SECRET`، `RECORDING_S3_SECRET`، `PUSH_WEBHOOK_SECRET`. هذه **يجب ألا تظهر أبدًا** بأي بادئة `EXPO_PUBLIC_` ولا في `eas.json` |

**تحقّقت من `eas.json` الحالي:** يحتوي على `EXPO_PUBLIC_SUPABASE_URL` و`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` فقط لكل بيئة (development/preview/production) — وهذا **صحيح وآمن تمامًا**، لأن هذين مصمَّمان ليكونا عامين. لكن قبل أن تكملوا: **تأكدوا أن ما وضعتموه في "EAS Secrets" هو فقط من العمود الأول أعلاه.** إذا كان `LIVEKIT_API_SECRET` أو أي مفتاح S3 موجودًا هناك بدلًا من `supabase secrets set`، فهذا تسريب حقيقي يجب إصلاحه فورًا قبل أي بناء جديد — أخبروني إن كنتم غير متأكدين وسأساعد في المراجعة.

---

## ٠) قبل أي شيء آخر: مفتاح Google Maps API (Android)

**هذا شرط مسبق (prerequisite) لبناء الإنتاج على أندرويد — يجب إنجازه قبل تنفيذ `eas build`، وليس بعده.** إذا نُفِّذ البناء والمفتاح لا يزال القيمة الافتراضية `REPLACE_WITH_YOUR_ANDROID_MAPS_API_KEY` الموجودة حاليًا في `app.json`، فستُبنى نسخة الإنتاج بخريطة لا تعمل إطلاقًا في شاشة البحث الجغرافي (`app/(tabs)/search.tsx`) — ولإصلاحها لاحقًا يجب زيادة `android.versionCode` وإعادة البناء والرفع من جديد، وهو مكلف مقارنة بضبط المفتاح من البداية.

### أي Google API فعليًا مطلوب؟

تم فحص الكود فحصًا فعليًا (وليس افتراضًا) للتأكد من هذا: الخرائط تُستخدم فقط عبر `react-native-maps` لعرض الخريطة والدبابيس (`components/search/PropertiesMapView.native.tsx`، `components/search/MapPicker.native.tsx`، `components/search/GeoSearchModal.tsx`) — لا يوجد أي استدعاء لـ Places Autocomplete أو Directions API أو Geocoding API من Google في أي مكان بالكود. تحويل العنوان النصي إلى إحداثيات عند نشر إعلان (`app/publish/create-listing.tsx`) يتم عبر `Location.geocodeAsync` من `expo-location`، وهو **جيوكودر على الجهاز نفسه ولا يستهلك أي Google API ولا يحتاج مفتاحًا منفصلاً**.

كذلك: `app.json` يضبط `android.config.googleMaps.apiKey` فقط — لا يوجد `ios.config.googleMapsApiKey` مقابل، لأن iOS لا يستخدم `PROVIDER_GOOGLE` في أي من ملفات الخريطة (السلوك الافتراضي لـ `react-native-maps` على iOS هو Apple Maps، وهذا لا يحتاج أي مفتاح Google على الإطلاق).

**الخلاصة: المطلوب تفعيله في Google Cloud Console هو "Maps SDK for Android" فقط.** لا داعي لتفعيل Places API أو Directions API أو Geocoding API — تفعيلها لن يكسر شيئًا، لكنه استهلاك غير ضروري لحصة الفوترة المجانية إن فُعِّل.

### خطوات إنشاء المفتاح وتقييده

1. **Google Cloud Console** → APIs & Services → Library → فعّلوا **Maps SDK for Android** فقط لمشروعكم.
2. APIs & Services → Credentials → Create Credentials → API key.
3. قيّدوا المفتاح فورًا (لا تتركوه بلا قيود):
   - **Application restrictions** → Android apps → أضيفوا:
     - Package name: `com.diarino.app`
     - SHA-1 certificate fingerprint: (من الخطوة التالية — ستحتاجون فعليًا **بصمتين**، وليس واحدة، انظر أدناه)
   - **API restrictions** → Restrict key → اختاروا "Maps SDK for Android" فقط.

### الحصول على SHA-1 — بصمتان مختلفتان مطلوبتان فعليًا

هذه النقطة يسهل الوقوع في خطأ بشأنها: مفتاح البناء (upload key) الذي يوقّع الـ AAB عند الرفع **ليس بالضرورة نفس** الشهادة التي يوقّع بها Google Play التطبيق فعليًا للمستخدمين النهائيين، بسبب **Play App Signing** (مُفعَّل افتراضيًا لأي تطبيق جديد على Play Console). لذلك أضيفوا كلا الفينجربرنت إلى نفس مفتاح الخرائط:

**أ) SHA-1 مفتاح الرفع (upload key) — عبر EAS، متاح فورًا قبل أي نشر:**
```bash
eas credentials
```
- اختاروا **Android** → بيئة **production** → **Keystore: Manage everything needed to build your project**
- يعرض الـ CLI مباشرة على الشاشة `SHA-1` و`SHA-256` الخاصين بالـ keystore الذي سيوقّع البناء.

**ب) SHA-1 مفتاح توقيع Play الفعلي (app signing key) — لا يظهر إلا بعد أول رفع للتطبيق على Play Console:**
- Play Console → التطبيق → **Release** (الإصدار) → **Setup** → **App integrity**
- تحت **App signing key certificate**، انسخوا قيمة **SHA-1 certificate fingerprint**.
- هذه هي البصمة التي يُوقَّع بها التطبيق فعليًا لكل من يحمّله من المتجر — وهي غالبًا **مختلفة** عن بصمة الـ EAS keystore في الخطوة (أ).

**لماذا الاثنتان معًا؟** بصمة الرفع (أ) تلزم لمسارات الاختبار الداخلي (Internal Testing / Internal App Sharing) التي قد لا تمر عبر Play App Signing بنفس الطريقة، وبصمة التوقيع الفعلية (ب) تلزم للنسخة الحية على المتجر. إضافة الاثنتين لنفس مفتاح API تضمن عمل الخرائط في الحالتين بلا أي تعديل لاحق.

### الترتيب الصحيح (مهم): `app.json` قبل `eas build`، دائمًا

```
1. أنشئوا المفتاح وقيّدوه في Google Cloud (بصمة EAS متاحة فورًا من eas credentials)
2. عدّلوا app.json → android.config.googleMaps.apiKey بالقيمة الحقيقية
3. احفظوا وأكّدوا (git commit) هذا التعديل
4. الآن فقط: eas build --platform android --profile production
5. بعد أول رفع ناجح لـ Play Console: ارجعوا وأضيفوا بصمة (ب) أعلاه لنفس مفتاح API في Google Cloud
   (لا حاجة لإعادة بناء التطبيق لهذه الخطوة الأخيرة — التقييد على مستوى Google Cloud فقط)
```
تعديل `app.json` **يجب أن يسبق** `eas build` لأن قيمة `apiKey` تُدمج داخل حزمة الـ APK/AAB وقت البناء نفسه — تعديلها بعد بناء موجود بالفعل يتطلب بناءً جديدًا بالكامل (ورقم إصدار جديد)، وليس مجرد إعادة رفع.

### تحقّق بعد التنفيذ
- [ ] "Maps SDK for Android" مفعّل في Google Cloud (وليس أي API آخر بدون داعٍ)
- [ ] المفتاح مقيّد بـ Package name `com.diarino.app` + بصمة EAS (أ) على الأقل قبل أول بناء
- [ ] `app.json`'s `android.config.googleMaps.apiKey` **لا يحتوي** القيمة الافتراضية `REPLACE_WITH_YOUR_ANDROID_MAPS_API_KEY`
- [ ] بعد أول رفع لـ Play Console: بصمة (ب) أُضيفت أيضًا لنفس المفتاح
- [ ] اختبار فعلي: فتح شاشة البحث الجغرافي (`app/(tabs)/search.tsx`) على بناء production حقيقي والتأكد من ظهور الخريطة فعليًا (ليست شاشة فارغة/رمادية)

---

## أ) قائمة أوامر Deploy المجمَّعة (بالترتيب)

```bash
# 0. الربط بمشروع الإنتاج (مرة واحدة فقط لكل جلسة عمل)
supabase link --project-ref nwbtzchtwyhqktoerbap

# 1. Migrations — كلها بالترتيب الزمني تلقائيًا عبر أمر واحد
supabase db push

# 2. Secrets الخاصة بالـ Edge Functions (سيرفر فقط، ليست EAS)
supabase secrets set LIVEKIT_URL=<قيمتكم>
supabase secrets set LIVEKIT_API_KEY=<قيمتكم>
supabase secrets set LIVEKIT_API_SECRET=<قيمتكم>
supabase secrets set RECORDING_S3_ACCESS_KEY=<قيمتكم>
supabase secrets set RECORDING_S3_SECRET=<قيمتكم>
supabase secrets set RECORDING_S3_ENDPOINT=<قيمتكم>
supabase secrets set RECORDING_S3_BUCKET=<قيمتكم>
supabase secrets set RECORDING_S3_REGION=<قيمتكم>   # اختياري، افتراضيًا us-east-1
supabase secrets set PUSH_WEBHOOK_SECRET=<سلسلة عشوائية طويلة تختارونها الآن>

# 3. Edge Functions — كلها (6 دوال)
supabase functions deploy livekit-token
supabase functions deploy livekit-recording
supabase functions deploy livekit-moderate
supabase functions deploy livekit-send-message
supabase functions deploy livekit-webhook --no-verify-jwt
supabase functions deploy send-push --no-verify-jwt

# 4. خطوات يدوية عبر لوحات التحكم (لا يوجد أمر CLI لها — تفصيل في القسم ب)
#    - Database Webhook لـ send-push
#    - LiveKit Cloud webhook URL
#    - Cloudinary upload preset (Unsigned)
#    - Supabase S3 Connection لـ bucket "live-recordings"
#    - OAuth redirect URL (Google)
#    - مفتاح Google Maps API (Android) — تفصيل كامل في القسم (٠) أعلاه
#      يجب إنجازه قبل الخطوة 5 التالية، وليس بعدها

# 4.ب — قبل eas build: احصلوا على بصمة SHA-1 (upload key) لتقييد مفتاح Maps
eas credentials
# اختاروا Android → production → Keystore: Manage everything needed to build your project
# ثم عدّلوا app.json بأنفسكم يدويًا: android.config.googleMaps.apiKey = "<قيمتكم الحقيقية>"
# ولا تتابعوا للخطوة 5 قبل أن تختفي القيمة REPLACE_WITH_YOUR_ANDROID_MAPS_API_KEY نهائيًا من app.json

# 5. بناء التطبيق للإنتاج (بعد التأكد من app.json أعلاه فقط)
eas build --platform android --profile production
eas build --platform ios --profile production

# 6. الإرسال للمتاجر (بعد اكتمال البناء)
eas submit --platform android --profile production
eas submit --platform ios --profile production

# 7. بعد أول رفع ناجح لـ Play Console فقط:
#    Play Console → Release → Setup → App integrity → انسخوا SHA-1 certificate fingerprint
#    وأضيفوه في Google Cloud Console لنفس مفتاح Maps API (بجانب بصمة EAS من الخطوة 4.ب)
#    — لا حاجة لإعادة بناء التطبيق لهذه الخطوة
```

> 📄 نسخة مستقلة وجاهزة للنسخ من كل هذه الأوامر بالترتيب (بلا شرح) موجودة في
> [`scripts/deploy-commands.sh`](../scripts/deploy-commands.sh).

---

## ب) الدليل خطوة بخطوة

### الخطوة 1 — الربط بالمشروع

```bash
supabase login          # مرة واحدة على جهازكم، يفتح متصفحًا للمصادقة
supabase link --project-ref nwbtzchtwyhqktoerbap
```

**قبل التنفيذ:** تأكدوا أنكم تربطون المشروع الصحيح فعلًا — نفّذوا `supabase projects list` وقارنوا الـ ref مع `nwbtzchtwyhqktoerbap` قبل المتابعة. ربط الأمر بمشروع خاطئ (مثلًا Dev بدل Production) يعني أن كل ما يلي سيُطبَّق على القاعدة الخاطئة.

**بعد التنفيذ:** الأمر يطبع اسم المشروع المرتبط — تأكدوا أنه "Diarino Production" وليس مشروع الـ dev/preview (`nlvrmmwujnwifwedhagy`).

### الخطوة 2 — تشغيل Migrations

```bash
supabase db push
```

**قبل التنفيذ (مهم جدًا):**
1. **خذوا نسخة احتياطية يدوية أولًا** — Supabase Dashboard → Database → Backups → "Create backup now" (أو `pg_dump` إذا كنتم تفضّلون نسخة محلية). Point-in-Time Recovery وحده غير كافٍ كخطة أولى لأنه قد لا يكون مفعّلًا حسب خطتكم.
2. راجعوا أن `supabase migration list` لا يُظهر أي migration محلي "متعارض" أو مفقود مقارنة بما هو مُطبَّق فعلًا على production (خصوصًا لو سبق وطبّقتم migrations يدويًا عبر SQL Editor في وقت ما).
3. الأمر يطبّق **كل** الملفات في `supabase/migrations/` التي لم تُطبَّق بعد، بالترتيب الزمني تلقائيًا (أسماء الملفات مبنية على timestamp) — لا حاجة لتحديد ملف بعينه.

**بعد التنفيذ — اختبروا فورًا (SQL Editor أو `psql`):**
```sql
-- تأكدوا أن الجداول/الدوال الجديدة موجودة فعليًا
select * from public.profiles_public limit 1;
select public.is_admin();  -- يجب أن يرجع false/true بلا خطأ
select * from public.live_message_rate_buckets limit 1;  -- يجب أن يرجع صفًا فارغًا بلا خطأ (RLS يمنع القراءة لكم كمستخدم authenticated عادي، لكن كـ service role في SQL Editor يعمل)
```
لو ظهر أي خطأ "relation does not exist" أو "function does not exist"، توقفوا فورًا ولا تكملوا للخطوة التالية — راجعوا `supabase migration list` لمعرفة أي ملف فشل.

### الخطوة 3 — ضبط الـ Secrets

```bash
supabase secrets list   # لمعرفة ما هو موجود حاليًا قبل التعديل
```

ثم كل أمر `supabase secrets set KEY=value` من القسم (أ) أعلاه، كلٌّ على حدة.

**قبل التنفيذ:** اجمعوا كل القيم مسبقًا من مصادرها (LiveKit Cloud dashboard، Supabase Storage → S3 Connection، إلخ) بدل تشغيل الأوامر وانتظار كل قيمة على حدة.

**بعد التنفيذ:**
```bash
supabase secrets list
```
تأكدوا أن كل الأسماء التسعة ظاهرة (القيم نفسها لا تُعرض، فقط الأسماء — هذا طبيعي وآمن).

### الخطوة 4 — نشر Edge Functions

نفّذوا كل أمر `supabase functions deploy` من القسم (أ) بالترتيب المذكور — **الترتيب هنا غير حرج فعليًا** (الدوال مستقلة عن بعضها في وقت النشر)، لكن يُفضَّل نشر `livekit-token` أولًا لأنها الأكثر اعتمادًا عليها من باقي التطبيق.

**بعد كل دالة:**
```bash
supabase functions list   # تأكدوا أن الحالة "deployed" وليست "error"
```

**اختبار فعلي بعد نشر الكل** (الأهم):
- من التطبيق نفسه (أو عبر `curl` مع توكن مستخدم حقيقي حصلتم عليه من تسجيل دخول تجريبي)، جرّبوا:
  - فتح بث تجريبي (يختبر `livekit-token`)
  - إرسال تعليق أثناء البث (يختبر `livekit-send-message` + `bump_live_message_rate`)
  - طرد مشاهد تجريبي (يختبر `livekit-moderate`)
  - إنهاء البث والتأكد من ظهور رابط التسجيل لاحقًا (يختبر `livekit-recording` + `livekit-webhook`)

### الخطوة 5 — الخطوات اليدوية عبر لوحات التحكم

لا بديل عن تنفيذها يدويًا (README القسم 2 يشرحها بالتفصيل الكامل، هذا ملخص سريع):

1. **Database Webhook لـ send-push**: Supabase Dashboard → Database → Webhooks → إنشاء واحد على جدول `notifications`، حدث `Insert`، Header `x-webhook-secret` = نفس قيمة `PUSH_WEBHOOK_SECRET` من الخطوة 3.
2. **LiveKit Webhook**: LiveKit Cloud dashboard → Settings → Webhooks → أضيفوا `https://nwbtzchtwyhqktoerbap.supabase.co/functions/v1/livekit-webhook`.
3. **Cloudinary**: تأكدوا أن الـ upload preset (`Diarino_uploads`) مضبوط على **Unsigned**.
4. **S3 Connection**: Supabase Dashboard → Storage → S3 Connection، مع bucket باسم `live-recordings`.
5. **OAuth Redirect**: تأكدوا أن Google OAuth redirect URL يشير لمشروع production الصحيح (وليس مشروع dev بالخطأ).

**بعد التنفيذ:** جرّبوا تسجيل دخول Google كامل من التطبيق (يختبر #5)، وبثًا كاملاً ينتهي فعليًا (يختبر #1، #2، #4 معًا).

### الخطوة 6 — بناء التطبيق

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

**قبل التنفيذ:**
- تأكدوا أن `eas.json`'s `production.env` يشير فعلًا لـ `nwbtzchtwyhqktoerbap.supabase.co` (تحققت — هذا صحيح حاليًا).
- تأكدوا أن رقم الإصدار (`app.json`'s `version`/`ios.buildNumber`/`android.versionCode`) مُحدَّث عن آخر نسخة منشورة، وإلا سترفضه المتاجر.
- شغّلوا `npx tsc --noEmit` محليًا للتأكد من عدم وجود أخطاء type قبل رفع وقت بناء EAS (البناء نفسه قد يستغرق 15-30 دقيقة، ومكلف لو فشل بسبب خطأ بسيط كان يمكن اكتشافه محليًا في ثوانٍ).

**بعد التنفيذ:** حمّلوا الـ build الناتج على جهاز حقيقي (عبر رابط EAS أو TestFlight/Internal Testing) وجرّبوا **كل السيناريوهات الحرجة يدويًا قبل الإرسال للمتجر**: تسجيل دخول (Google + ضيف)، نشر إعلان، بث مباشر كامل (بدء → تعليق → طرد → إنهاء → مشاهدة إعادة)، شات، تسجيل خروج ثم دخول بحساب آخر (يختبر إصلاح الـ cache تحديدًا).

### الخطوة 7 — الإرسال للمتاجر

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

بعدها الطرح يخضع لمراجعة المتجر (Google عادة ساعات، Apple 1-3 أيام) — وحتى بعد القبول، يُفضَّل **طرح تدريجي (staged rollout)** إن كانت المتاجر تدعمه في إعداداتكم، بدل طرح 100% من المستخدمين دفعة واحدة.

---

## ج) قائمة تحقق مجمَّعة (Checklist)

### قبل البدء بأي شيء
- [ ] نسخة احتياطية من قاعدة بيانات Production مأخوذة يدويًا
- [ ] تأكدتم أن `supabase link` يشير لـ `nwbtzchtwyhqktoerbap` وليس مشروع آخر
- [ ] راجعتم أن EAS Secrets تحتوي فقط على القيم العامة (anon key/URL) — لا أسرار LiveKit/S3 فيها
- [ ] لديكم كل قيم الـ 9 secrets جاهزة قبل بدء `supabase secrets set`
- [ ] "Maps SDK for Android" مفعّل في Google Cloud، والمفتاح مقيّد بـ package name + بصمة SHA-1 من `eas credentials` (تفصيل كامل في القسم ٠)
- [ ] `app.json`'s `android.config.googleMaps.apiKey` مُحدَّث بقيمة حقيقية — **قبل** تنفيذ أي `eas build`، وليس بعده

### بعد `supabase db push`
- [ ] `select * from public.profiles_public limit 1;` يعمل بلا خطأ
- [ ] `select public.is_admin();` يعمل بلا خطأ
- [ ] لا رسائل خطأ في مخرجات الأمر نفسه

### بعد نشر كل Edge Function
- [ ] `supabase functions list` يُظهر الحالة "deployed" للجميع
- [ ] بث تجريبي كامل (بدء → تعليق → لايك → طرد → إنهاء) ينجح من طرف لطرف

### بعد الخطوات اليدوية
- [ ] تسجيل دخول Google يعمل من نسخة production
- [ ] بث ينتهي ويظهر رابط إعادة المشاهدة خلال دقائق
- [ ] إشعار push فعلي يصل بعد حدث حقيقي (لايك/متابعة)

### بعد `eas build`
- [ ] `npx tsc --noEmit` نظيف قبل الرفع
- [ ] رقم الإصدار مُحدَّث
- [ ] اختبار يدوي كامل على جهاز حقيقي قبل `eas submit` (القائمة في الخطوة 6 أعلاه)
- [ ] **تحديدًا**: تسجيل خروج ثم دخول بحساب مختلف على نفس الجهاز، والتأكد أن بيانات الحساب الأول (شات، مفضلة) لا تظهر للحساب الثاني — هذا يختبر إصلاح مسح الـ Cache مباشرة
- [ ] شاشة البحث الجغرافي تعرض الخريطة فعليًا على بناء production حقيقي (وليست شاشة فارغة/رمادية بسبب مفتاح Maps ناقص)

### بعد أول رفع لـ Play Console
- [ ] بصمة SHA-1 لمفتاح توقيع Play (App integrity → App signing key certificate) أُضيفت لنفس مفتاح Maps API في Google Cloud، بجانب بصمة EAS

---

## د) خطة Rollback

### 1. لو فشلت Migrations أو ظهرت مشكلة بعدها
**الخيار الأول (الأسرع، للمشاكل المحدودة):** الملفات الثلاثة الجديدة من هذه الجولة (`20260825`, `20260826`, `20260827`) قابلة للتراجع يدويًا عبر SQL Editor:

```sql
-- تراجع عن 20260827 (known_regions length guard)
alter table public.known_regions
  drop constraint if exists known_regions_name_length,
  drop constraint if exists known_regions_province_length;

-- تراجع عن 20260826 (rate limiting)
drop function if exists public.cleanup_old_rate_buckets();
drop function if exists public.bump_live_message_rate(uuid, text, text, int);
drop table if exists public.live_message_rate_buckets;
-- ملاحظة: هذا وحده لا يكفي — livekit-token يصدر الآن canPublishData:false،
-- فبدون rollback الكود أيضًا (أو إعادة نشر نسخة سابقة من livekit-token)
-- ستنكسر التعليقات/اللايكات في البث تمامًا (canPublishData=false ولا آلية بديلة).

-- تراجع عن 20260825 (profiles RLS + is_public)
drop policy if exists "profiles readable by self, public accounts, chat partner, or staff" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users can create their own live room" on public.lives;
create policy "users can create their own live room"
  on public.lives for insert to authenticated with check (host_id = auth.uid());

drop view if exists public.profiles_public;
drop function if exists public.is_admin();
```

⚠️ **تحذير حرج**: هذا الـ rollback على قاعدة البيانات وحدها **يكسر التطبيق** إذا كانت نسخة التطبيق المنشورة (من `eas build`) هي النسخة الجديدة — لأن الكود الجديد يستدعي `profiles_public`، `livekit-send-message`، إلخ، وهذه لن تعمل بلا الـ migrations. **القاعدة الذهبية: لا تُرجعوا قاعدة البيانات لوحدها أبدًا بعد أن يكون تطبيق جديد منشورًا فعليًا للمستخدمين — إما ترجعون الاثنين معًا (قاعدة البيانات + طرح تطبيق سابق)، أو لا ترجعون شيئًا وتُصلحون للأمام (roll forward) بدلًا من الرجوع للخلف.**

**الخيار الثاني (الأشمل، لو المشكلة أعمق):** استعادة النسخة الاحتياطية الكاملة من الخطوة "قبل البدء" (Supabase Dashboard → Database → Backups → Restore). هذا يُرجع **كل شيء** لحظة أخذ النسخة، وليس فقط الـ migrations الثلاثة الجديدة.

### 2. لو فشلت Edge Function معيّنة بعد النشر
```bash
git log --oneline -- supabase/functions/<اسم-الدالة>/index.ts   # لإيجاد النسخة السابقة
git checkout <commit-قبل-التعديل> -- supabase/functions/<اسم-الدالة>/index.ts
supabase functions deploy <اسم-الدالة>
```
دوال LiveKit الخمس مستقلة عن بعضها في وقت التشغيل (لا تستدعي بعضها البعض)، فإرجاع دالة واحدة فقط آمن ولا يؤثر على البقية.

### 3. لو فشل الـ build أو ظهرت مشكلة بعد الطرح للمتجر
- **Google Play**: Play Console → الإصدار المعني → "Halt rollout" لو كان طرحًا تدريجيًا لم يكتمل بعد، أو نشر نسخة سابقة كـ hotfix جديد (لا يوجد "تراجع" حقيقي في Play Store — فقط طرح نسخة أحدث تصحّح المشكلة، أو إيقاف الطرح التدريجي الحالي).
- **App Store**: مراجعة Apple تستغرق وقتًا، فـ "التراجع" العملي الوحيد هو رفع نسخة مصحَّحة جديدة بأسرع ما يمكن — Apple لا تسمح بإرجاع تلقائي لنسخة سابقة بعد النشر.
- **الأهم فعليًا**: التوصية الأقوى هي عدم الوصول لهذه المرحلة أصلًا — الاختبار اليدوي الكامل على جهاز حقيقي (خطوة 6 في القسم ب) **قبل** `eas submit` هو خط الدفاع الحقيقي، لأن التراجع بعد نشر متجر بطيء ومكلف مقارنة بأي مرحلة سابقة.

### 4. لو ظهرت مشكلة في الخريطة تحديدًا (Maps) بعد الطرح
هذه المشكلة **لا تحتاج rollback على الإطلاق** — لأن مفتاح Maps مُقيَّد على مستوى Google Cloud فقط وليس مدمجًا كـ "منطق" داخل الكود:
- خريطة فارغة/رمادية لكل المستخدمين → على الأغلب المفتاح غير مفعّل لـ "Maps SDK for Android" أو الفوترة غير مفعّلة على مشروع Google Cloud — تحقّق فورًا من Google Cloud Console → Billing، لا حاجة لبناء جديد.
- خريطة تعمل على بعض الأجهزة وتفشل على أخرى (أو تعمل في الاختبار الداخلي وتفشل للمستخدمين العامين) → غالبًا بصمة SHA-1 الناقصة هي بصمة Play App Signing (الخطوة (ب) في القسم ٠) — أضيفوها في Google Cloud، والتغيير يسري خلال دقائق بلا أي بناء جديد.

---

## ه) أول 24 ساعة بعد الإطلاق — ما يجب مراقبته

الهدف في أول يوم ليس "الاسترخاء" بعد الطرح، بل مراقبة نشطة قصيرة تلتقط أي مشكلة قبل أن تصل لعدد كبير من المستخدمين (خصوصًا مع staged rollout).

### أول ساعة
- [ ] **Supabase Dashboard → Logs → Edge Functions**: راقبوا الأخطاء (لا سيما `livekit-token`، `send-push`) لحظة بلحظة — أي ارتفاع مفاجئ في معدل الأخطاء يعني مشكلة حقيقية وليست ضجيجًا عابرًا.
- [ ] **Supabase Dashboard → Database → Logs**: تأكدوا من عدم وجود أخطاء RLS متكررة (`permission denied for table ...`) — هذه علامة أن migration أو policy لم تُطبَّق كما هو متوقع رغم نجاح `db push` ظاهريًا.
- [ ] جرّبوا بأنفسكم من نسخة الإنتاج الفعلية (المثبَّتة من المتجر لا من EAS build مباشرة): تسجيل دخول، فتح بث تجريبي، إرسال رسالة شات — إعادة نفس اختبارات "الخطوة 6" لكن هذه المرة على النسخة الحقيقية التي يستخدمها الناس.

### أول 3-6 ساعات
- [ ] **Play Console → Quality → Android vitals** (يظهر تدريجيًا): راقبوا معدل الـ crashes/ANRs — أي ارتفاع واضح فوق المعتاد يستدعي وقف الطرح التدريجي (`Halt rollout`) فورًا بدل الانتظار.
- [ ] **App Store Connect → Analytics** (إن كانت النسخة على iOS خرجت من المراجعة): نفس الفكرة لتقارير الأعطال.
- [ ] **LiveKit Cloud dashboard**: تأكدوا أن عدد الغرف/الاتصالات الفعلي منطقي وليس صفرًا (يعني أن `livekit-token` يفشل صامتًا) ولا مرتفعًا بشكل غير متوقع (يعني تسريب/إساءة استخدام).
- [ ] **Cloudinary dashboard → Usage**: تأكدوا أن الرفع يعمل فعليًا (عدد الرفعات > 0) وأن الحصة (quota) الشهرية بعيدة عن الحد.

### أول 24 ساعة
- [ ] **معدل نجاح تسجيل الدخول**: قارنوا عدد محاولات Google OAuth الناجحة مقابل الفاشلة (لو متاح عبر Supabase Auth logs) — فشل مرتفع هنا يعني مشكلة في OAuth redirect URL تحديدًا (راجعوا القسم ب/الخطوة 5، البند 5 هناك).
- [ ] **push notifications**: تأكدوا من وصول إشعار حقيقي واحد على الأقل لكل من Android وiOS بعد حدث فعلي (لايك/متابعة) من مستخدم حقيقي غير جهازكم الشخصي.
- [ ] **متابعة الشكاوى الأولية** (لو كان هناك قناة دعم/بريد): أي نمط متكرر (مثلًا "لا أرى الخريطة" أو "لا تصلني الإشعارات") أوضح إشارة عملية على مشكلة نشر فعلية أهم من أي مقياس تقني بمفرده.
- [ ] **قرار الطرح التدريجي**: لو staged rollout مفعّل ولا توجد مؤشرات سلبية بعد 24 ساعة، ارفعوا النسبة تدريجيًا (Play Console يدعم ذلك مباشرة) بدل القفز لـ 100% فورًا.

**قاعدة عامة لهذه المرحلة**: أي مؤشر سلبي واضح في أول 3-6 ساعات → أوقفوا الطرح التدريجي فورًا وابحثوا عن السبب قبل إكمال النسبة المتبقية، لأن استكمال الطرح لجمهور أكبر أثناء وجود مشكلة معروفة يوسّع الضرر بلا داعٍ.
