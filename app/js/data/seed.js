// ============================================================
// Seed master data + a couple of demo jobs so the app is
// explorable on first launch. Matches the figures shown in the
// original mockups where practical.
// ============================================================

import { uid, now } from "../lib/id.js";

export function buildSeed() {
  const t = now();
  const minutesAgo = (m) => t - m * 60_000;

  const machines = [
    { id: "m1", name: "設備1", groupId: "A", groupName: "プレスA班", active: true },
    { id: "m2", name: "設備2", groupId: "A", groupName: "プレスA班", active: true },
    { id: "m3", name: "設備3", groupId: "A", groupName: "プレスA班", active: true },
    { id: "m4", name: "設備4", groupId: "B", groupName: "プレスB班", active: true },
    { id: "m5", name: "設備5", groupId: "B", groupName: "プレスB班", active: true },
    { id: "m6", name: "設備6", groupId: "B", groupName: "プレスB班", active: true },
    { id: "m7", name: "設備7", groupId: "C", groupName: "プレスC班", active: true },
    { id: "m8", name: "設備8", groupId: "C", groupName: "プレスC班", active: true },
    { id: "m9", name: "設備9", groupId: "C", groupName: "プレスC班", active: false },
  ];

  // 品番マスタ：標準SPM・標準段取り時間（分）を保持（要件 §4）
  const products = [
    { id: "p1", code: "A-2203", name: "ブラケットA", standardSpm: 120, standardSetupMin: 15, active: true },
    { id: "p2", code: "B-5510", name: "ステーB", standardSpm: 90, standardSetupMin: 20, active: true },
    { id: "p3", code: "C-1180", name: "カラーC", standardSpm: 150, standardSetupMin: 12, active: true },
    { id: "p4", code: "D-7702", name: "プレートD", standardSpm: 80, standardSetupMin: 25, active: true },
    { id: "p5", code: "E-3344", name: "クリップE", standardSpm: 200, standardSetupMin: 10, active: true },
  ];

  // ユーザーマスタ：ロールは sysadmin / admin / worker（要件 §2）
  const users = [
    { id: "u1", employeeNo: "1001", name: "山田 太郎", groupId: "A", groupName: "プレスA班", role: "worker", active: true },
    { id: "u2", employeeNo: "1002", name: "佐藤 花子", groupId: "B", groupName: "プレスB班", role: "worker", active: true },
    { id: "u3", employeeNo: "1003", name: "鈴木 一郎", groupId: "B", groupName: "プレスB班", role: "worker", active: true },
    { id: "u4", employeeNo: "9001", name: "高橋 管理", groupId: "", groupName: "", role: "admin", active: true },
    { id: "u5", employeeNo: "9000", name: "システム管理者", groupId: "", groupName: "", role: "sysadmin", active: true },
  ];

  // 不良モードマスタ：初期値 巻き/寸法/外観/その他（要件 §4）
  const defectModes = [
    { id: "d1", name: "巻き不良", order: 1, active: true },
    { id: "d2", name: "寸法不良", order: 2, active: true },
    { id: "d3", name: "外観不良", order: 3, active: true },
    { id: "d4", name: "その他", order: 4, active: true },
    { id: "d5", name: "バリ不良", order: 5, active: false },
  ];

  // --- Demo jobs (ジョブ＝紙1枚) ---
  const jobs = [
    {
      id: uid("job"),
      machineId: "m1",
      productId: "p1",
      lot: "LOT-0621-01",
      spm: 120,
      status: "active",
      operatorId: "u1",
      startedAt: minutesAgo(222),
      endedAt: null,
      events: [
        evt("uchi_dandori", "u1", minutesAgo(222), minutesAgo(210)),
        evt("zairyo_toshi", "u1", minutesAgo(210), minutesAgo(204)),
        evt("op_kensa_first", "u1", minutesAgo(204), minutesAgo(200)),
        evt("seisanchu_qa", "u1", minutesAgo(120), minutesAgo(115)),
      ],
      result: emptyResult(),
      comment: "",
    },
    {
      id: uid("job"),
      machineId: "m2",
      productId: "p2",
      lot: "LOT-0621-02",
      spm: 90,
      status: "active",
      operatorId: "u1",
      startedAt: minutesAgo(12),
      endedAt: null,
      events: [evt("uchi_dandori", "u1", minutesAgo(12), null)],
      result: emptyResult(),
      comment: "",
    },
    {
      id: uid("job"),
      machineId: "m4",
      productId: "p4",
      lot: "LOT-0620-09",
      spm: 80,
      status: "done",
      operatorId: "u2",
      startedAt: minutesAgo(600),
      endedAt: minutesAgo(360),
      events: [
        evt("uchi_dandori", "u2", minutesAgo(600), minutesAgo(578)),
        evt("qa_kensa", "u2", minutesAgo(578), minutesAgo(570)),
        evt("uchiowari_kensa", "u2", minutesAgo(366), minutesAgo(360)),
      ],
      result: {
        productionCount: 3120,
        lotCount: 3200,
        totalShots: 3180,
        loss: 18,
        defects: { d1: 1, d2: 4, d3: 2, d4: 0 },
        comment: "材料ロット切替あり",
      },
      comment: "材料ロット切替あり",
    },
  ];

  return {
    version: 1,
    machines,
    products,
    users,
    defectModes,
    jobs,
    session: { operatorId: null },
  };

  function evt(type, operatorId, startedAt, endedAt) {
    return { id: uid("evt"), type, operatorId, startedAt, endedAt };
  }
}

export function emptyResult() {
  return {
    productionCount: null,
    lotCount: null,
    totalShots: null,
    loss: null,
    defects: {},
    comment: "",
  };
}
