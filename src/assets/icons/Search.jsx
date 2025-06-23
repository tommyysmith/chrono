export const Search = ({ className, ...props }) => {
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
        d="M14.906 16.32a8 8 0 1 1 1.414-1.414l4.387 4.387a1 1 0 0 1-1.414 1.414zM16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
