export const Pin = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M11.517 3.508a2.88 2.88 0 0 0-4.066 0L5.693 5.264a.4.4 0 0 1-.116.083L3.04 6.599a.666.666 0 0 0-.176 1.068l2.268 2.265-2.268 2.265a.665.665 0 1 0 .943.942l2.268-2.265 2.255 2.252a.667.667 0 0 0 1.07-.176l1.253-2.535a.4.4 0 0 1 .083-.115l1.758-1.756a2.87 2.87 0 0 0 0-4.062z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
