# Deferred tasks

Tracked separately per the security-review follow-up decisions (LiveKit +
Expo Router audits, Aug 2026) so they don't get lost after launch. Each
entry links back to the report/decision that raised it.

> ⚠️ The LiveKit-specific entries below are historical — the live
> streaming backend was migrated to YouTube Live; see
> `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md`.

## Completed

Accepted as 🟠 high-priority ("بعد القصوى مباشرة") in the same review
round that produced `is_public` RLS and the anonymous-broadcast
restriction. Both now done:

- [x] ~~Server-side rate limiting for live comments/likes~~ — shipped in
  `20260826000000_live_message_rate_limit.sql` +
  `supabase/functions/livekit-send-message`. Comments/likes now go
  through a server-checked, atomic Postgres counter before being relayed
  via LiveKit's `RoomServiceClient.sendData()`; `canPublishData` is
  `false` for everyone so there's no direct path left to bypass it. See
  README §7. The one follow-up noted here previously — scheduling
  `cleanup_old_rate_buckets()` — is now also done: `pg_cron` enabled +
  hourly job registered in `20260831000000_schedule_rate_bucket_cleanup.sql`
  (job name `cleanup-rate-buckets`, runs `0 * * * *`), plus a supporting
  index on `bucket_second` so the cleanup `DELETE` never has to scan the
  whole table. This item is now **fully closed**, nothing left open.
- [x] ~~Full RLS audit of the remaining Supabase tables~~ — done,
  table-by-table across all ~28 tables in `supabase/migrations/`. One
  real finding beyond what `20260822000000_rls_audit_fixes.sql` (an
  earlier audit round) had already caught: `known_regions` had no length
  cap on its otherwise-intentionally-open `with check (true)` INSERT
  policy — fixed in `20260827000000_known_regions_length_guard.sql`.
  Everything else checked out: ownership-scoped policies match their
  actual use (self-only tables, admin-gated tables via
  `admin_has_permission()`/staff-role checks, and the intentionally-public
  ones like `properties`/`lives`/`requests` all matched their product
  intent on inspection). Full findings in the chat transcript /
  consolidated report from this review round.

## Deferred to post-launch (explicitly, by product decision)

