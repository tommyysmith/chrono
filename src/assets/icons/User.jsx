export const User = ({ className, ...props }) => {
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
        d="M14.665 8A6.667 6.667 0 1 1 1.332 8a6.667 6.667 0 0 1 13.333 0M10 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0m1.298 6.191A5.3 5.3 0 0 1 8 13.333a5.3 5.3 0 0 1-3.3-1.142 2.986 2.986 0 0 1 2.95-2.525h.696a2.986 2.986 0 0 1 2.95 2.525"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
