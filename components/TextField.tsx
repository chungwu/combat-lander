import { TextField as BaseTextField } from "react-aria-components"
import React from "react";
import { mergeProps } from "react-aria";
import classNames from "classnames";
import sty from "./TextField.module.css";

interface TextFieldProps extends React.ComponentProps<typeof BaseTextField> {

}

export function TextField(props: TextFieldProps) {
  const {...rest} = props;
  return (
    <BaseTextField {...mergeProps(
      rest,
      {
        className: classNames(
          sty.root
        )
      }
    )} />
  );
}