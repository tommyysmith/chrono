export const Contact = ({className, ...props}) => {
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
        d="M12 19.948c5.523 0 10-4.018 10-8.974S17.523 2 12 2 2 6.018 2 10.974c0 2.936 1.571 5.542 4 7.18v2.82c0 .731.726 1.227 1.385.946z"
      />
    </svg>
  );
};
