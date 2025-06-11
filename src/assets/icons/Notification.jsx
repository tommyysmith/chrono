export const Notification = ({className, ...props}) => {
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
        d="M12 2a1 1 0 0 1 .999 1v.07a7 7 0 0 1 5.99 6.93v4.446l1.163.728c1.531.958.853 3.326-.952 3.326h-3.237A4 4 0 0 1 12 22a4 4 0 0 1-3.963-3.5H4.8c-1.805 0-2.483-2.368-.952-3.326l1.163-.728V10A7 7 0 0 1 11 3.07V3a1 1 0 0 1 1-1m-1.934 16.5a1.998 1.998 0 0 0 3.868 0z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
