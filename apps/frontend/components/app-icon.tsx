import type { SVGProps } from "react";

export type AppIconName =
  | "arrowRight"
  | "bell"
  | "circle"
  | "editSquare"
  | "flame"
  | "flower"
  | "insight"
  | "leaf"
  | "lightbulb"
  | "plant"
  | "sparkles";

type AppIconProps = SVGProps<SVGSVGElement> & {
  name: AppIconName;
  decorative?: boolean;
};

const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export function AppIcon({
  name,
  decorative = true,
  "aria-label": ariaLabel,
  role,
  ...props
}: AppIconProps) {
  const accessibilityProps = decorative
    ? { "aria-hidden": true, focusable: false }
    : { "aria-label": ariaLabel, role: role ?? "img" };

  switch (name) {
    case "bell":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M8 17h8" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
          <path d="M6.4 15.6h11.2c.3 0 .5-.3.3-.6l-1.2-2.2a4.5 4.5 0 0 1-.5-2V9.4a4.2 4.2 0 1 0-8.4 0v1.4c0 .7-.2 1.4-.5 2L6 15c-.2.3 0 .6.4.6Z" />
        </svg>
      );
    case "editSquare":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M4.8 4.8h8.4" />
          <path d="M4.8 4.8a1.8 1.8 0 0 0-1.8 1.8v12.6A1.8 1.8 0 0 0 4.8 21h12.6a1.8 1.8 0 0 0 1.8-1.8v-8.4" />
          <path d="m13.7 6.3 4 4" />
          <path d="m12.4 19.2 1.1-4.7 6-6a1.6 1.6 0 0 0-2.3-2.2l-6 6-4.8 1.1Z" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M6 12.3C6 7.6 9.7 4.1 15.8 4c.7 6.2-2.8 10-7.5 10S6 13.4 6 12.3Z" />
          <path d="M9.2 14.5c1.2-3.2 3.2-5.6 6-7.3" />
        </svg>
      );
    case "plant":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M9.2 6.3c0 2.2 1.3 3.9 3.2 5.1 1.8-1.1 3.1-2.9 3.1-5.1-1.7 0-2.8.7-3.1 2.1-.3-1.4-1.5-2.1-3.2-2.1Z" />
          <path d="M12.3 11.4v2.8" />
          <path d="M6.4 15.3h11.2" />
          <path d="m8 15.3.8 4.2h7l.8-4.2" />
        </svg>
      );
    case "flower":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <circle cx="12" cy="9.8" r="1.5" />
          <path d="M12 5.6a2.1 2.1 0 1 0 0 4.2" />
          <path d="M7.9 7.5a2.1 2.1 0 1 0 2.9 2.9" />
          <path d="M16.1 7.5a2.1 2.1 0 1 1-2.9 2.9" />
          <path d="M9.3 12.7a2.1 2.1 0 1 0 2.7-1.1" />
          <path d="M14.7 12.7a2.1 2.1 0 1 1-2.7-1.1" />
          <path d="M12 11.3v7.1" />
          <path d="M12 18.4c-1.2-1.4-2.5-2.1-4-2.1 0 1.7 1 3 2.8 3.8" />
          <path d="M12 18.4c1.2-1.4 2.5-2.1 4-2.1 0 1.7-1 3-2.8 3.8" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="m8 4 .7 2.1L11 7l-2.3.9L8 10l-.7-2.1L5 7l2.3-.9L8 4Z" />
          <path d="m16.5 8 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
          <path d="m7 14 1.2 3.7L12 19l-3.8 1.3L7 24l-1.2-3.7L2 19l3.8-1.3L7 14Z" transform="scale(.75) translate(4 3)" />
        </svg>
      );
    case "flame":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M12 3.8c.3 2.6-1.6 3.8-2.7 5.1A5.2 5.2 0 0 0 8 12.3c0 2.8 1.9 4.9 4.3 4.9s4.2-2.2 4.2-4.8c0-2.2-1.3-3.5-2.9-5.2-.6 1.5-1.5 2.1-2.2 2.5.3-1.5.1-3.6.6-6Z" />
          <path d="M12 12.2c-1 1-1.6 1.9-1.6 3 0 1.1.8 2 1.8 2s1.8-.9 1.8-2c0-.9-.4-1.7-1.3-2.6-.2.7-.4 1-.7 1.3Z" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M9.5 17.4h5" />
          <path d="M10.2 20h3.6" />
          <path d="M12 4.2a5.3 5.3 0 0 0-3.6 9.2c.7.7 1.1 1.4 1.3 2.2h4.6c.2-.8.6-1.5 1.3-2.2A5.3 5.3 0 0 0 12 4.2Z" />
          <path d="M10.7 11.6h2.6" />
        </svg>
      );
    case "insight":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M9.3 20.2H13" />
          <path d="M13 20.2c0-1.3.8-2.4 2.2-3.4A6.5 6.5 0 1 0 4.7 11.7c0 2 1 3.9 2.8 5.1 1.2.8 1.8 1.9 1.8 3.4Z" />
          <circle cx="14.8" cy="10.1" r="1.1" />
          <path d="M14.8 7.3v.8" />
          <path d="m17 8.3-.6.6" />
          <path d="M17.7 10.1h-.8" />
          <path d="m17 11.9-.6-.6" />
          <path d="M14.8 12.9v-.8" />
          <path d="m13.2 11.9.6-.6" />
          <path d="M12.3 10.1h.8" />
          <path d="m13.2 8.3.6.6" />
        </svg>
      );
    case "arrowRight":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <path d="M4 12h15" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "circle":
      return (
        <svg {...commonProps} {...accessibilityProps} {...props}>
          <circle cx="12" cy="12" r="5.6" />
        </svg>
      );
  }
}
