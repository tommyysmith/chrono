export const SidebarIcon = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <g fill="currentColor">
        <path
          d="M22 16a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4zM18 6h-6v12h6a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2M6 6h4v12H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <circle cx="7" cy="12" r="1" />
        <circle cx="7" cy="9" r="1" />
      </g>
    </svg>
  );
};
