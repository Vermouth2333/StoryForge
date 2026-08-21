"use client";

import { useState } from "react";

export type ShowcaseItem = {
  title: string;
  desc: string;
  kicker?: string;
  tilt?: "left" | "right";
  sticker?: "paper" | "blue" | "soft" | "sky";
};

export function ShowcaseStage({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="sf-stage">
      <div className="sf-stage-sky" aria-hidden>
        <span className="sf-cloud sf-cloud-a" />
        <span className="sf-cloud sf-cloud-b" />
        <span className="sf-cloud sf-cloud-c" />
      </div>
      <div className="sf-stage-line" aria-hidden />
      <div className="sf-stage-row">
        {items.map((item, index) => {
          const isActive = active === index;
          return (
            <button
              key={item.title}
              type="button"
              className={`sf-portal${isActive ? " is-active" : ""}`}
              aria-pressed={isActive}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
            >
              <span
                className={`sf-sticker sf-sticker-${item.sticker ?? "paper"} sf-sticker-${item.tilt ?? (index % 2 === 0 ? "left" : "right")}`}
              >
                {item.kicker ? <small>{item.kicker}</small> : null}
                <strong>{item.title}</strong>
              </span>
              <span className="sf-portal-frame" style={{ animationDelay: `${index * 0.45}s` }}>
                {item.kicker ? <small className="sf-portal-kicker">{item.kicker}</small> : null}
                <strong className="sf-portal-title">{item.title}</strong>
                <em className="sf-portal-desc">{item.desc}</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