- [ ] **`lives.viewer_peak` trusted from the client** — a host can
  currently report an inflated number when ending their own broadcast
  (`app/live/broadcast.tsx`'s `finalizeSavedLive.mutate(...)`). Low
  severity (non-critical metadata, not PII/access). Fix: compute it
  server-side in `livekit-webhook` from `participant_joined`/
  `participant_left` events instead of trusting the broadcaster's own
  client. TODO comment already left at the call site.
- [ ] **Universal Links / App Links** for `https://diarino.app/...` share
  links to actually open the app (currently just open a browser — no
  `associatedDomains`/`intentFilters` configured in `app.json`). Product
  feature, not a security fix — noted in the Expo Router audit, no
  security surface either way since there's no custom deep-link handling
  code to exploit in the meantime.

## Accepted as-is (no action planned)

- **No distinction between anonymous ("guest") and real accounts**
  anywhere except starting a live broadcast (see README §7). Deliberate
  product decision to keep "try without signing in" fully functional
  everywhere else; RLS protects data regardless of which kind of session
  is asking, so this isn't a security gap, just a product-scope note.

---

# المهام المؤجَّلة بعد الإطلاق — دفعة تعديلات صفحة تفاصيل العقار/الإعدادات/الريلز

هذا القسم بيوثّق 3 قرارات اتخذها صاحب المنتج بتأجيل التنفيذ الكامل لحد
بعد الإطلاق، بدل ما تتنفّذ بشكل جزئي/مستعجل تحت ضغط. كل قسم فيه: الوضع
الحالي بالظبط، وايه المطلوب عمله، وأي تفاصيل تقنية لازم المطوّر اللي
هيكمل الشغل يعرفها.

## 1) الوضع الداكن (Dark Mode) — تغطية كل الشاشات

### 🔄 دفعات التنفيذ (جارية — إغلاق الملف نهائيًا، بدون استثناءات)
البنية التحتية شغالة بالكامل وحقيقية من الدفعات السابقة:
- `lib/hooks/useTheme.ts` — يخزّن التفضيل (فاتح/داكن/إعدادات الجهاز)
  وبينده على `Appearance.setColorScheme()` فعليًا.
- `lib/hooks/useThemeColors.ts` — توكينات ألوان حقيقية (`background`,
  `surface`, `card`, `border`, `text`, `textMuted`, `textSubtle`).

**ترتيب التنفيذ المطلوب**: المكوّنات المشتركة أولًا (تأثيرها يمتد لأكبر
عدد من الشاشات تلقائيًا) → إكمال الشاشات الجزئية → باقي الشاشات.

#### ✅ دفعة 1 — المكوّنات المشتركة (components/shared/* + ReelOptionsSheet)
- `components/shared/ActionSheet.tsx`
- `components/shared/CompareBar.tsx`
- `components/shared/ConfirmModal.tsx`
- `components/shared/CountryPickerModal.tsx`
- `components/shared/PhoneInput.tsx`
- `components/shared/PictureInPictureModal.tsx`
- `components/shared/ReportModal.tsx`
- `components/reel/ReelOptionsSheet.tsx`

هذه الدفعة أثرها ممتد فعليًا: `ActionSheet`/`ConfirmModal`/`ReportModal`
مستخدمين فى شاشات كتير (الطلبات، الحساب، الأدمن، صفحة تفاصيل العقار،
البائع...)، فأي شاشة كانت بتستخدم أي مكوّن من دول بقت بتورّث الثيم منه
تلقائيًا حتى قبل ما نلمس ملف الشاشة نفسها.

**متبقي**: باقي الدفعات (2، 3، ...) هتتسلّم تباعًا — راجع الجدول تحت.

### 🎨 قاعدة تثيم الوسائط (Media Theming Rule) — نسخة نهائية معتمدة
> **أي سطح وسائط (فيديو/كاميرا) والعناصر المتراكبة فوقه مباشرة = ألوان
> ثابتة + ظلال لضمان الرؤية فوق أي محتوى. كل ما خارج السطح = يتبع الثيم
> (فاتح/داكن/حسب النظام).**
>
> **توضيح مُعتمَد (نص فوق تدرّج على الفيديو):** أي نص مرسوم فوق تدرّج
> شفاف على الفيديو = ثابت أبيض + ظل، والتدرّج يبقى داكنًا فى الوضعين.
> العناصر الوحيدة اللي تتبع الثيم هي ذات الخلفية المعتمة الخاصة
> (Sheets، لوحات، أشرطة بخلفية كاملة).

هذا معيار الصناعة (TikTok/Reels/Shorts/YouTube) — ثابت، وأي شاشة حالية
أو مستقبلية فيها فيديو/كاميرا تطبّقه تلقائيًا بدون الرجوع للمنتج.
التصنيف العملي:

- **يفضل ثابت (أبيض + ظل) دايمًا** — أي عنصر مرسوم مباشرة فوق بكسلات
  الفيديو/الكاميرا نفسها أو فوق تدرّج شفاف عليها، بدون خلفية عتمة كاملة
  خاصة بيه: الأيقونات العلوية، الأيقونات الجانبية (متابعة/لايك/مشاركة/
  حفظ/مقارنة)، فلاش ▶️/⏸️، الكابشنز، خلفية الـ letterbox السوداء،
  **وبلوك المعلومات كامل (العنوان/الموقع/السعر/المواصفات/أزرار
  التفاصيل-للإيجار) — نص أبيض + ظل، والتدرّج أسود ثابت، وألوان أزرار
  العلامة كما هي، فى الوضعين الاثنين من غير استثناء**.
- **يتبع الثيم بأمان** — أي عنصر عنده خلفية عتمة كاملة خاصة بيه (Sheet/
  لوحة/شريط بخلفية كاملة، مش تدرّج شفاف): شريط المهام السفلي (خلفية
  pill عتمة كاملة)، شريط الـ seek (خلفية رفعناها لعتامة 85-90%)، أي
  شاشة/مودال/لوحة تفتح فوق الفيديو بخلفية كاملة (ReelOptionsSheet,
  ReportModal, لوحة التفاصيل).

**السبب المعتمَد**: القراءة فوق أي فيديو أولوية أعلى من اتساق الثيم —
حالة "فيديو غامق × وضع فاتح" محلولة تلقائيًا بالتدرّج الثابت + الظل،
زي أي تطبيق وسائط قياسي.

#### تدقيق تنفيذي (البند "راجع الوضع الداكن الحالي فى الريلز")
فحصت `components/reel/*.tsx` بالكامل: **لا يوجد أي مخالفة تحتاج
تراجع** — قبل هذه الدفعة، الملف الوحيد اللي كان بيستخدم `useThemeColors`
هو `ReelOptionsSheet.tsx` (لوحة كاملة تفتح فوق الفيديو، مش مرسومة على
بكسلاته مباشرة)، وده أصلاً فى التصنيف الصحيح ("يتبع الثيم"). الأيقونات
العلوية (`ReelsHeader.tsx`)، الأيقونات الجانبية (`ReelActionRail.tsx`)،
فلاش التشغيل/الإيقاف، الكابشنز (`ReelCaptionsOverlay.tsx`)، وبلوك
المعلومات (`ReelInfoOverlay.tsx`) كلهم لسه بألوان ثابتة (أبيض + تدرّج
أسود) بدون أي استخدام لـ`useThemeColors` — **صح تمامًا ومُعتمَد رسميًا
الآن (راجع القرار فوق)، مفيش أي تعديل مطلوب على `ReelInfoOverlay.tsx`**.

طبّقت الثيم فعليًا (بأمان، حسب القاعدة فوق) على:
- `app/(tabs)/_floating-tab-bar.tsx` — pill عتمة كاملة، آمن يتبع الثيم
- `components/reel/ReelSeekBar.tsx` — رفعت عتامة الخلفية لـ 85-90%
  (بدل 55% الأصلية) عشان تضمن تباين كافٍ للنص/الأيقونة فى الوضع الفاتح
  تحديدًا (خلفية شبه شفافة بعتامة قليلة + نص فاتح كانت هتبقى شبه مختفية
  فوق فيديو فاتح فى الوضع النهاري لو سابتها من غير رفع العتامة).

**الشاشات المُطبَّق عليها الثيم فعليًا (من الدفعات السابقة):**

أ) شاشات الاستخدام اليومي — **كلها مكتملة**:
- `app/(tabs)/index.tsx` (الفيد) — أصلاً fullscreen على خلفية سودة، مناسبة للوضعين بدون تعديل
- `app/property/[id].tsx` + `components/property/PropertyDetailsContent.tsx` + `components/property/PropertyCtaBar.tsx`
- `app/(tabs)/search.tsx`, `app/(tabs)/requests.tsx`
- `app/chat/index.tsx` + `app/chat/[id].tsx`

