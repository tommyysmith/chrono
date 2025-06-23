export const Drag = ({ className, ...props }) => {
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
      <g fill="currentColor">
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="9" cy="18" r="2" />
        <circle cx="15" cy="18" r="2" />
      </g>
    </svg>
  );
};
