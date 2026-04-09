export default function ModerationPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-[#1F2A44]">内容审核列表（MVP）</h1>
      <p className="mt-2 text-sm text-[#5B6B8C]">
        当前为基础管理页骨架：支持后续接入通过、下架、驳回动作。
      </p>
      <div className="mt-6 rounded-xl border border-[#DCE9FF] bg-white p-4 text-sm text-[#5B6B8C]">
        暂无审核数据。可在后端接入触发原因、提交用户、创建时间、状态等字段。
      </div>
    </main>
  );
}
