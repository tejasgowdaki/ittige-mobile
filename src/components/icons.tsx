import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = {
  size?: number;
  color?: string;
};

function Mark({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

const stroke = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Path d="M3 10.5 12 3l9 7.5" stroke={color} {...stroke} />
      <Path d="M5 10v10h14V10" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconProjects({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Path d="M4 21V8l8-5 8 5v13" stroke={color} {...stroke} />
      <Path d="M9 21v-6h6v6" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconProgress({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Path d="M4 19V5" stroke={color} {...stroke} />
      <Path d="M4 19h16" stroke={color} {...stroke} />
      <Path d="M8 16v-5" stroke={color} {...stroke} />
      <Path d="M12 16V8" stroke={color} {...stroke} />
      <Path d="M16 16v-3" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconStock({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Path d="M21 8H3l2-4h14l2 4Z" stroke={color} {...stroke} />
      <Path d="M3 8v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8" stroke={color} {...stroke} />
      <Path d="M10 12h4" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconRequests({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Path d="M8 6h11" stroke={color} {...stroke} />
      <Path d="M8 12h11" stroke={color} {...stroke} />
      <Path d="M8 18h11" stroke={color} {...stroke} />
      <Path d="M4 6h.01M4 12h.01M4 18h.01" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconUser({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Circle cx="12" cy="8" r="4" stroke={color} {...stroke} />
      <Path d="M4 20a8 8 0 0 1 16 0" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconTeam({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Circle cx="9" cy="8" r="3" stroke={color} {...stroke} />
      <Circle cx="17" cy="9" r="2.5" stroke={color} {...stroke} />
      <Path d="M3 19a6 6 0 0 1 12 0" stroke={color} {...stroke} />
      <Path d="M14.5 19a4.5 4.5 0 0 1 6.5-4" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconLogout({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} {...stroke} />
      <Path d="M16 17l5-5-5-5" stroke={color} {...stroke} />
      <Path d="M21 12H9" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconCheck({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M5 13l4 4L19 7" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconImage({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Rect x="3" y="5" width="18" height="14" rx="2" stroke={color} fill="none" {...stroke} />
      <Circle cx="9" cy="10" r="1.5" stroke={color} {...stroke} />
      <Path d="M21 15l-5-5-8 8" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconClose({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconChevronDown({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M6 9l6 6 6-6" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconPlus({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M12 5v14M5 12h14" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconPencil({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M12 20h9" stroke={color} {...stroke} />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconTrash({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M3 6h18" stroke={color} {...stroke} />
      <Path d="M8 6V4h8v2" stroke={color} {...stroke} />
      <Path d="M19 6l-1 14H6L5 6" stroke={color} {...stroke} />
      <Path d="M10 11v6M14 11v6" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconSave({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size}>
      <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" stroke={color} {...stroke} />
      <Path d="M17 21v-8H7v8" stroke={color} {...stroke} />
      <Path d="M7 3v5h8" stroke={color} {...stroke} />
    </Mark>
  );
}

export function IconActivity({ size, color = "#3a2218" }: IconProps) {
  return (
    <Mark size={size} color={color}>
      <Circle cx="12" cy="12" r="9" stroke={color} {...stroke} />
      <Path d="M12 7v5l3 2" stroke={color} {...stroke} />
    </Mark>
  );
}
