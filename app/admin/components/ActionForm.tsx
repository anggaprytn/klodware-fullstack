"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";

export type AdminAction = (formData: FormData) => Promise<void>;

type ActionState = {
  message: string;
  status: "idle" | "success" | "error";
  nonce: number;
};

const initialState: ActionState = {
  message: "",
  nonce: 0,
  status: "idle",
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  encType,
  errorMessage: fallbackError = "Action failed.",
  onSuccess,
  successMessage,
}: {
  action: AdminAction;
  children: (pending: boolean) => ReactNode;
  className?: string;
  confirmMessage?: string;
  encType?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  successMessage: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction, pending] = useActionState(
    async (_previousState: ActionState, formData: FormData) => {
      try {
        await action(formData);
        return {
          message: successMessage,
          nonce: Date.now(),
          status: "success" as const,
        };
      } catch (error) {
        return {
          message: errorMessage(error, fallbackError),
          nonce: Date.now(),
          status: "error" as const,
        };
      }
    },
    initialState,
  );

  useEffect(() => {
    if (state.status === "idle") return;
    showToast({
      message: state.message,
      tone: state.status === "success" ? "success" : "error",
    });
    if (state.status === "success") {
      router.refresh();
      onSuccess?.();
    }
  }, [onSuccess, router, showToast, state]);

  return (
    <form
      action={formAction}
      className={className}
      encType={encType}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children(pending)}
      {state.status === "error" ? <p className="error">{state.message}</p> : null}
    </form>
  );
}
