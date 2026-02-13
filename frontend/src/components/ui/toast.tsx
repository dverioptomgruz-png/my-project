"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all toast-slide-in-right data-[swipe=cancel]:translate-x-0 data-[swipe=end]:toast-swipe-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=closed]:toast-slide-out-right",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
        error:
          "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm font-medium ring-offset-[hsl(var(--background))] transition-colors",
      "hover:bg-[hsl(var(--secondary))]",
      "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.error]:border-red-300 group-[.error]:hover:border-red-400 group-[.error]:hover:bg-red-100 group-[.error]:hover:text-red-600 group-[.error]:focus:ring-red-400",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitive.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity",
      "text-[hsl(var(--foreground))]/50 hover:text-[hsl(var(--foreground))]",
      "group-hover:opacity-100",
      "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

// ============================================================
// Toast hook and Toaster
// ============================================================

type ToastVariant = "default" | "success" | "error" | "warning";

interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: React.ReactNode;
}

type ToastActionType =
  | { type: "ADD"; toast: ToastData }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

const TOAST_LIMIT = 5;
const TOAST_DISMISS_DELAY = 5000;

let toastCount = 0;

function generateId(): string {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return toastCount.toString();
}

const toastListeners: Array<(state: ToastData[]) => void> = [];
let toastMemory: ToastData[] = [];

function dispatch(action: ToastActionType) {
  switch (action.type) {
    case "ADD":
      toastMemory = [action.toast, ...toastMemory].slice(0, TOAST_LIMIT);
      break;
    case "DISMISS":
      toastMemory = toastMemory.filter((t) => t.id !== action.id);
      break;
    case "REMOVE":
      toastMemory = toastMemory.filter((t) => t.id !== action.id);
      break;
  }

  toastListeners.forEach((listener) => listener(toastMemory));
}

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: React.ReactNode;
}

function toast(options: ToastOptions) {
  const id = generateId();

  dispatch({
    type: "ADD",
    toast: {
      id,
      ...options,
    },
  });

  // Auto dismiss
  const dismissDuration = options.duration ?? TOAST_DISMISS_DELAY;
  setTimeout(() => {
    dispatch({ type: "DISMISS", id });
  }, dismissDuration);

  return id;
}

toast.success = (options: Omit<ToastOptions, "variant">) =>
  toast({ ...options, variant: "success" });

toast.error = (options: Omit<ToastOptions, "variant">) =>
  toast({ ...options, variant: "error" });

toast.warning = (options: Omit<ToastOptions, "variant">) =>
  toast({ ...options, variant: "warning" });

function useToast() {
  const [toasts, setToasts] = React.useState<ToastData[]>(toastMemory);

  React.useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS", id }),
  };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} duration={t.duration}>
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && (
              <ToastDescription>{t.description}</ToastDescription>
            )}
          </div>
          {t.action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export {
  type ToastData,
  type ToastVariant,
  type ToastOptions,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  Toaster,
  useToast,
  toast,
};
