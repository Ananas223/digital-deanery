import { cn } from "@/lib/utils";

type RouteMarkProps = {
  className?: string;
};

/** A folded route: two open stops and one active node, shared with the lesson timeline. */
export function RouteMark({ className }: RouteMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 40 40"
      fill="none"
      className={cn("block shrink-0", className)}
    >
      <path
        d="M8 26.5V16a6 6 0 0 1 6-6h9.25M28 14.75V25.5a4.5 4.5 0 0 1-4.5 4.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke="currentColor" strokeWidth="2.5">
        <circle cx="8" cy="30" r="3.5" />
        <circle cx="20" cy="30" r="3.5" />
      </g>
      <circle cx="28" cy="10" r="4.75" fill="currentColor" />
    </svg>
  );
}
