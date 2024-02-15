import { Button as BaseButton } from "react-aria-components";
import sty from "./Button.module.css"
import classNames from "classnames";

interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  size?: "large" | "small" | "tiny";
  styleType?: "primary" | "super-primary" | "clear";
}


export function Button(props: ButtonProps) {
  const {size, styleType, ...rest} = props;
  return (
    <BaseButton className={classNames(
      sty.root, {
        [sty.large]: size === "large",
        [sty.small]: size === "small",
        [sty.tiny]: size === "tiny",
        [sty.superPrimary]: styleType === "super-primary",
        [sty.clear]: styleType === "clear",
        [sty.primary]: styleType === "primary",
      })} {...rest} />
  );
}