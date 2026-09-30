import type { Meta, StoryObj } from "@storybook/react";
import Input from "./Input";


const meta: Meta<typeof Input> = {

  title: "Input",

  component: Input,

  tags: ["autodocs"],

  argTypes: {

    type: {
      control: "select",
      options: [
        "text",
        "email",
        "password",
        "number"
      ],
    },

    disabled: {
      control: "boolean",
    },

    error: {
      control: "text",
    },

    helperText: {
      control: "text",
    },

  },

};


export default meta;


type Story = StoryObj<typeof Input>;



export const Default: Story = {

  args: {
    label: "Name",
    placeholder: "Enter your name",
  },

};



export const Email: Story = {

  args: {
    label: "Email",
    type: "email",
    placeholder: "Enter email",
  },

};



export const Password: Story = {

  args: {
    label: "Password",
    type: "password",
    placeholder: "Enter password",
  },

};



export const Error: Story = {

  args: {
    label: "Email",
    placeholder: "Enter email",
    error: "Invalid email address",
  },

};



export const HelperText: Story = {

  args: {
    label: "Password",
    type: "password",
    helperText: "Minimum 8 characters required",
  },

};



export const Disabled: Story = {

  args: {
    label: "Username",
    placeholder: "Disabled input",
    disabled: true,
  },

};