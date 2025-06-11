export const Low = ({className, ...props}) => {
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
      <g stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="12" r="3.25" />
        <circle cx="17" cy="12" r="3.25" />
      </g>
    </svg>
  );
};
