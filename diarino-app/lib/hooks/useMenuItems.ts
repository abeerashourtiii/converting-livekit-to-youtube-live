import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ imageSize/imageFit/textLayout only take effect when imageUrl is set
// (a custom uploaded photo) or icon_key happens to map to one of the
// bundled illustrations in lib/menuIconRegistry.tsx — a plain vector
// icon (no image at all) always renders the same small way regardless
// of these fields. See 20260908000000_menu_item_custom_images.sql for
// the full explanation of each value.
export type MenuImageSize = "small" | "medium" | "large" | "full";
export type MenuImageFit = "contain" | "cover";
export type MenuTextLayout = "below" | "above" | "overlay" | "hidden" | "beside";
export type MenuImageSide = "left" | "right";
export type MenuTextVAlign = "top" | "middle" | "bottom";
export type MenuTextHAlign = "right" | "center" | "left";

export type MenuItem = {
  id: string;
  title: string;
  subtitle: string | null;
  color: string;
  iconKey: string;
  // 'tall' pairs with the next two 'half' items (search-style hero card);
  // 'round' pairs with the following 'half' item as a small square button.
  size: "full" | "half" | "tall" | "round";
  actionType: "whatsapp" | "route" | "url";
  actionValue: string;
  sortOrder: number;
  active: boolean;
  ctaLabel: string | null;
  imageUrl: string | null;
  imageSize: MenuImageSize;
  imageFit: MenuImageFit;
  textLayout: MenuTextLayout;
  imageSide: MenuImageSide;
  fontSize: number | null;
  fontBold: boolean;
  fontColor: string | null;
  textVAlign: MenuTextVAlign;
  textHAlign: MenuTextHAlign;
};

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  color: string;
  icon_key: string;
  size: "full" | "half" | "tall" | "round";
  action_type: "whatsapp" | "route" | "url";
  action_value: string;
  sort_order: number;
  active: boolean;
  cta_label: string | null;
  image_url: string | null;
  image_size: MenuImageSize;
  image_fit: MenuImageFit;
  text_layout: MenuTextLayout;
  image_side: MenuImageSide;
  font_size: number | null;
  font_bold: boolean;
  font_color: string | null;
  text_valign: MenuTextVAlign;
  text_halign: MenuTextHAlign;
};

type MenuItemInsert = {
  title: string;
  subtitle: string | null;
  color: string;
  icon_key: string;
  size: "full" | "half" | "tall" | "round";
  action_type: "whatsapp" | "route" | "url";
  action_value: string;
  sort_order: number;
  cta_label: string | null;
  image_url: string | null;
  image_size: MenuImageSize;
  image_fit: MenuImageFit;
  text_layout: MenuTextLayout;
  image_side: MenuImageSide;
  font_size: number | null;
  font_bold: boolean;
  font_color: string | null;
  text_valign: MenuTextVAlign;
  text_halign: MenuTextHAlign;
};

type MenuItemUpdate = Partial<MenuItemInsert> & {
  active?: boolean;
};

function rowToItem(r: Row): MenuItem {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    color: r.color,
    iconKey: r.icon_key,
    size: r.size,
    actionType: r.action_type,
    actionValue: r.action_value,
    sortOrder: r.sort_order,
    active: r.active,
    ctaLabel: r.cta_label ?? null,
    imageUrl: r.image_url ?? null,
    imageSize: r.image_size ?? "medium",
    imageFit: r.image_fit ?? "contain",
    textLayout: r.text_layout ?? "below",
    imageSide: r.image_side ?? "right",
    fontSize: r.font_size ?? null,
    fontBold: r.font_bold ?? true,
    fontColor: r.font_color ?? null,
    textVAlign: r.text_valign ?? "middle",
    textHAlign: r.text_halign ?? "center",
  };
}

// ↔ the menu page's card list — was hardcoded JSX before, now driven
// entirely by public.menu_items.
export function useActiveMenuItems() {
  const { user, loading } = useCurrentUser();

  return useQuery({
    queryKey: ["menuItems", "active", user?.id ?? "anonymous"],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, title, subtitle, color, icon_key, size, action_type, action_value, sort_order, active, cta_label, image_url, image_size, image_fit, text_layout, image_side, font_size, font_bold, font_color, text_valign, text_halign, created_at")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[]).map(rowToItem);
    },
    enabled: !loading && !!user,
    staleTime: 30_000,
  });
}

// ↔ the admin "أيقونات القائمة" tab — every item, active or not.
export function useAllMenuItems() {
  return useQuery({
    queryKey: ["menuItems", "all"],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, title, subtitle, color, icon_key, size, action_type, action_value, sort_order, active, cta_label, image_url, image_size, image_fit, text_layout, image_side, font_size, font_bold, font_color, text_valign, text_halign, created_at")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[]).map(rowToItem);
    },
    staleTime: 10_000,
  });
}

