"use client";

import { Tooltip } from "antd";

type CoverFieldLabelProps = {
  label: string;
  hint: string;
};

export default function CoverFieldLabel({ label, hint }: CoverFieldLabelProps) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-medium text-[#1F2A44]">{label}</span>
      <Tooltip title={hint}>
        <span
          className="inline-flex cursor-help text-[#5B6B8C] transition-colors hover:text-[#3F86F5]"
          aria-label="封面说明"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4.75a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5A.75.75 0 0 1 8 4.75ZM8 8.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 8.5Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </Tooltip>
    </div>
  );
}
