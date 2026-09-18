export type ChatMessage = {
  from: "me" | "them";
  text: string;
  time: string;
  images?: string[];
  whatsapp?: string; // ↔ the "📱 واتساب: ..." tag shown on offer messages
};

export type Chat = {
  id: string;
  partnerName: string;
  initial: string;
  propertyId: string | null; // null for offer-on-request chats (id starts with "req-")
  unread: number;
  messages: ChatMessage[];
};

// ↔ `let chats = [...]` in app-viewer.html
export const INITIAL_CHATS: Chat[] = [
  {
    id: "c1",
    partnerName: "أحمد المصري",
    initial: "أ",
    propertyId: "p1",
    unread: 1,
    messages: [
      { from: "them", text: "إزيك! اطمانت على الشقة", time: "10:02 ص" },
      { from: "me", text: "تمام، ممكن أعرف آخر سعر؟", time: "10:05 ص" },
    ],
  },
];
