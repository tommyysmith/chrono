'use client';

import { motion } from 'framer-motion';
import { Check } from '../assets/icons/Check';

const checkVariants = {
  checked: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.2 }
  },
  unchecked: {
    pathLength: 0,
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export default function Checkbox({ checked, onChange }) {
  const handleChange = (e) => {
    e.stopPropagation();
    console.log('Checkbox clicked, current state:', checked);
    onChange?.();
  };

  return (
    <button
      onClick={handleChange}
      className={`relative w-[14px] h-[14px] rounded-[5px] bg-light-bg dark:bg-dark-bg-lighter border flex items-center justify-center group ${
        checked ? 'bg-primary dark:bg-primary border-primary' : 'border border-black/25 dark:border-white/20'
      }`}
    >
      {/* Animated Checkmark (visible when checked) */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d="M1.5 5L4 7.5L8.5 2.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial="unchecked"
          animate={checked ? "checked" : "unchecked"}
          variants={checkVariants}
        />
      </svg>

      {/* Hover Checkmark (only visible when NOT checked and hovering) */}
      {!checked && (
        <Check
          className="absolute w-2.5 h-2.5 text-black/40 dark:text-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        />
      )}
    </button>
  );
}