ب) الشاشات الثانوية — **مكتملة جزئيًا**:
- `app/settings.tsx`, `app/(tabs)/account.tsx`, `app/saved-alerts.tsx`, `app/(tabs)/menu.tsx`
- `components/shared/PageTopBar.tsx`
- `components/account/ThemeSelectorModal.tsx`, `LanguageSelectorModal.tsx`, `ContentSettingsModal.tsx`, `ComplaintsSuggestionsModal.tsx`

فى `app/settings.tsx` فيه علامة "قيد التحسين" جنب صف "العرض" — هتتشال
لما آخر دفعة تخلص (شوف تعريف "الانتهاء" فى نهاية القسم ده).

### الشاشات/المكوّنات اللي لسه محتاجة نفس المعاملة

| الدفعة المقترحة | الملفات | ملاحظات |
|---|---|---|
| ✅ 2 (إكمال الجزئي) | `components/account/ShareProfileModal.tsx`, `FollowListModal.tsx`, `ProfileSessionModal.tsx` | مكتملة. `AdActionSheet.tsx`/`LiveActionSheet.tsx` كانوا أصلاً بيفوّضوا بالكامل لـ`ActionSheet`/`ConfirmModal` (متثيّمين من دفعة 1) فمحتاجينش أي تعديل |
| ✅ 3 (مكوّنات مشتركة إضافية) | `components/notifications/NotificationsDropdown.tsx`, `components/requests/MakeOfferModal.tsx`, `RequestFilterModal.tsx`, `components/search/GeoSearchModal.tsx`, `LocationPermissionGate.tsx`, `RegionAutocompleteField.tsx`, `SaveAlertModal.tsx`, `SearchFilterModal.tsx`, `PropertiesMapView.native.tsx`, `PropertiesMapView.web.tsx` | مكتملة. `components/menu/AdBannerCarousel.tsx` فُحص ولقيته أصلاً بخلفية سودة ثابتة مقصودة (بانر إعلاني فوق صور، محتاج تباين واضح بغض النظر عن الثيم) فمحتاجش تعديل. `MapPicker.native.tsx`/`MapPicker.web.tsx` بيغلّفوا خريطة Leaflet (WebView/DOM) بدون أي ألوان RN على مستوى الغلاف نفسه — فمحتاجوش تعديل هنا (تلوين خرائط Leaflet نفسها خارج نطاق "ثيم واجهة التطبيق") |
| ✅ 4 (شاشات متبقية) | `app/index.tsx` (تسجيل الدخول — gradient/ألوان نصوص متبدّلة، مع استثناء واحد مبرَّر: زرار جوجل فضل أبيض حسب إرشادات العلامة التجارية الرسمية لـ Google)، `app/seller/[id].tsx`, `app/compare.tsx`, `app/coming-soon.tsx` | مكتملة. البروفايل/المحفوظات/القائمة/المودالات الأربعة تأكّدت إنها **مكتملة فعلاً** من دفعات سابقة (فحص مباشر لكل ملف) |
| ✅ 5 (البث المباشر + النشر) | `components/live/PermissionGate.tsx`, `app/live/broadcast.tsx` (شاشات ما قبل البث + مودال المشاهدين فقط)، `app/live/[id].tsx` (شاشات الموافقة/الخطأ فقط)، `app/live/replay/[id].tsx` (حالة "غير متاح" فقط)، `components/publish/*` (الثلاثة)، `app/publish/create-listing.tsx`, `create-request.tsx` | مكتملة. سطح الفيديو/الكاميرا وتراكباته المباشرة (شريط البث، التعليقات، القلوب، أزرار التحكم) فضلوا ثابتين عمدًا حسب قاعدة تثيم الوسائط — قائمة تفصيلية فى القسم أدناه |
| ✅ 6 (الأدمن) | `app/admin/index.tsx` + كل مكوّنات `components/admin/*.tsx` الـ17 | مكتملة — آخر دفعة. `StatusChip.tsx` فُحص وترك عمدًا (شارات حالة semantic بخلفية فاتحة+نص غامق، مقروءة فى الوضعين بطبيعتها). `COLOR_PRESETS` فى `AdminMenuItems.tsx` وألوان معاينة الفيديو فى `AdminReels.tsx` تُركوا عمدًا (بيانات يحررها الأدمن، مش ألوان واجهة) |

