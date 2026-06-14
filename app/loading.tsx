export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DCE9FF] border-t-[#5B9DFF]" />
        <p className="text-sm text-[#5B6B8C]">加载中...</p>
      </div>
    </div>
  );
}
