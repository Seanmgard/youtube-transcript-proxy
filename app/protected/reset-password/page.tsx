import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/app/components/form-message";
import { SubmitButton } from "@/app/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <form className="flex flex-col w-full max-w-md p-4 gap-2 [&>input]:mb-4">
      <h1 className="text-2xl font-medium">Reset password</h1>
      <p className="text-sm text-foreground/60">
        Please enter your new password below.
      </p>
      <Label htmlFor="password">New password</Label>
      <Input
        type="password"
        name="password"
        id="password"
        required
        minLength={8}
      />
      <FormMessage message={searchParams} />
      <button
        type="submit"
        formAction={resetPasswordAction}
        className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
      >
        Reset password
      </button>
    </form>
  );
}