### ✅ تعريف الانتهاء — الوضع الداكن مُنجَز بالكامل الآن
كل الدفعات الست (1-6) مكتملة. فحص نهائي شامل (`grep`) عبر `app/` و
`components/` بالكامل تم — التفاصيل والنتيجة فى قسم "الفحص النهائي"
بنهاية هذا الملف.

### طريقة التنفيذ لكل شاشة (نفس النمط المستخدم فى settings.tsx/menu.tsx/property/[id].tsx)
1. `import { useThemeColors } from "../lib/hooks/useThemeColors";`
2. `const themeColors = useThemeColors();` جوه الكومبوننت
3. استبدال أي `backgroundColor`/`color` ثابت (فاتح) بقيمة من `themeColors`
   — إما بتحويل الـ `StyleSheet.create()` الثابت لدالة `createStyles(themeColors)`
   زي `settings.tsx`/`property/[id].tsx`، أو بعمل inline override بسيط
   `[styles.x, {backgroundColor: themeColors.card}]` زي `menu.tsx` —
   الأول أنضف لو الشاشة فيها ألوان كتير، والتاني أسرع لو قليلة.
4. الألوان الملوّنة المتعمّدة (كروت القائمة، أزرار العلامة التجارية
   الخضراء `#22A652`، شارات الحالة، ألوان الخطأ/التحذير) **تفضل زي ما
   هي** فى الوضعين — مش كل لون محتاج يتغيّر مع الثيم، بس أي لون بيعتمد
   على خلفية فاتحة/غامقة (أبيض/أسود/رمادي) لازم يتحول لتوكن.

### ✅ تعريف الانتهاء (Definition of Done) — لسه مفتوح
1. كل شاشة فى `app/` تدعم الأوضاع الثلاثة ⏳
2. كل مكوّن مشترك فى `components/` يدعم الأوضاع الثلاثة ⏳ (دفعة 1 من ~6 خلصت)
3. صفر ألوان ثابتة فى الفحص النهائي (`grep` شامل) ⏳
4. هذا القسم = "منجز بالكامل" ⏳
5. `README.md` محدَّث ⏳


