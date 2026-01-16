export const Video = ({ className, ...props }) => {
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
        d="M1.333 5.333a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v.613l1.167-.934c.874-.698 2.167-.077 2.167 1.041v3.893c0 1.118-1.293 1.74-2.167 1.041l-1.167-.934v.613a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2zm10 3.013 2 1.6V6.053l-2 1.6zm-8-3.68a.667.667 0 0 0-.666.667v5.333c0 .368.298.667.666.667h6a.667.667 0 0 0 .667-.667V5.333a.667.667 0 0 0-.667-.667z"
        clipRule="evenodd"
        fillRule="evenodd"
        style="fill:#161616;fill:color(display-p3 .0863 .0863 .0863);fill-opacity:1"
      />
    </svg>
  );
};
