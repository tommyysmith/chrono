export const High = ({className, ...props}) => {
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
        d="M9.5 17A2.5 2.5 0 1 0 7 19.5V21a4 4 0 1 1 0-8 4 4 0 0 1 0 8v-1.5A2.5 2.5 0 0 0 9.5 17m10 0a2.5 2.5 0 1 0-2.5 2.5V21a4 4 0 1 1 0-8 4 4 0 0 1 0 8v-1.5a2.5 2.5 0 0 0 2.5-2.5M9.5 7A2.5 2.5 0 1 0 7 9.5V11a4 4 0 1 1 0-8 4 4 0 0 1 0 8V9.5A2.5 2.5 0 0 0 9.5 7m10 0A2.5 2.5 0 1 0 17 9.5V11a4 4 0 1 1 0-8 4 4 0 0 1 0 8V9.5A2.5 2.5 0 0 0 19.5 7"
      />
    </svg>
  );
};
