import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton (e.g. "100px", "50%"). Defaults to "100%". */
  width?: string;
  /** Height of the skeleton (e.g. "20px", "2rem"). Defaults to "1rem". */
  height?: string;
  /** Whether to render as a circle (sets border-radius to 50%). */
  circle?: boolean;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, circle = false, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "skeleton-shimmer rounded-md",
          circle && "rounded-full",
          className
        )}
        style={{
          width: width ?? "100%",
          height: height ?? "1rem",
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
