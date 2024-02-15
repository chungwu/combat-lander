import { ModalOverlay, Modal as BaseModal, Dialog } from "react-aria-components";
import React from "react";
import { MONO } from "@/fonts";
import sty from "./Modal.module.css";
import classNames from "classnames";

export function Modal(props: {
  children?: React.ReactNode | ((ps: {close: () => void}) => React.ReactNode);
  underlayBlur?: boolean;
  modalBlur?: boolean;
  isOpen?: boolean;
  modalType?: "dialog" | "alertdialog"
}) {
  const { children, underlayBlur, modalBlur, isOpen, modalType, ...rest } = props;
  return (
    <ModalOverlay 
      className={classNames("app", "dark", MONO.variable, sty.underlay, {
        [sty.modalAlert]: modalType === "alertdialog"
      })}
      isOpen={isOpen}
      style={{
        backdropFilter: underlayBlur ? "blur(8px)" : undefined,
      }}
    >
      <BaseModal 
        className={sty.modal}
        style={{
          padding: 32,
          border: "1px solid white",
          backdropFilter: modalBlur ? "blur(8px)" : undefined,
          zIndex: 5,
        }}
      >
        <Dialog className={sty.dialog} role={modalType}>
          {children}
        </Dialog>
      </BaseModal>
    </ModalOverlay>
  )
}