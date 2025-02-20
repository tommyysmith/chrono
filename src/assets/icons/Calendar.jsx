export const Calendar = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M5.332 2a.667.667 0 0 0-1.333 0v.666a2.667 2.667 0 0 0-2.667 2.667v6a3.333 3.333 0 0 0 3.333 3.333h6.667a3.333 3.333 0 0 0 3.333-3.333v-6A2.667 2.667 0 0 0 12 2.666V2a.667.667 0 0 0-1.334 0v.666H9.332A.667.667 0 0 0 8.665 2H7.332a.667.667 0 0 0-.667.666H5.332zm-.333 3.333a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1h.666a1 1 0 0 0 1-1v-.667a1 1 0 0 0-1-1z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
