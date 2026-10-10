import { isRouteErrorResponse, useRouteError, useNavigate } from "react-router"
import { AlertCircleIcon, ArrowLeftIcon, HomeIcon } from "lucide-react"

export function RootErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  let title = "Unexpected Application Error"
  let message = "An unexpected error occurred while loading this page."
  let statusCode = 500

  if (isRouteErrorResponse(error)) {
    statusCode = error.status
    if (error.status === 404) {
      title = "Page Not Found"
      message = "The page you are looking for does not exist or may have been moved."
    } else {
      title = `Error ${error.status}: ${error.statusText || "Something went wrong"}`
      message = (error.data as any)?.message || message
    }
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-6 text-[#8B0000]">
        <AlertCircleIcon className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-[#8B0000] bg-red-100 px-3 py-1 rounded-full mb-3">
        {statusCode === 404 ? "404 Not Found" : `Error ${statusCode}`}
      </span>
      <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl tracking-tight mb-2">
        {title}
      </h1>
      <p className="max-w-md text-sm text-neutral-600 mb-8">
        {message}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B0000] text-sm font-medium text-white hover:bg-[#6b0000] shadow-sm transition cursor-pointer"
        >
          <HomeIcon className="w-4 h-4" />
          Return to Home
        </button>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-6 text-[#8B0000]">
        <AlertCircleIcon className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-[#8B0000] bg-red-100 px-3 py-1 rounded-full mb-3">
        404 Not Found
      </span>
      <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl tracking-tight mb-2">
        Page Not Found
      </h1>
      <p className="max-w-md text-sm text-neutral-600 mb-8">
        The page you requested could not be found. Please check the URL or return to your dashboard.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B0000] text-sm font-medium text-white hover:bg-[#6b0000] shadow-sm transition cursor-pointer"
        >
          <HomeIcon className="w-4 h-4" />
          Return to Home
        </button>
      </div>
    </div>
  )
}
