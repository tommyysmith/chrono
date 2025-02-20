export const Trash = ({ className, ...props }) => {
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
      <g fill="currentColor">
        <path d="M6.667 6.332c.368 0 .666.299.666.667v4a.667.667 0 1 1-1.333 0v-4c0-.368.298-.667.667-.667M10 6.999a.667.667 0 0 0-1.333 0v4a.667.667 0 1 0 1.333 0z" />
        <path
          d="M6.667 1.332a2 2 0 0 0-2 2h-2a.667.667 0 0 0-.182 1.308l.62 8.177a2 2 0 0 0 1.994 1.848h5.658a2 2 0 0 0 1.995-1.848l.618-8.153a.667.667 0 0 0-.037-1.332h-2a2 2 0 0 0-2-2zm3.333 2a.667.667 0 0 0-.667-.667H6.667A.667.667 0 0 0 6 3.332zM3.824 4.665l.61 8.05a.667.667 0 0 0 .665.617h5.658a.667.667 0 0 0 .665-.616l.61-8.05z"
          clipRule="evenodd"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
};
