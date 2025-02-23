export const Inbox = ({ className, ...props }) => {
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
        d="M1.333 4.667a3.333 3.333 0 0 1 3.334-3.334h6.666a3.333 3.333 0 0 1 3.334 3.334v6.666a3.333 3.333 0 0 1-3.334 3.334H4.667a3.333 3.333 0 0 1-3.334-3.334zm3.334-2a2 2 0 0 0-2 2v5.906c1.259-.772 3.016-.442 3.847.944h3.01c.814-1.382 2.56-1.715 3.81-.95v-5.9a2 2 0 0 0-2-2z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
