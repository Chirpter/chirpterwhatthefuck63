"use client"

import { useToast } from "@/hooks/useToast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import React from "react"

export function Toaster() {
  const { toasts } = useToast()

  React.useEffect(() => {
    // This is a failsafe to ensure pointer events are re-enabled
    // even if the toast component's lifecycle is interrupted.
    const timer = setInterval(() => {
      if (document.body.style.pointerEvents === 'none') {
        const isToastOpen = toasts.some(t => t.open);
        if (!isToastOpen) {
           document.body.style.pointerEvents = 'auto';
        }
      }
    }, 1000); // Check every second
    
    return () => clearInterval(timer);
  }, [toasts]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
