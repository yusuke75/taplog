// ============================================================
// Event type catalogue (要件 §4, §5).
// Each "都度タップ" event has a category used for time aggregation
// in §6 (段取り計 / 検査計 / その他).
// ============================================================

export const EVENT_CATEGORY = {
  SETUP: "setup", // 段取り計に集計
  INSPECT: "inspect", // 検査計に集計
  OTHER: "other", // その他（トラブル・休憩・片付け 等）
};

/**
 * Master list of tap events. `icon` is a Material Symbols ligature.
 * `order` controls display order on the record screen.
 */
export const EVENT_TYPES = [
  { id: "uchi_dandori", label: "内段取り", icon: "build", category: EVENT_CATEGORY.SETUP },
  { id: "zairyo_toshi", label: "材料通し", icon: "swipe_right", category: EVENT_CATEGORY.SETUP },
  { id: "op_kensa_first", label: "OP検査(初)", icon: "fact_check", category: EVENT_CATEGORY.INSPECT },
  { id: "kakunin_chosei", label: "確認・調整", icon: "tune", category: EVENT_CATEGORY.SETUP },
  { id: "qa_kensa", label: "QA検査", icon: "verified", category: EVENT_CATEGORY.INSPECT },
  { id: "zairyo_kae", label: "材料替え", icon: "sync_alt", category: EVENT_CATEGORY.SETUP },
  { id: "seisanchu_qa", label: "生産中QA", icon: "monitoring", category: EVENT_CATEGORY.INSPECT },
  { id: "op_kensa", label: "OP検査", icon: "checklist", category: EVENT_CATEGORY.INSPECT },
  { id: "trouble", label: "トラブル", icon: "warning", category: EVENT_CATEGORY.OTHER },
  { id: "uchiowari_kensa", label: "打ち終わり検査", icon: "task_alt", category: EVENT_CATEGORY.INSPECT },
  { id: "katazuke", label: "片付け", icon: "cleaning_services", category: EVENT_CATEGORY.OTHER },
  { id: "kyukei", label: "休憩", icon: "coffee", category: EVENT_CATEGORY.OTHER },
];

const BY_ID = new Map(EVENT_TYPES.map((e) => [e.id, e]));

export function eventType(id) {
  return BY_ID.get(id) || null;
}

export function eventLabel(id) {
  const t = BY_ID.get(id);
  return t ? t.label : id;
}
