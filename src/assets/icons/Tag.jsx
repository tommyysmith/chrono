export const Tag = ({ className, ...props }) => {
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
        d="M2.58 6.873a1.98 1.98 0 0 0 0 2.801l3.746 3.746a1.98 1.98 0 0 0 2.801 0l4.293-4.293a1.98 1.98 0 0 0 .58-1.4V3.98A1.98 1.98 0 0 0 12.019 2H8.274c-.526 0-1.03.209-1.401.58zM11 5.667a.667.667 0 1 0 0-1.334.667.667 0 0 0 0 1.334"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
