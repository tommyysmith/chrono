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
      <path
        fill="currentColor"
        d="M2 7a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5zm5-3a3 3 0 0 0-3 3v8.859c1.888-1.157 4.525-.663 5.77 1.416h4.516c1.221-2.072 3.84-2.572 5.714-1.425V7a3 3 0 0 0-3-3z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
