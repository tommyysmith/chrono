export const Inbox = ({ className, ...props }) => {
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
          d="M2 8a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6zm2 2v6a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-6a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <rect width="10" height="2" x="7" y="9.5" rx="1" />
        <rect width="7" height="2" x="7" y="14.5" rx="1" />
      </g>
    </svg>
  );
};
