export const Cross = ({ className, ...props }) => {
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
        d="m6.08 4.357 5.92 5.92 5.92-5.92a1.219 1.219 0 1 1 1.723 1.724L13.723 12l5.92 5.92a1.219 1.219 0 1 1-1.724 1.723L12 13.723l-5.92 5.92a1.219 1.219 0 1 1-1.723-1.724L10.277 12l-5.92-5.92a1.219 1.219 0 0 1 1.724-1.723"
      />
    </svg>
  );
};
