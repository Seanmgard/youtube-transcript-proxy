"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  disabled,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className={className}
      aria-disabled={disabled || pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
        </>
      ) : (
        children
      )}
    </Button>
  );
}
