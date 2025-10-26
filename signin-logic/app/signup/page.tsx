import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join Colabify
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connect your GitHub account to get started
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}