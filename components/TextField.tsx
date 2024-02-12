import { TextField as BaseTextField, Input, Label } from "react-aria-components"
import React from "react";
import { mergeProps } from "react-aria";
import classNames from "classnames";
import sty from "./TextField.module.css";

interface TextFieldProps extends React.ComponentProps<typeof BaseTextField> {
  label?: string;
  autoSelectAll?: boolean;
}

export function TextField(props: TextFieldProps) {
  const {label, autoSelectAll, ...rest} = props;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selected, setSelected] = React.useState(false);
  React.useEffect(() => {
    if (inputRef.current && autoSelectAll && !selected) {
      inputRef.current.select();
      setSelected(true);
    }
  }, [autoSelectAll, selected, setSelected]);
  return (
    <BaseTextField {...mergeProps(
      rest,
      {
        className: classNames(
          sty.root
        )
      }
    )}>
      {label && <Label>{label}</Label>}
      <Input ref={inputRef} />
    </BaseTextField>
  );
}