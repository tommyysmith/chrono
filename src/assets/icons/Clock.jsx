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
        d="M14.667 8A6.667 6.667 0 1 1 1.333 8a6.667 6.667 0 0 1 13.334 0M8 4.333c.368 0 .667.299.667.667v2.724l1.804 1.805a.667.667 0 1 1-.942.942l-2-2A.67.67 0 0 1 7.333 8V5c0-.368.299-.667.667-.667"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
