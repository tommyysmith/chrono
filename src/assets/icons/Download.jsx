export const Download = ({className, ...props}) => {
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
      <g fill="currentColor" clipRule="evenodd" fillRule="evenodd">
        <path d="M17.741 10.437a1.17 1.17 0 0 0-1.66-.04l-2.907 2.778v-10a1.175 1.175 0 1 0-2.348.001v9.999L7.92 10.397a1.17 1.17 0 0 0-1.66.04c-.447.47-.43 1.215.04 1.663l4.891 4.673a1.17 1.17 0 0 0 1.62 0l4.891-4.673c.47-.448.487-1.193.04-1.663" />
        <path d="M5.348 17.882a1.175 1.175 0 1 0-2.348 0v.98A3.134 3.134 0 0 0 6.13 22h11.74A3.134 3.134 0 0 0 21 18.863v-.98a1.175 1.175 0 1 0-2.348 0v.98c0 .433-.35.784-.782.784H6.13a.783.783 0 0 1-.782-.784z" />
      </g>
    </svg>
  );
};