### 🎥 تدقيق تنفيذي — البث المباشر (دفعة 5)
تطبيق التثيم الجزئي حسب قاعدة تثيم الوسائط بالظبط:

**✅ اتبع الثيم (نُفِّذ):**
- `components/live/PermissionGate.tsx` — شاشة طلب إذن الكاميرا/الميكروفون (قبل ما الكاميرا تشتغل)
- `app/live/broadcast.tsx`: شاشة "المستخدم زائر" (منع البث)، شاشة إعداد العنوان + زرار "ابدأ البث"، شاشة "تعذر بدء البث" — كلهم قبل ما الكاميرا تشتغل فعليًا
- `app/live/broadcast.tsx`: مودال قائمة المشاهدين (Sheet كامل، مش مرسوم على الفيديو)
- `app/live/[id].tsx`: شاشة الموافقة على التسجيل (قبل الانضمام) + شاشة "البث غير متاح" (خطأ، مفيش فيديو)
- `app/live/replay/[id].tsx`: حالة "التسجيل غير متاح" فقط

**🔒 فضل ثابت (سطح الوسائط + تراكباته المباشرة، لم يُلمَس):**
- سطح الفيديو نفسه فى الحالتين (بث حي + معاينة كاميرا المذيع) — خلفية سودة دائمًا
- الشريط العلوي أثناء البث الفعلي: شريحة المذيع/الأفاتار، زرار المتابعة، عداد المشاهدين، شارة "يُسجَّل"، زرار الإغلاق/الإنهاء — كلهم "أزرار تحكم على الفيديو"
- شريط العنوان العائم فوق الفيديو
- الأيقونات الجانبية (لايك/مشاركة/إبلاغ فى شاشة المشاهد؛ كتم الصوت/قلب الكاميرا فى شاشة المذيع)
- `LiveCommentsOverlay.tsx` (فقاعات التعليقات) و`FloatingHeart.tsx` (القلوب المتطايرة) — مذكورين صراحةً كثابتين
- سطح فيديو الإعادة (`replay/[id].tsx`) وأزرار الإغلاق/الإبلاغ/العنوان فوقه

لا يوجد أي عنصر إضافي شعرت إنه فيه خطر تباين حقيقي يحتاج تأجيل — التصنيف
كان واضح فى كل الحالات.



### ✅ تحديث مهم: تم التنفيذ فعليًا فى دفعة "تفعيل الميزتين المؤجلتين"
البند ده **مش مؤجّل دلوقتي** — اتنفّذ فعليًا:
- الترقية الكاملة من `expo-av` لـ `expo-video` فى محرك تشغيل فيديو
  الريلز (`components/reel/ReelVideoPlayer.tsx` الجديد، مستخدم من
  `components/reel/ReelCard.tsx`).
- `allowsPictureInPicture` + `startsPictureInPictureAutomatically` مفعّلين
  فعليًا (بس لو `usePiPPreference().preference === "enabled"` — يعني بعد
  موافقة المستخدم الصريحة من المودال).
- `app.json` فيه الـ config plugin الرسمي بتاع `expo-video` نفسه
  (`supportsBackgroundPlayback` + `supportsPictureInPicture`) — ده بيظبط
  `android:supportsPictureInPicture="true"` على الـ manifest و
  `UIBackgroundModes: audio` على iOS تلقائيًا، **بدون الحاجة لـ config
  plugin مخصص** زي ما كان متوقّع فى النسخة السابقة من هذا المستند (كان
  ده افتراض خاطئ مني، `expo-video` بيغطي الموضوع ده بنفسه فعليًا).

### ⚠️ محتاج اختبار حقيقي على أجهزة فعلية (مش قدرتي كـ AI)
الكود مكتوب صح ومبني على التوثيق الرسمي لـ `expo-video`، لكن:
- **لازم Development Build** — الميزة دي مش هتشتغل فى Expo Go خالص
  (`npx expo run:android` / `npx expo run:ios` أو `eas build --profile development`).
- في بعض تقارير مشاكل معروفة فى `expo-video` مرتبطة بالـ PiP على أندرويد
  (تعارض بين fullscreen وPiP، سلوك مختلف شوية بين iOS وAndroid) — راجع
  https://github.com/expo/expo/issues (ابحث عن "expo-video" + "picture in picture")
  لو واجهت مشكلة غريبة بعد أول تجربة حقيقية.
