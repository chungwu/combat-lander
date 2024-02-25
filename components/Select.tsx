import { Select as BaseSelect, Label, ListBox, ListBoxItem, SelectValue, SelectValueRenderProps } from "react-aria-components";
import { Button } from "./Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { Popover } from "./Menu";
import { mergeProps } from "react-aria";
import sty from "./Select.module.css";

interface SelectFieldProps extends React.ComponentProps<typeof BaseSelect> {
  label?: string;
  children?: React.ReactNode;
  renderSelected?: (value: SelectValueRenderProps<any>) => React.ReactNode;
}

export function SelectField(props: SelectFieldProps) {
  const { label, children, renderSelected, ...rest } = props;
  return (
    <BaseSelect {...rest}>
      {label && <Label>{label}</Label>}
      <Button style={{display: "flex", whiteSpace: "nowrap"}}>
        <SelectValue>{renderSelected}</SelectValue>
        <FontAwesomeIcon style={{marginLeft: "1ch"}} icon={faChevronDown} />
      </Button>
      <Popover>
        <ListBox className={sty.listBox}>
          {children}
        </ListBox>
      </Popover>
    </BaseSelect>
  )
}

export function SelectOption(props: React.ComponentProps<typeof ListBoxItem>) {
  return (
    <ListBoxItem {...mergeProps(props, {className: sty.listBoxItem})} />
  );
}