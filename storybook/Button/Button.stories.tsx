import type { Meta, StoryObj } from "@storybook/react";
import Button from "./Button";


const meta: Meta<typeof Button> = {
  title: "Button",
  component: Button,

  tags: ["autodocs"],

  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "danger",
        "outline",
      ],
    },

    size: {
      control: "select",
      options: [
        "small",
        "medium",
        "large",
      ],
    },

    loading: {
      control: "boolean",
    },

    disabled: {
      control: "boolean",
    },

    fullWidth: {
      control: "boolean",
    },
  },
};


export default meta;


type Story = StoryObj<typeof Button>;


export const Primary: Story = {
  args: {
    children: "Primary Button",
    variant: "primary",
    size: "medium",
    loading: false,
    disabled: false,
    fullWidth: false,
  },
};


export const Secondary: Story = {
  args: {
    children: "Secondary Button",
    variant: "secondary",
    size: "medium",
  },
};


export const Danger: Story = {
  args: {
    children: "Delete",
    variant: "danger",
  },
};


export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};


export const Loading: Story = {
  args: {
    children: "Saving...",
    loading: true,
  },
};


export const Disabled: Story = {
  args: {
    children: "Disabled",
    disabled: true,
  },
};


export const FullWidth: Story = {
  args: {
    children: "Full Width",
    fullWidth: true,
  },
};