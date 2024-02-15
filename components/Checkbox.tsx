import { Checkbox as BaseCheckbox } from "react-aria-components";
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import sty from "./Checkbox.module.css";
import { mergeProps } from "react-aria";

export function Checkbox(
  props: React.ComponentProps<typeof BaseCheckbox> & {
    children?: React.ReactNode;
  }
) {
  const { children, ...rest } = props;
  return (
    <BaseCheckbox {...mergeProps(rest, {className: sty.root})}>
      {({isSelected}) => (
        <>
          <div className={sty.checkbox}>
            {isSelected ? <FontAwesomeIcon icon={faCheck} /> : null}
          </div>
          {children}
        </>
      )}
    </BaseCheckbox>
  )
}