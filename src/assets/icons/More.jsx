export const More = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M8.5 12A2.25 2.25 0 1 1 4 12a2.25 2.25 0 0 1 4.5 0m5.75 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0M20 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0"
      />
    </svg>
  );
};
