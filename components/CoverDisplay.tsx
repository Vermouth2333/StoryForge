type CoverDisplayProps = {
  src?: string | null;
  alt?: string;
  /** 限制封面展示区域宽度，默认随父容器 100% */
  maxWidthClass?: string;
  placeholder?: React.ReactNode;
};

export default function CoverDisplay({
  src,
  alt = "封面",
  maxWidthClass = "work-cover-frame",
  placeholder,
}: CoverDisplayProps) {
  return (
    <div className={maxWidthClass}>
      <div
        className={`market-card-cover overflow-hidden rounded-xl${src ? " market-card-cover--with-image" : ""}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} />
        ) : (
          placeholder ?? (
            <div className="market-card-placeholder">
              <span className="text-sm text-[#5B6B8C]">暂无封面</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
