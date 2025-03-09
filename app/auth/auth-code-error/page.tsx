import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCodeError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Authentication Error
          </h2>
          <p className="mt-2 text-gray-600">
            There was a problem with the authentication process. This could be because:
          </p>
          <ul className="mt-4 text-left text-gray-600 space-y-2">
            <li>• The authentication link has expired</li>
            <li>• The link has already been used</li>
            <li>• The link is invalid</li>
          </ul>
        </div>

        <div className="mt-8">
          <p className="mb-4 text-gray-600">
            Please try signing in again or contact support if the problem persists.
          </p>
          <Link href="/auth/sign-in">
            <Button className="w-full">
              Return to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 