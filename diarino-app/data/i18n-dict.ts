// ↔ I18N_DICT in app-viewer.html — ported verbatim (same keys/values).
// Static UI chrome only (nav labels, buttons, field labels, governorate/area
// names, feature tags, the 6 mock listings' titles/descriptions) — exactly
// what the original dictionary covered, not a machine-translation of
// arbitrary user-generated content. Real listings a user publishes stay in
// whatever language they were written in, same as the original's behavior
// (translateText() only ever matched against this fixed dictionary).
export const I18N_DICT: Record<string, string> = {
  'الرئيسية':'Home','البحث':'Search','الطلبات':'Requests','القائمة':'Menu','ريلز':'Reels','الحساب':'Account','حسابي':'My Account',
  'إعلاناتي':'My Ads','طلباتي':'My Requests','المفضلة':'Favorites','المحادثات':'Chats','الإشعارات':'Notifications','اللغة':'Language',
  'عربي':'English','تواصل معنا':'Contact Us','تسجيل الخروج':'Log Out','تسجيل خروج':'Log Out','مشاركة عبر':'Share via',
  'واتساب':'WhatsApp','فيسبوك':'Facebook','ماسنجر':'Messenger','تليجرام':'Telegram','انستجرام':'Instagram','تيك توك':'TikTok','نسخ الرابط':'Copy Link','تويتر':'X',
  'انشر عقارك':'Publish Your Property','اطلب عقارك':'Request a Property','ابحث':'Find','ابحث عن عقار':'Find a Property','اشترِ واستأجر بسهولة':'Buy & rent with ease',
  'بدون أي رسوم':'No fees','والعروض توصلك':'Offers come to you','احمي نفسك':'Protect Yourself','مساحة اعلانية — اعرض هنا':'Ad Space — Advertise Here',
  'وكيلك القانوني':'Your Legal Agent','استشارات قانونية عقارية متخصصة':'Specialized real-estate legal consultations',
  'الإعدادات':'Settings','إدارة الحساب':'Manage Account','اطلع اللايف':'Go Live','لوحة تحكم الأدمن':'Admin Panel',
  'لوازم السباكة والكهرباء':'Plumbing & Electrical Supplies','ارفع صورة الطلبات ومن غير تعب التوصيل':'Upload a photo of what you need, hassle-free delivery',
  'اطلب الآن':'Order Now','عام':'General','الخصوصية':'Privacy','الدعم':'Support',
  'هل تريد تسجيل الخروج من حسابك؟':'Do you want to log out of your account?','العرض':'Appearance','الحساب العام':'Public Account',
  'إعدادات المحتوى والإشعارات':'Content & Notification Settings','الشكاوى والمقترحات':'Complaints & Suggestions',
  'مشاركة البروفايل':'Share Profile','بلوتوث':'Bluetooth','شوف بروفايلي على ديارينو':'Check out my profile on Diarino',
  'تم نسخ الرابط':'Link copied','تم نسخ الرابط، افتح ماسنجر والصقه في المحادثة':'Link copied — open Messenger and paste it in the chat',
  'تم نسخ الرابط، افتح انستجرام والصقه في القصة أو الرسائل':'Link copied — open Instagram and paste it in a story or DM',
  'تم نسخ الرابط، افتح تيك توك والصقه في البايو أو الرسائل':'Link copied — open TikTok and paste it in your bio or messages',
  'تعذر فتح واتساب، تم نسخ الرابط':"Couldn't open WhatsApp — link copied",'تعذر فتح فيسبوك، تم نسخ الرابط':"Couldn't open Facebook — link copied",
  'تعذر فتح X، تم نسخ الرابط':"Couldn't open X — link copied",'تعذر فتح تليجرام، تم نسخ الرابط':"Couldn't open Telegram — link copied",
  'تعذر فتح الرابط':"Couldn't open the link",'تعذر إجراء الاتصال':"Couldn't place the call",'تعذر فتح واتساب':"Couldn't open WhatsApp",'تعذر فتح الفيديو':"Couldn't open the video",
  'Repoo':'Repoo','تشطيبات وديكور':'Finishing & Decor','ونش ونقل أثاث':'Crane & Furniture Moving','عرض سعر فوري':'Instant Quote',
  'خدمات قانونية متخصصة للعقارات':'Specialized real-estate legal services','اطلع لايف':'Go Live','عنوان اللايف':'Live title','ابدأ البث':'Start streaming',
  'بث مباشر':'Live stream','إنهاء البث':'End stream','مشاهد':'viewers','اكتب تعليق ...':'Write a comment ...',
  // ↔ app/(tabs)/account.tsx's tab labels — لم تكن مضافة أصلًا.
  'المسودات':'Drafts','لايفات':'Lives','لا توجد لايفات محفوظة':'No saved lives',
  '⚠️ هذا البث يتم تسجيله. بانضمامك أنت توافق على التسجيل.':'⚠️ This broadcast is being recorded. By joining, you agree to being recorded.',
  'موافق':'Agree','يُسجَّل':'Recording',
  'المشاهدون':'Viewers','طرد المشاهد':'Remove viewer','هل تريد إزالة':'Remove','من البث؟':'from the broadcast?',
  'طرد':'Remove','تعذّر الطرد':"Couldn't remove viewer",'جارٍ الطرد...':'Removing...',
  'لا يوجد مشاهدون حاليًا':'No viewers yet','زائر':'Guest','تم إزالتك من البث':"You've been removed from the broadcast",
  'حسنًا':'OK',
  'يجب تسجيل الدخول بحساب Google لبدء بث مباشر':'You need to sign in with a Google account to start a live broadcast',
  'المتابعة كضيف لا تتيح بدء بث مباشر.':"Continuing as a guest doesn't allow starting a live broadcast.",
  'ابدأ بث مباشر وسيظهر لكل المتصفحين في صفحة الريلز':'Start a live stream visible to everyone browsing reels',
  'جولة مباشرة داخل شقة بالتجمع الخامس':'Live tour inside a Fifth Settlement apartment',
  'الوصف':'Description','عنوان الإعلان':'Ad Title','السعر':'Price','المساحة':'Area','الغرض':'Purpose','الغرض من الإعلان':'Ad Purpose',
  'للبيع':'For Sale','للإيجار':'For Rent','التفاصيل':'Details','متابعة':'Follow','متابَع ✓':'Following ✓',
  'إعلان':'Ads','متابع':'Followers','إعجاب':'Likes','اضغط لإضافة نبذة عنك ...':'Tap to add a bio ...',
  'حفظ':'Save','إلغاء':'Cancel','حذف':'Delete','تعديل':'Edit','رجوع':'Back','إغلاق':'Close','تطبيق':'Apply','إعادة ضبط':'Reset',
  // ↔ مودالات الفلترة (بحث/طلبات/ريلز) بتستخدم "إعادة تعيين" (مختلفة عن
  // "إعادة ضبط" الموجودة فوق) — وبند "أي عدد" و"الحد الأدنى للغرف" بتاعين
  // خانة "الحد الأدنى للغرف" فى فلتر البحث تحديدًا.
  'إعادة تعيين':'Reset','أي عدد':'Any','الحد الأدنى للغرف':'Minimum Rooms','الحد الأدنى':'Minimum',
  // ↔ CompareBar.tsx — كانت من غير أي ترجمة أصلًا فتظهر بالعربى وسط
  // واجهة إنجليزية.
  'قارن الآن':'Compare Now','للمقارنة':'To Compare',
  // ↔ GeoSearchModal.tsx — لازم مدخل حرفي (exact match) للجملة كاملة،
  // مش بس للكلمات المفردة جواها ('إلغاء'/'الموقع' فوق)، لأن الاستبدال
  // بالكلمة الفردية كان سايب "البحث ب" فى النص متوسط بالعربي (المشكلة
  // اللي اتوصفت: "cancel search بlocation").
  'البحث بالموقع':'Search by Location','إلغاء البحث بالموقع':'Cancel search by location',
  // ↔ خانة "المحافظة" فى فلتر البحث — "احذف جملة عن محافظة واكتفِ بـ
  // find" بدل ما "عن محافظة..." يفضل بالعربي وسط بلاسهولدر إنجليزي.
  'ابحث عن محافظة...':'Find...',
  'فلترة':'Filter','تصفية':'Filter','الكل':'All','فلترة الريلز حسب المحافظة':'Filter reels by governorate',
  'المواصفات':'Specs','الكماليات والمرافق':'Amenities & Facilities','المخطط':'Floor Plan','الموقع':'Location',
  'قابل للتفاوض':'Negotiable','غير قابل للتفاوض':'Non-negotiable','كاش':'Cash','قسط':'Installments',
  'جاهز للتسليم':'Ready to move','قيد الإنشاء':'Under construction','التسليم':'Delivery','تاريخ التسليم المتوقع':'Expected Delivery Date',
  'الغرف':'Rooms','عدد الغرف':'Rooms','الحمامات':'Bathrooms','عدد الحمامات':'Bathrooms','الريسبشن':'Reception','الطابق':'Floor','رقم الطابق':'Floor Number',
  'نوع التشطيب':'Finishing Type','نوع العقار':'Property Type','حالة العقار':'Property Status','طريقة الدفع':'Payment Method','السعر قابل للتفاوض':'Price Negotiable',
  'نعم':'Yes','لا':'No','عن المعلن':'About the Advertiser','اقرأ المزيد ...':'Read more ...','عرض أقل':'Show less','عرض كامل':'Full view',
  'اتصال':'Call','شات':'Chat','مخطط العقار':'Property floor plan','اضغط لفتح المخطط بالحجم الكامل':'Tap to open the full-size plan','لا توجد كماليات':'No amenities',
  'التشطيب':'Finishing','غير محدد':'Not specified','غرف':'Rooms','حمام':'Bath','م²':'m²','ج.م':'EGP','/ شهر':'/ month','حتى':'Up to',
  'شقة':'Apartment','فيلا':'Villa','بنتهاوس':'Penthouse','تاون هاوس':'Townhouse','تجاري':'Commercial','إداري':'Office','طبي':'Medical','أرض':'Land','محل تجاري':'Retail shop',
  'القاهرة':'Cairo','الجيزة':'Giza','الإسكندرية':'Alexandria','مطروح':'Matrouh','الدقهلية':'Dakahlia','البحر الأحمر':'Red Sea','البحيرة':'Beheira','الفيوم':'Fayoum',
  'الغربية':'Gharbia','الإسماعيلية':'Ismailia','المنوفية':'Monufia','المنيا':'Minya','القليوبية':'Qalyubia','السويس':'Suez','أسوان':'Aswan','أسيوط':'Asyut',
  'بورسعيد':'Port Said','دمياط':'Damietta','الشرقية':'Sharqia','الأقصر':'Luxor','قنا':'Qena','سوهاج':'Sohag','كفر الشيخ':'Kafr El-Sheikh','بني سويف':'Beni Suef',
  'الوادي الجديد':'New Valley','جنوب سيناء':'South Sinai','شمال سيناء':'North Sinai','المحافظة':'Governorate',
  'الشيخ زايد':'Sheikh Zayed','التجمع الخامس':'Fifth Settlement','6 أكتوبر':'6th of October','مدينتي':'Madinaty','الساحل الشمالي':'North Coast',
  'المعادي':'Maadi','الزمالك':'Zamalek','مدينة نصر':'Nasr City','مصر الجديدة':'Heliopolis','المهندسين':'Mohandessin','الرحاب':'Al Rehab','القطامية':'Katameya',
  'العاصمة الإدارية':'New Capital','العين السخنة':'Ain Sokhna','مدينة الشروق':'El Shorouk','العبور':'El Obour',
  'شقة فاخرة بتشطيب سوبر لوكس':'Luxury apartment with super-lux finishing',
  'فيلا مستقلة بحديقة وحمام سباحة':'Standalone villa with garden & pool',
  'شقة حديثة للإيجار':'Modern apartment for rent',
  'بنتهاوس بتراس وفيو مفتوح':'Penthouse with terrace & open view',
  'محل تجاري بواجهة مميزة':'Shop with a prime storefront',
  'شقة بحرية على البحر - قيد الإنشاء':'Seafront apartment — under construction',
  'شقة مميزة في موقع متميز بالشيخ زايد، تشطيب سوبر لوكس بالكامل.':'Distinctive apartment in a prime Sheikh Zayed location, fully super-lux finished.',
  'فيلا مستقلة على مساحة كبيرة، حديقة خاصة وحمام سباحة.':'Standalone villa on a large plot with private garden and pool.',
  'شقة حديثة بحالة ممتازة، مطبخ مجهز بالكامل.':'Modern apartment in excellent condition with a fully equipped kitchen.',
  'بنتهاوس بالدور الأخير، تراس كبير بإطلالة مفتوحة.':'Top-floor penthouse with a large open-view terrace.',
  'محل تجاري على الشارع الرئيسي، واجهة زجاجية كبيرة.':'Shop on the main street with a large glass storefront.',
  'شقة بفيو بحري مباشر في مارينا، قيد الإنشاء والتسليم 2027.':'Apartment with direct sea view in Marina, under construction, delivery 2027.',
  'أريد شقة في كمبوند - تشطيب سوبر لوكس':'Looking for an apartment in a compound — super-lux finishing',
  'أبحث عن شقة حديثة - مطبخ مجهز':'Looking for a modern apartment — equipped kitchen',
  'فيلا مستقلة - حديقة - حمام سباحة':'Standalone villa — garden — swimming pool',
  'أريد الشراء':'Want to Buy','أريد الإيجار':'Want to Rent',
  'وسيط عقاري معتمد':'Certified real-estate broker','مكتب عقارات التجمع':'Fifth Settlement realty office','إعلانات فردية':'Individual listings',
  'عقارات تجارية':'Commercial real estate','وسيط عقاري':'Real-estate broker','مكتب عقارات':'Realty office','إعلان جديد':'New advertiser',
  'أحمد المصري':'Ahmed El-Masry','سارة عبد الله':'Sara Abdallah','محمد سامي':'Mohamed Samy','كريم فؤاد':'Karim Fouad','مستخدم ديارينو':'Diarino User',
  'مصطفى كامل':'Mostafa Kamel','هبة الزهراء':'Heba Al-Zahraa','عمر شريف':'Omar Sherif',
  'حديقة':'Garden','جراج':'Garage','أمن وحراسة':'Security','مطبخ مجهز':'Equipped Kitchen','مصعد':'Elevator','حمام سباحة':'Swimming Pool','تراس':'Terrace',
  'مفروش':'Furnished','مكيف':'Air Conditioned','خط أرضي':'Landline','عداد كهرباء':'Electricity Meter','عداد مياه':'Water Meter','عداد غاز طبيعي':'Gas Meter',
  'واجهة مميزة':'Prime storefront','تشطيب سوبر لوكس':'Super-lux finishing',
  'بدون تشطيب':'Unfinished','نصف تشطيب':'Semi-finished','لوكس':'Lux','سوبر لوكس':'Super Lux','الترا سوبر لوكس':'Ultra Super Lux','ديلوكس':'Deluxe',
  'صور / فيديو العقار':'Property Photos / Video','رقم التواصل (واتساب)':'Contact Number (WhatsApp)','نشر الإعلان':'Publish Ad','نشر الطلب':'Publish Request',
  '(اختياري)':'(optional)','موسيقى الإعلان':'Ad Music','المنطقة / الحي / الكمبوند':'Area / District / Compound','السعر (ج.م)':'Price (EGP)','المساحة (م²)':'Area (m²)',
  'اكتب رسالتك ...':'Type your message ...','متصل الآن':'Online now','لا توجد محادثات':'No chats yet','لا توجد إعلانات':'No ads yet','لا توجد طلبات':'No requests yet',
  'ابحث بالمنطقة، نوع العقار ...':'Search by area, property type ...','اختر المحافظة':'Select governorate','اختر نوع التشطيب':'Select finishing type',
  'بيع':'Sale','إيجار':'Rent','عروض':'offers','قدّم عرضك':'Make an Offer','تقديم عرض':'Make an Offer',
  'تم تغيير اللغة إلى العربية':'Language changed to Arabic','Language changed':'Language changed',

  // ↔ إضافات هذه الجولة: قايمة خيارات الريل (الضغط المطول)، عرض التطبيق
  // فوق التطبيقات الأخرى، والإشعارات/التشغيل فى الإعدادات.
  'التشغيل':'Playback','عرض التطبيق فوق التطبيقات الأخرى':'Display over other apps',
  'للسماح باستمرار تشغيل الريلز والفيديوهات في نافذة صغيرة عند مغادرة التطبيق، زي يوتيوب.':
    'To keep reels and videos playing in a small window when you leave the app, like YouTube.',
  'تفعيل':'Enable','ليس الآن':'Not now','مفعّل':'On',
  'الإبلاغ عن هذا الريل':'Report this reel','تمرير تلقائي':'Auto-advance','صوت الخلفية':'Background sound',
  'الترجمة النصية (Captions)':'Captions',
  'قيد التحسين':'Improving','قريباً — هنفعّلها فى تحديث جاي':'Coming soon — we\'ll enable it in an upcoming update',
  'الترجمة التلقائية قريباً — هتشتغل بس للريلز اللي معاها نص جاهز حاليًا':
    'Automatic captions coming soon — for now this only shows text already available for a reel',

  // ↔ #2 (سبب إبلاغ جديد): ترجمة كل قائمة أسباب الإبلاغ (ReportModal.tsx)
  // — مش بس السبب الجديد، عشان الاختبار الكامل ("بدّل اللغة → تظهر كل
  // الأسباب بالإنجليزية صح") ينجح فعليًا بدل ما يبقى السبب الجديد بس هو
  // المترجم ويفضل الباقي عربي وسط شاشة إنجليزية.
  'الإبلاغ عن هذا المحتوى':'Report this content',
  'محتوى مخالف':'Violating content','معلومات مضللة أو غير صحيحة':'Misleading or false information',
  'محاولة احتيال':'Scam attempt','محتوى غير لائق':'Inappropriate content',
  'انتهاك حقوق النشر والطبع':'Copyright violation','سبب آخر':'Other reason',
};