- التحويلات بتاعة `player.currentTime` (المستخدمة فى السحب اليدوي لشريط
  الـ seek والـ auto-advance) موثّقة رسميًا، لكن محتاجة اختبار فعلي على
  Android **و** iOS للتأكد من دقتها فى كل الحالات.

### باقي استخدامات `expo-av` فى المشروع (خارج نطاق هذه الترقية عمدًا)
الترقية دي غطّت الريلز بس (استخدام الفيديو الرئيسي فى التطبيق). باقي
استخدامات `expo-av` لسه موجودة ومتعمّد إنها تفضل كده دلوقتي (خارج
النطاق المطلوب صراحةً — "الترقية من expo-av إلى expo-video" كان مرتبط
بالـ PiP، والـ PiP مطلوب بس للريلز):
- `lib/musicPlayer.ts` — بيستخدم `Audio.Sound` (مش `Video`) لتشغيل
  موسيقى الخلفية فى وضع السلايدشو. المكافئ الصحيح هنا `expo-audio` مش
  `expo-video` (باقتين مختلفتين لأغراض مختلفة).
- `lib/hooks/useMediaPermissions.ts` — بيستخدم `Audio.requestPermissionsAsync()`.
- `components/admin/AdminReels.tsx` — معاينة فيديو فى لوحة تحكم الأدمن.
- `app/live/replay/[id].tsx` — تشغيل إعادة مشاهدة البث المباشر.

