import { Menu as BaseMenu, MenuItem as BaseMenuItem, Popover as BasePopover, Separator } from "react-aria-components";
import React from "react";
import sty from "./Menu.module.css";
import { mergeProps } from "react-aria";
import classNames from "classnames";
import { MONO } from "@/fonts";


export function Menu(props: React.ComponentProps<typeof BaseMenu>) {
  const { ...rest } = props;
  return (
    <BaseMenu {...mergeProps(rest, {className: sty.menu})} />
  );
}

export function MenuItem(props: React.ComponentProps<typeof BaseMenuItem>) {
  const { ...rest } = props;
  return (
    <BaseMenuItem {...mergeProps(rest, {className: sty.menuItem})} />
  );
}

export function Popover(props: React.ComponentProps<typeof BasePopover>) {
  const { ...rest } = props;
  return (
    <BasePopover {...mergeProps(rest, {className: classNames("app", "dark", MONO.variable, sty.popover)})} />
  );
}

export function MenuSeparator() {
  return <Separator className={sty.menuSeparator} />;
}