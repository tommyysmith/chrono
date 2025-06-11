export const Mail = ({className, ...props}) => {
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
        <path
          d="M2 8.571C2 6.047 3.79 4 6 4h12c2.21 0 4 2.047 4 4.571v6.858C22 17.953 20.21 20 18 20H6c-2.21 0-4-2.047-4-4.571zm4-2.285h12c.583 0 1.108.285 1.474.74l-6.867 5.25a1 1 0 0 1-1.214 0l-6.867-5.25c.366-.455.89-.74 1.474-.74M4 9.14v6.288c0 1.262.895 2.285 2 2.285h12c1.105 0 2-1.023 2-2.285V9.14l-6.178 4.724a3 3 0 0 1-3.644 0z"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <path d="M18 6.286H6c-.583 0-1.108.285-1.474.74l6.867 5.25a1 1 0 0 0 1.214 0l6.867-5.25c-.366-.455-.89-.74-1.474-.74" />
      </g>
    </svg>
  );
};
