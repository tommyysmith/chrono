"use client";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-light-text dark:text-dark-text mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-light-text dark:text-dark-text mb-4">
          Page Not Found
        </h2>
        <p className="text-light-text/70 dark:text-dark-text/70 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <button
          onClick={() => window.history.back()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
} 