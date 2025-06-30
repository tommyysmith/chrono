"use client";

export default function Error({
  error,
  reset,
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-light-text dark:text-dark-text mb-4">
          500
        </h1>
        <h2 className="text-2xl font-semibold text-light-text dark:text-dark-text mb-4">
          Something went wrong
        </h2>
        <p className="text-light-text/70 dark:text-dark-text/70 mb-8">
          An error occurred while processing your request.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
} 