export function useMenuItemMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["menuItems"] });

  const create = useMutation({
    mutationFn: async (input: Omit<MenuItem, "id" | "active"> & { sortOrder?: number }): Promise<string> => {
      const payload: MenuItemInsert = {
        title: input.title,
        subtitle: input.subtitle,
        color: input.color,
        icon_key: input.iconKey,
        size: input.size,
        action_type: input.actionType,
        action_value: input.actionValue,
        sort_order: input.sortOrder ?? 0,
        cta_label: input.ctaLabel ?? null,
        image_url: input.imageUrl ?? null,
        image_size: input.imageSize ?? "medium",
        image_fit: input.imageFit ?? "contain",
        text_layout: input.textLayout ?? "below",
        image_side: input.imageSide ?? "right",
        font_size: input.fontSize ?? null,
        font_bold: input.fontBold ?? false,
        font_color: input.fontColor ?? null,
        text_valign: input.textVAlign ?? "middle",
        text_halign: input.textHAlign ?? "center",
      };

      const { data, error } = await supabase.from("menu_items").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<MenuItem, "id">> }) => {
      const row: MenuItemUpdate = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.subtitle !== undefined) row.subtitle = patch.subtitle;
      if (patch.color !== undefined) row.color = patch.color;
      if (patch.iconKey !== undefined) row.icon_key = patch.iconKey;
      if (patch.size !== undefined) row.size = patch.size;
      if (patch.actionType !== undefined) row.action_type = patch.actionType;
      if (patch.actionValue !== undefined) row.action_value = patch.actionValue;
      if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
      if (patch.active !== undefined) row.active = patch.active;
      if (patch.ctaLabel !== undefined) row.cta_label = patch.ctaLabel;
      // imageUrl can be explicitly set to null (admin removed the custom
      // image to fall back to icon_key again), so this checks
      // "key present in patch" rather than "value is truthy".
      if ("imageUrl" in patch) row.image_url = patch.imageUrl ?? null;
      if (patch.imageSize !== undefined) row.image_size = patch.imageSize;
      if (patch.imageFit !== undefined) row.image_fit = patch.imageFit;
      if (patch.textLayout !== undefined) row.text_layout = patch.textLayout;
      if (patch.imageSide !== undefined) row.image_side = patch.imageSide;
      // fontSize/fontColor can be explicitly reset to null (admin chose
      // "استخدم الافتراضي" again), so — same as imageUrl above — this
      // checks "key present in patch" rather than "value is truthy".
      if ("fontSize" in patch) row.font_size = patch.fontSize ?? null;
      if (patch.fontBold !== undefined) row.font_bold = patch.fontBold;
      if ("fontColor" in patch) row.font_color = patch.fontColor ?? null;
      if (patch.textVAlign !== undefined) row.text_valign = patch.textVAlign;
      if (patch.textHAlign !== undefined) row.text_halign = patch.textHAlign;

      const { error } = await supabase.from("menu_items").update(row).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ↔ "إعادة ترتيب الأيقونات" — swaps two items' sort_order.
  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: { id: string; sortOrder: number }; b: { id: string; sortOrder: number } }) => {
      const { error: e1 } = await supabase.from("menu_items").update({ sort_order: b.sortOrder }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("menu_items").update({ sort_order: a.sortOrder }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: invalidate,
  });

  // ↔ طلب "تحديد مكان الأيقونة (الجديدة أو الموجودة) بدل بس تحريكها
  // خطوة واحدة لفوق/تحت فى كل مرة" — بياخد قايمة العناصر بترتيبها
  // الحالي، يشيل العنصر المطلوب من مكانه، يحطه فى الموضع الجديد
  // (1-indexed زي ما ظاهر للأدمن)، وبعدين يعيد ترقيم sort_order لكل
  // العناصر بالتتابع (0,1,2...) فى استعلامات تحديث منفصلة. عدد عناصر
  // القائمة محدود جدًا (لوحة أدمن، مش قايمة ضخمة)، فتحديث كل الصفوف فى
  // كل نقلة تكلفته مهملة، وده أبسط وأضمن بكتير من محاولة حساب فجوات فى
  // sort_order يدويًا.
  const moveToPosition = useMutation({
    mutationFn: async ({ id, items, position }: { id: string; items: MenuItem[]; position: number }) => {
      const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
      const currentIndex = ordered.findIndex((i) => i.id === id);
      if (currentIndex === -1) return;
      const [moved] = ordered.splice(currentIndex, 1);
      const targetIndex = Math.max(0, Math.min(ordered.length, position - 1));
      ordered.splice(targetIndex, 0, moved);

      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i].sortOrder === i) continue; // بالفعل فى مكانه الصح، مفيش داعي لتحديث زيادة
        const { error } = await supabase.from("menu_items").update({ sort_order: i }).eq("id", ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder, moveToPosition };
}