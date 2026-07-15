"use client";

import { App } from "antd";
import type { WorkKind } from "@/components/AuthorWorkEditor";

const KIND_LABEL: Record<WorkKind, string> = {
  story: "故事",
  character: "角色卡",
  world: "世界卡",
};

export function useWorkConfirm() {
  const { modal } = App.useApp();

  function confirmUnpublish(
    kind: WorkKind,
    name: string,
    onOk: () => void | Promise<void>,
  ) {
    modal.confirm({
      title: `下架${KIND_LABEL[kind]}`,
      content: `下架后「${name}」将不再在市场展示，确定要下架吗？`,
      okText: "下架",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk,
    });
  }

  function confirmDelete(
    kind: WorkKind,
    name: string,
    onOk: () => void | Promise<void>,
  ) {
    modal.confirm({
      title: `删除${KIND_LABEL[kind]}`,
      content: `确定永久删除「${name}」？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk,
    });
  }

  return { confirmUnpublish, confirmDelete };
}
