export const ArrowAlt = ({ className, ...props }) => {
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
        d="M12.793 5.793a1 1 0 0 0 0 1.414L16.586 11H5a1 1 0 1 0 0 2h11.586l-3.793 3.793a1 1 0 0 0 1.414 1.414l5.5-5.5a1 1 0 0 0 0-1.414l-5.5-5.5a1 1 0 0 0-1.414 0"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
