export const Chevron = ({ className, ...props }) => {
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
        d="M5.195 2.863a.667.667 0 0 0 0 .943l4.196 4.195-4.196 4.196a.667.667 0 1 0 .943.942l4.667-4.666a.667.667 0 0 0 0-.943L6.138 2.863a.667.667 0 0 0-.943 0"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
