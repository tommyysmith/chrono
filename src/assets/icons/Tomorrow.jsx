export const Tomorrow = ({ className, ...props }) => {
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
          d="M2 8a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6zm2 2v6a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-6a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <path d="M10.293 9.793a1 1 0 0 1 1.338-.068l.076.068 2.5 2.5.068.076a1 1 0 0 1 0 1.262l-.068.076-2.5 2.5a1 1 0 1 1-1.414-1.414L12.086 13l-1.793-1.793-.068-.076a1 1 0 0 1 .068-1.338" />
      </g>
    </svg>
  );
};
