export const Shift = ({ className, ...props }) => {
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
        d="M12.743 3.331a1 1 0 0 0-1.486 0l-9 10A1 1 0 0 0 3 15h3v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5h3a1 1 0 0 0 .743-1.669z"
      />
    </svg>
  );
};
