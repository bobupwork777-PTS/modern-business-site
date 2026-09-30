import React from "react";


type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;

    variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "outline";

    size?:
    | "small"
    | "medium"
    | "large";

    loading?: boolean;

    fullWidth?: boolean;
};


export default function Button({
    children,

    variant = "primary",

    size = "medium",

    loading = false,

    fullWidth = false,

    disabled,

    className = "",

    ...props

}: ButtonProps) {


    const variants = {

        primary:
            "bg-blue-600 hover:bg-blue-700 text-white",

        secondary:
            "bg-gray-200 hover:bg-gray-300 text-gray-900",

        danger:
            "bg-red-600 hover:bg-red-700 text-white",

        outline:
            "border border-blue-600 text-blue-600 hover:bg-blue-50"

    };


    const sizes = {

        small:
            "px-3 py-1.5 text-sm",

        medium:
            "px-5 py-2.5 text-base",

        large:
            "px-7 py-3 text-lg"

    };


    return (

        <button

            disabled={disabled || loading}

            className={`
        rounded-lg
        font-medium
        transition-all
        duration-200
        focus:outline-none
        focus:ring-2
        focus:ring-blue-400

        ${variants[variant]}

        ${sizes[size]}

        ${fullWidth ? "w-full" : ""}

        ${disabled || loading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }

        ${className}
      `}

            {...props}

        >

            {
                loading
                    ? "Loading..."
                    : children
            }

        </button>

    );
}