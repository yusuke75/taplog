// 品番×設備 対応マスタ — which products can run on which equipment.
// Many-to-many editor: add (product + machine) pairs, delete pairs.

import { el, icon } from "../lib/dom.js";
import { products, machines, productMachines } from "../data/store.js";
import { openModal, confirmModal, toast, field } from "../lib/ui.js";
import { adminShell, breadcrumb } from "./shell.js";

export function renderProductMachines() {
  const main = adminShell("/admin/product-machines");

  main.append(
    breadcrumb([{ label: "マスタ管理", href: "#/admin" }, { label: "品番×設備 対応" }]),
    el("div", { class: "section-head", style: { marginTop: "8px" } }, [
      el("h2", {}, "品番×設備 対応マスタ"),
      el("button", { class: "btn btn-primary", onclick: openAdd }, [icon("add"), "対応を追加"]),
    ]),
    table(),
    el(
      "div",
      { class: "muted", style: { fontSize: "0.85rem", marginTop: "12px" } },
      "設備ごとに、生産できる品番を登録します。作業者の新規ジョブでは、選択した設備で生産できる品番のみが表示されます（未登録の設備は全品番を表示）。"
    )
  );
}

function machineName(id) {
  const m = machines.get(id);
  return m ? m.name : "（削除済み）";
}
function productName(id) {
  const p = products.get(id);
  return p ? p.name : "（削除済み）";
}

function table() {
  const rows = [...productMachines.list()].sort((a, b) => {
    const m = machineName(a.machineId).localeCompare(machineName(b.machineId), "ja");
    return m !== 0 ? m : productName(a.productId).localeCompare(productName(b.productId), "ja");
  });

  const head = el("tr", {}, [
    el("th", {}, "設備"),
    el("th", {}, "品番（品名）"),
    el("th", { class: "cell-right" }, "操作"),
  ]);

  const body = rows.map((pm) =>
    el("tr", {}, [
      el("td", {}, machineName(pm.machineId)),
      el("td", {}, productName(pm.productId)),
      el(
        "td",
        { class: "cell-right" },
        el("div", { class: "row-actions" }, [
          el("button", { class: "icon-btn danger", title: "削除", onclick: () => askDelete(pm) }, icon("delete")),
        ])
      ),
    ])
  );

  return el("div", { class: "table-wrap" }, [
    el("table", { class: "data" }, [
      el("thead", {}, head),
      el(
        "tbody",
        {},
        body.length
          ? body
          : [el("tr", {}, el("td", { colspan: 3, class: "muted", style: { textAlign: "center", padding: "32px" } }, "対応が登録されていません"))]
      ),
    ]),
  ]);
}

function openAdd() {
  const machineSelect = el(
    "select",
    {},
    [el("option", { value: "" }, "選択してください"), ...machines.active().map((m) => el("option", { value: m.id }, m.name))]
  );
  const productSelect = el(
    "select",
    {},
    [el("option", { value: "" }, "選択してください"), ...products.active().map((p) => el("option", { value: p.id }, p.name))]
  );

  openModal({
    title: "品番×設備 対応を追加",
    body: [field("設備", machineSelect), field("品番", productSelect)],
    actions: [
      { label: "キャンセル", kind: "btn-ghost", onClick: (c) => c() },
      {
        label: "追加",
        kind: "btn-primary",
        onClick: (close) => {
          const machineId = machineSelect.value;
          const productId = productSelect.value;
          if (!machineId) return toast("設備を選択してください", "danger");
          if (!productId) return toast("品番を選択してください", "danger");
          if (productMachines.exists(productId, machineId)) {
            toast("すでに登録されています", "danger");
            return;
          }
          productMachines.add({ productId, machineId });
          toast("対応を追加しました", "success");
          close();
          rerender();
        },
      },
    ],
  });
}

function askDelete(pm) {
  confirmModal({
    title: "対応を削除",
    message: `「${machineName(pm.machineId)} ・ ${productName(pm.productId)}」の対応を削除します。よろしいですか？`,
    onConfirm: () => {
      productMachines.remove(pm.id);
      toast("削除しました", "success");
      rerender();
    },
  });
}

function rerender() {
  window.dispatchEvent(new CustomEvent("taplog:rerender"));
}
