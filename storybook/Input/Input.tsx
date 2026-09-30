import React from "react";


type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};


export default function Input({
  label,
  error,
  helperText,
  className = "",
  ...props
}: InputProps) {

  return (
    <div className="flex flex-col gap-2 w-full">

      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <input
        className={`
          w-full
          rounded-lg
          border
          px-4
          py-2.5
          text-sm
          outline-none
          transition

          ${
            error
              ? "border-red-500 focus:ring-red-200"
              : "border-gray-300 focus:border-blue-600 focus:ring-blue-100"
          }

          focus:ring-4

          disabled:bg-gray-100
          disabled:cursor-not-allowed

          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="text-sm text-gray-500">
          {helperText}
        </p>
      )}

    </div>
  );
}