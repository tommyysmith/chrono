export const Keyboard = ({className, ...props}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
      className={className}
    >
      <path
        fill="currentColor"
        d="M2 8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zm4 7a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2zM5 8a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H6a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm4.5-3a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zM16 8a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
