export const Clock = ({ className, ...props }) => {
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
        stroke="currentColor"
        d="M9.665 6.367v-1.7a1.667 1.667 0 0 0-3.333 0v1.7a2.333 2.333 0 0 0 1.643 3.966l1.26 1.26a1.667 1.667 0 1 0 2.356-2.358l-1.26-1.26a2.33 2.33 0 0 0-.666-1.608Zm4 1.633A5.667 5.667 0 1 1 2.332 8a5.667 5.667 0 0 1 11.333 0ZM8 8.333a.333.333 0 1 1 0-.667.333.333 0 0 1 0 .667Z"
        strokeWidth="2"
      />
    </svg>
  );
};
