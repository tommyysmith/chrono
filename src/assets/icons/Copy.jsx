export const Copy = ({ className, ...props }) => {
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
        d="M2 4a2 2 0 0 1 2-2h5.333a2 2 0 0 1 2 2v.667H12a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H6.667a2 2 0 0 1-2-2v-.667H4a2 2 0 0 1-2-2zm4 7.333V12c0 .368.298.667.667.667H12a.667.667 0 0 0 .667-.667V6.667A.667.667 0 0 0 12 6h-.667v3.333a2 2 0 0 1-2 2z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
