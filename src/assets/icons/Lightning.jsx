export const Lightning = ({className, ...props}) => {
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
        d="M12.947 2.031a1 1 0 0 1 .755.969v6.579h2.796a1.003 1.003 0 0 1 .88 1.479l-5.698 10.42A1.003 1.003 0 0 1 9.798 21v-6.579H7.002a.998.998 0 0 1-.88-1.479l5.698-10.42a1 1 0 0 1 1.127-.491"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  );
};
