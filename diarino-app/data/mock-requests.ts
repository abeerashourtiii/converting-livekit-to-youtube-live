export type PropertyRequest = {
  id: string;
  purpose: "sale" | "rent";
  type: string;
  province: string;
  location: string;
  priceMax: number;
  area: string;
  rooms: string;
  baths: string;
  description: string;
  requesterName: string;
  requesterId: string;
  offers: number;
  createdAt: number;
};

export const REQUESTS: PropertyRequest[] = [
  { id: "r1", purpose: "sale", type: "شقة", province: "الجيزة", location: "الشيخ زايد", priceMax: 4000000, area: "150", rooms: "3", baths: "2", description: "أريد شقة في كمبوند - تشطيب سوبر لوكس", requesterName: "مصطفى كامل", requesterId: "other1", offers: 2, createdAt: Date.now() - 1000 * 60 * 60 * 5 },
  { id: "r2", purpose: "rent", type: "شقة", province: "الجيزة", location: "6 أكتوبر", priceMax: 18000, area: "120", rooms: "2", baths: "2", description: "أبحث عن شقة حديثة - مطبخ مجهز", requesterName: "هبة الزهراء", requesterId: "other2", offers: 5, createdAt: Date.now() - 1000 * 60 * 60 * 20 },
  { id: "r3", purpose: "sale", type: "فيلا", province: "القاهرة", location: "التجمع الخامس", priceMax: 8500000, area: "350", rooms: "4", baths: "4", description: "فيلا مستقلة - حديقة - حمام سباحة", requesterName: "عمر شريف", requesterId: "other3", offers: 1, createdAt: Date.now() - 1000 * 60 * 60 * 40 },
];