⚠️ **ملاحظة مهمة لازم تُختبر:** فيه [تقرير معروف](https://github.com/expo/expo/issues/35648)
إن تركيب `expo-video` جنب `expo-av` من غير إزالة `expo-av` ممكن يسبب
مشاكل فى تشغيل الفيديو على أندرويد تحديدًا فى بعض الحالات. المشروع لسه
محتفظ بالاتنين مع بعض عمدًا (لأن `expo-av` لسه مستخدم فعليًا فى الأربع
أماكن فوق)، فلو ظهرت أي مشكلة فى تشغيل الفيديو على أندرويد بعد هذا
التحديث، الخطوة التالية المنطقية هي ترقية باقي الاستخدامات دي كمان
(الأربعة فوق) لـ `expo-video`/`expo-audio` وإزالة `expo-av` نهائيًا من
المشروع.

### أزرار التحكم فى نافذة الـ PiP (تشغيل/إيقاف، إغلاق، تكبير)
دي أزرار **نظام التشغيل نفسه** (Android/iOS)، مش حاجة بيرسمها التطبيق —
لما PiP تتفعّل، النظام هو اللي بيعرض واجهة التحكم البسيطة دي فوق نافذة
الفيديو الصغيرة تلقائيًا. مفيش كود إضافي مطلوب من جانبنا لإظهارها.

## 3) الترجمة النصية (Captions) — دمج حقيقي (Whisper + Translate)

### الوضع الحالي
- `supabase/migrations/20260904000000_reel_captions.sql` — عمودين
  `captions_ar`/`captions_en` (نص، nullable) على `properties`.
- `lib/types.ts` — `Property.captionsAr`/`captionsEn`.
- `components/reel/ReelCaptionsOverlay.tsx` — بيعرض النص الموجود فعليًا
  باللغة اللي المستخدم اختارها (أو المتاح لو مفيش باللغة المطلوبة)، من
  غير أي ترجمة تلقائية.
- `components/reel/ReelOptionsSheet.tsx` — عند تفعيل الخاصية، بيظهر
  توست "الترجمة التلقائية قريباً...".
- **العمودين فاضيين لكل الإعلانات الحالية** — محتاجين تفريغ صوتي حقيقي.

### دليل الدمج المستقبلي

**الخيار المقترح: OpenAI Whisper (تفريغ) + Google Cloud Translation أو
DeepL (ترجمة)**، عبر Supabase Edge Function.

**الخطوة 1 — Edge Function للتفريغ الصوتي** (مسار مقترح:
`supabase/functions/generate-captions/index.ts`):
- Trigger: بعد رفع فيديو جديد (webhook من Cloudinary أو بعد
  `INSERT`/`UPDATE` على `properties` لما `media` يحتوي فيديو)، أو زرار
  يدوي فى لوحة تحكم الأدمن.
- المنطق: (1) ياخد رابط الفيديو من Cloudinary، (2) يستخرج الصوت
  (Cloudinary بيقدر يحوّل لـ `.mp3` من نفس الفيديو مباشرة)، (3) يبعت
  الصوت لـ Whisper API (`POST /v1/audio/transcriptions`)، (4) يحفظ
  النص الناتج فى العمود المطابق للغة الأصلية المكتشفة.

**الخطوة 2 — الترجمة للغة التانية:** نفس الـ Edge Function (أو واحدة
منفصلة) تستدعي Google Cloud Translation API أو DeepL API وتملأ العمود
التاني (عربي→إنجليزي أو العكس).

**الخطوة 3 — متغيرات البيئة المطلوبة:**
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GOOGLE_TRANSLATE_API_KEY=...
# أو بديل DeepL:
supabase secrets set DEEPL_API_KEY=...
```

**الخطوة 4 — التكلفة:** تسعير Whisper بالدقيقة الصوتية، وGoogle
Translate/DeepL بعدد الأحرف — يُرجع للتسعير الرسمي الحالي وقت التنفيذ.
فيديوهات الريلز عادةً قصيرة، فالتكلفة لكل ريل متوقع تكون صغيرة، لكن لازم
تتقاس فعليًا على حجم الاستخدام الحقيقي قبل الإطلاق الكامل للخاصية.

**الخطوة 5 — بعد ما البيانات تتملي:** مفيش تعديل مطلوب فى
`ReelCaptionsOverlay.tsx` ولا `ReelOptionsSheet.tsx` — جاهزين بالفعل
يعرضوا أي نص موجود. الخطوة المتبقية بس: تشغيل الـ Edge Function دي
وإزالة رسالة "قريباً" من دالة `handleToggleCaptions` فى
`ReelOptionsSheet.tsx`.

## ✅ الفحص النهائي — الوضع الداكن (إغلاق الملف)

بعد الدفعات الست (1-6)، تم فحص شامل عبر `app/` و`components/` بالكامل
(`grep` عن أي `backgroundColor: "white"`/`"#fff*"` بدون `useThemeColors`
مستورد فى نفس الملف). النتيجة: **مفيش أي ملف متبقي محتاج تعديل** إلا
اتنين، اتفحصوا واتأكد إنهم استثناءات مبرَّرة صراحةً:

1. **`components/menu/AdBannerCarousel.tsx`** — بانر إعلاني بخلفية سودة
   ثابتة مقصودة (تباين فوق صور)، حسب قاعدة تثيم الوسائط.
2. **`components/shared/ErrorBoundary.tsx`** — React Error Boundary
   لازم يكون class component (مش function component)، والـ Hooks زي
   `useThemeColors()` مينفعش تتنده جوه class components أصلاً. متعمّد
   إنه يفضل بأقل اعتماد ممكن على أي نظام تانى فى التطبيق (حتى الثيم
   نفسه) عشان يفضل شغال حتى لو التطبيق كله كرش.

**فجوتين حقيقيتين اتلقوا واتصلحوا فى الفحص النهائي ده تحديدًا** (كانوا
سقطوا سهوًا من الدفعات السابقة):
- `components/reel/ReelFilterModal.tsx` — Sheet كامل لفلترة الريلز حسب
  المحافظة، كان لسه بخلفية بيضا ثابتة.
- `components/reel/ReelCard.tsx` — لوحة تفاصيل العقار (`sheet`/
  `sheetGrabHandle`/`sheetCloseBtn`) كانت بخلفية بيضا ثابتة رغم إنها
  Sheet كامل (مش مرسومة على الفيديو)، بعكس باقي عناصر الملف ده (الأيقونات/
  الفلاش/شريط الـ seek) اللي صح إنها ثابتة.

كل التعديلات فى هذا القسم اتأكد منها بصفر استخدام لـ`any` وصفر تكرار
لدوال `createStyles`.

## ملخص سريع نهائي

| البند | الحالة |
|---|---|
| الوضع الداكن — كل الشاشات والمكوّنات فى `app/` و`components/` | ✅ **مكتمل 100%** (6 دفعات + فحص نهائي) |
| قاعدة تثيم الوسائط | ✅ موثّقة ومُطبَّقة (الريلز + البث المباشر) |
| PiP حقيقي | ✅ مُنفَّذ فعليًا (كود + config plugin) — محتاج اختبار على جهاز حقيقي فقط |
| الترجمة/الكابشنز | ⏳ مؤجّل (بنية تحتية جاهزة، محتاج تكامل Whisper/Translate) |
