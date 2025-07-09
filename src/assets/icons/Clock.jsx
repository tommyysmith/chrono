export const Clock = ({ className, ...props }) => {
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
          d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16m0 2c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <path d="M11 8a1 1 0 1 1 2 0v3.586l2.207 2.207.068.076a1 1 0 0 1-1.406 1.406l-.076-.068-2.5-2.5A1 1 0 0 1 11 12z" />
      </g>
    </svg>
  );
};
