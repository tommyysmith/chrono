export const Flag = ({ className, ...props }) => {
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
        d="M11.608 2.529a7 7 0 0 0-5.215-.12l-1.744.653A1 1 0 0 0 4 3.996v16.97a1 1 0 0 0 2 0V14.17l1.499-.561a5 5 0 0 1 3.129-.126l2.853.814a7 7 0 0 0 5.054-.469l.912-.455A1 1 0 0 0 20 12.48V3.996a.998.998 0 0 0-1.447-.893l-.511.256a5 5 0 0 1-4.206.123z"
      />
    </svg>
  );
};
