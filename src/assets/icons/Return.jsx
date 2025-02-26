export const Return = ({ className, ...props }) => {
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
        d="M8 3.333c0-.368.299-.666.667-.666h2a4 4 0 0 1 0 8H3.61l1.528 1.528a.667.667 0 1 1-.943.943L1.53 10.471a.667.667 0 0 1 0-.942l2.666-2.667a.667.667 0 1 1 .943.943L3.61 9.333h7.057a2.667 2.667 0 1 0 0-5.333h-2A.667.667 0 0 1 8 3.333"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
