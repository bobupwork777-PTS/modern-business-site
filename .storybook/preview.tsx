// @ts-ignore
import "./storybook.css";

import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
    },

    actions: {
      argTypesRegex: "^on[A-Z].*",
    },
  },
};

export default preview;