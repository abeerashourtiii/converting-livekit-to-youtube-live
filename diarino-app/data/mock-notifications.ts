export type NotifCategory = "like" | "save" | "follow" | "chat" | "alert";

export type NotifAction =
  | { type: "reel"; sellerId: string; propertyId: string }
  | { type: "seller"; id: string }
  | { type: "chat"; id: string }
  | { type: "property"; id: string };

export type NotifItem = {
  id?: string; // real notifications carry their DB id; mock entries below don't need one
  name: string;
  initial: string;
  text: string;
  time: string;
  action?: NotifAction;
  read: boolean;
};

// ↔ NOTIF_DATA in app-viewer.html (all start unread, same as the
// `if (typeof n.read !== 'boolean') n.read = false` init there).
export const NOTIF_DATA: Record<NotifCategory, NotifItem[]> = {
  like: [
    { name: "أحمد م.", initial: "أ", text: "أعجب بإعلانك: شقة بالتجمع الخامس", time: "قبل 5 د", action: { type: "reel", sellerId: "s1", propertyId: "p2" }, read: false },
    { name: "سارة ع.", initial: "س", text: "أعجبت بالريل الخاص بك", time: "قبل ساعة", action: { type: "reel", sellerId: "s1", propertyId: "p1" }, read: false },
    { name: "محمد ف.", initial: "م", text: "أعجب بإعلانك: فيلا بالشيخ زايد", time: "قبل 3 س", action: { type: "reel", sellerId: "s1", propertyId: "p1" }, read: false },
  ],
  save: [
    { name: "ياسمين ك.", initial: "ي", text: "حفظت إعلانك في المفضلة", time: "قبل 10 د", action: { type: "reel", sellerId: "s1", propertyId: "p3" }, read: false },
    { name: "خالد ر.", initial: "خ", text: "حفظت عقارك: بنتهاوس بالمعادي", time: "قبل 2 س", action: { type: "reel", sellerId: "s1", propertyId: "p4" }, read: false },
  ],
  follow: [
    { name: "مروة ط.", initial: "م", text: "بدأت متابعتك", time: "قبل 20 د", action: { type: "seller", id: "s2" }, read: false },
    { name: "عمر ص.", initial: "ع", text: "بدأ متابعتك", time: "أمس", action: { type: "seller", id: "s3" }, read: false },
  ],
  chat: [
    { name: "أحمد م.", initial: "أ", text: "مرحبا، هل العقار مازال متاحًا؟", time: "قبل 2 د", action: { type: "chat", id: "c1" }, read: false },
    { name: "نورا ح.", initial: "ن", text: "أرسلت لك صورة", time: "قبل 30 د", action: { type: "chat", id: "c1" }, read: false },
  ],
  alert: [
    { name: "ديارينو", initial: "د", text: "عقار جديد يطابق تنبيهك", time: "قبل ساعة", action: { type: "property", id: "p1" }, read: false },
  ],
};
