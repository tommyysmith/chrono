export const Microphone = ({ className, ...props }) => {
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
        <path
          d="M7.998 1.332a3.333 3.333 0 0 0-3.334 3.333V8a3.333 3.333 0 0 0 6.667 0V4.665a3.333 3.333 0 0 0-3.333-3.333m-2 3.333a2 2 0 0 1 4 0V8a2 2 0 1 1-4 0z"
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <path d="M3.942 10.065a.667.667 0 1 0-1.222.534c.73 1.67 2.526 2.828 4.61 3.034v.366a.667.667 0 1 0 1.334 0v-.366c2.085-.206 3.881-1.364 4.611-3.034a.667.667 0 1 0-1.222-.534c-.551 1.262-2.108 2.267-4.055 2.267-1.948 0-3.505-1.005-4.056-2.267" />
      </g>
    </svg>
  );
};
