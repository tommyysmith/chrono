export const Check = ({ className, ...props }) => {
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
        d="M19.64 8.053c.476-.466.48-1.226.01-1.697a1.22 1.22 0 0 0-1.714-.01l-8.937 8.75-2.918-2.972a1.22 1.22 0 0 0-1.714-.025 1.19 1.19 0 0 0-.024 1.697l3.77 3.84a1.22 1.22 0 0 0 1.72.017z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
