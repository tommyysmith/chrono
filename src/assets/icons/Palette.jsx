export const Palette = ({className, ...props}) => {
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
        d="M18 14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7l6-6zm-4.962-6.788a2 2 0 0 1 2.796-.031l1.157 1.106a2 2 0 0 1 .033 2.86L12 16.172V8.25zM8 4a2 2 0 0 1 2 2v11a3 3 0 1 1-6 0V6a2 2 0 0 1 2-2zM7 16.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      />
    </svg>
  );
};
