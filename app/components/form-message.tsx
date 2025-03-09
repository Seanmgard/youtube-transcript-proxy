import { AlertCircle, CheckCircle2 } from "lucide-react";

export type Message = {
  type: "success" | "error";
  message: string;
};

export function FormMessage({ message }: { message: Message | null }) {
  if (!message) return null;

  return (
    <div
      className={`${
        message.type === "error"
          ? "bg-destructive/15 text-destructive"
          : "bg-emerald-500/15 text-emerald-500"
      } px-3 py-2 rounded-md flex items-center gap-2 text-sm`}
    >
      {message.type === "error" ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      <p>{message.message}</p>
    </div>
  );
}
