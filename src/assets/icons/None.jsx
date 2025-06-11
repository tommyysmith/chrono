export const None = ({className, ...props}) => {
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
        d="M14.5 12a2.5 2.5 0 1 0-2.5 2.5V16a4 4 0 1 1 0-8 4 4 0 0 1 0 8v-1.5a2.5 2.5 0 0 0 2.5-2.5"
      />
    </svg>
  );
};
