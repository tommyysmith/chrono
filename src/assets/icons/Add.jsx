export const Add = ({ className, ...props }) => {
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
        d="M8.805 3.476a.808.808 0 0 0-1.616 0v3.717H3.472a.808.808 0 0 0 0 1.616H7.19v3.718a.808.808 0 0 0 1.616 0V8.809h3.718a.808.808 0 1 0 0-1.616H8.805z"
      />
    </svg>
  );
};
